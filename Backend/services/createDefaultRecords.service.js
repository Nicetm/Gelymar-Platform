const { poolPromise } = require('../config/db');
const { getAllOrdersGroupedByRut, getNextFileIdentifier } = require('./file.service');
const { getCustomerByRut } = require('./customer.service');
const fs = require('fs').promises;
const path = require('path');
const { cleanDirectoryName } = require('../utils/directoryUtils');
const { logger } = require('../utils/logger');
const { logDocumentEvent } = require('./documentEvent.service');

/**
 * Crea registros en order_files con status_id = 1 para documentos por defecto
 * Esta función NO genera archivos PDF físicos, solo crea los registros en la base de datos
 * @param {Object} filters - Filtros opcionales { pc, factura }
 * @returns {Promise<void>}
 */
async function createDefaultRecords(filters = {}) {
  const startTime = new Date();
  const startTimeMs = Date.now();
  
  try {
    const { pc, factura } = filters || {};
    const normalizedFilterPc = pc ? String(pc).trim() : null;
    const normalizedFilterFactura = factura ? String(factura).trim() : null;
    const parts = [];
    if (normalizedFilterPc) parts.push(`pc=${normalizedFilterPc}`);
    if (normalizedFilterFactura) parts.push(`factura=${normalizedFilterFactura}`);
    logger.info(`[createDefaultRecords] Iniciando creación de registros por defecto - timestamp=${startTime.toISOString()}${parts.length ? ` ${parts.join(' ')}` : ''}`);
    
    // Obtener configuración desde param_config para obtener sendFrom
    const pool = await poolPromise;
    let sendFrom = null;
    try {
      const [configRows] = await pool.query(
        'SELECT params FROM param_config WHERE name = ?',
        ['checkDefaultFiles']
      );
      if (configRows.length > 0 && configRows[0].params) {
        // Verificar si params ya es un objeto o es un string JSON
        let params;
        if (typeof configRows[0].params === 'string') {
          params = JSON.parse(configRows[0].params);
        } else if (typeof configRows[0].params === 'object') {
          params = configRows[0].params;
        } else {
          logger.warn(`[createDefaultRecords] Tipo de params inesperado: ${typeof configRows[0].params}`);
          params = {};
        }
        sendFrom = params.sendFrom || null;
        if (sendFrom) {
          logger.info(`[createDefaultRecords] Filtrando órdenes desde fecha: ${sendFrom}`);
        }
      }
    } catch (configError) {
      logger.warn(`[createDefaultRecords] Error obteniendo configuración sendFrom: ${configError.message}`);
      logger.warn(`[createDefaultRecords] Valor de params: ${JSON.stringify(configRows?.[0]?.params)}`);
    }
    
    // Obtener todas las órdenes agrupadas por RUT (filtradas por sendFrom si está configurado)
    const ordersByRut = await getAllOrdersGroupedByRut(sendFrom, { pc: normalizedFilterPc, factura: normalizedFilterFactura });
    const totalClients = Object.keys(ordersByRut).length;
    
    if (totalClients === 0) {
      const endTime = new Date();
      const duration = ((Date.now() - startTimeMs) / 1000).toFixed(2);
      logger.info(`[createDefaultRecords] No hay órdenes para procesar - timestamp=${endTime.toISOString()} duration=${duration}s`);
      return;
    }
    
    let totalFilesCreated = 0;
    let totalOrdersProcessed = 0;
    let totalDirectoriesCreated = 0;
    const { normalizeOcForCompare: normalizeOcKey } = require('../utils/oc.util');

    
    const { getIncotermValidators, hasFacturaValue } = require('../utils/incotermValidation');
    const { canCreateShipment, canCreateAvailability, canCreateDelivery } = await getIncotermValidators();

    // Procesar clientes en lotes para evitar problemas de memoria
    let clientEntries = Object.entries(ordersByRut);
    if (normalizedFilterPc || normalizedFilterFactura) {
      clientEntries = clientEntries
        .map(([rut, orders]) => {
          const filtered = orders.filter((order) => {
            if (normalizedFilterPc && String(order.pc || '').trim() !== normalizedFilterPc) return false;
            if (normalizedFilterFactura && String(order.factura || '').trim() !== normalizedFilterFactura) return false;
            return true;
          });
          return [rut, filtered];
        })
        .filter(([, orders]) => orders.length > 0);
    }
    if (clientEntries.length === 0) {
      const endTime = new Date();
      const duration = ((Date.now() - startTimeMs) / 1000).toFixed(2);
      logger.info(`[createDefaultRecords] No hay órdenes para procesar - timestamp=${endTime.toISOString()} duration=${duration}s${parts.length ? ` (${parts.join(' ')})` : ''}`);
      return;
    }

    const batchSize = 10; // Lotes más pequeños para clientes
    const totalBatches = Math.ceil(clientEntries.length / batchSize);

    const partialKeyCount = new Map();
    const partialKeyMinId = new Map();
    clientEntries.forEach(([, orders]) => {
      orders.forEach((order) => {
        const key = `${String(order.pc || '').trim()}`;
        partialKeyCount.set(key, (partialKeyCount.get(key) || 0) + 1);
        const orderId = order.id ? Number(order.id) : null;
        if (orderId && !Number.isNaN(orderId)) {
          const currentMin = partialKeyMinId.get(key);
          if (!currentMin || orderId < currentMin) {
            partialKeyMinId.set(key, orderId);
          }
        }
      });
    });
    
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const startIndex = batchIndex * batchSize;
      const endIndex = Math.min(startIndex + batchSize, clientEntries.length);
      const currentBatch = clientEntries.slice(startIndex, endIndex);
      
      for (const [rut, orders] of currentBatch) {
        for (const order of orders) {
          try {
            // Obtener información del cliente
            const customer = await getCustomerByRut(order.rut);
            if (!customer) {
              continue;
            }
            
            // Sincronizar factura del ERP: si la orden ahora tiene factura pero
            // el Order Receipt Notice fue creado con factura=NULL, actualizarlo
            const hasFactura = hasFacturaValue(order.factura);
            if (hasFactura) {
              try {
                await updateOrderReceiptNoticeFactura(order.pc, order.oc, order.factura);
              } catch (updateError) {
                logger.warn(`[createDefaultRecords] Error actualizando ORN con factura pc=${order.pc}: ${updateError.message}`);
              }
            }

            // Verificar si ya existen documentos para esta orden (solo por PC + factura, sin OC)
            const existingFiles = await checkExistingFiles(
              order.id,
              order.pc,
              order.factura
            );
            // Determinar ruta base: usar la existente si hay archivos previos
            let directoryPath = existingFiles[0]?.path;

            // Crear directorio físico en el servidor de archivos si no existen registros previos
            if (!directoryPath) {
              directoryPath = await createClientDirectory(customer.name, order.pc);
              if (!directoryPath) {
                logger.warn(`[createDefaultRecords] Error creando directorio para orden ${order.id}, omitiendo`);
                continue;
              }
              totalDirectoriesCreated++;
            }

            // Decidir documentos según factura y asignar file_id
            const FILE_ID_MAP = {
              'Order Receipt Notice': 9,
              'Shipment Notice': 19,
              'Order Delivery Notice': 15,
              'Availability Notice': 6
            };
            const partialKey = `${String(order.pc || '').trim()}`;
            const hasPartial = (partialKeyCount.get(partialKey) || 0) > 1;
            const orderId = order.id ? Number(order.id) : null;
            const minId = partialKeyMinId.get(partialKey) || null;
            const isParent =
              !hasPartial ||
              (orderId && minId && !Number.isNaN(orderId) && orderId === minId);

            // Determinar documentos requeridos
            let requiredDocs = [];
            if (hasPartial) {
              // Hay múltiples órdenes con el mismo PC
              if (isParent) {
                // Es la primera orden (parent) → SIEMPRE crear ORN
                requiredDocs.push('Order Receipt Notice');
              }
              // Para todas las órdenes parciales con factura, crear los otros documentos
              if (hasFactura) {
                if (canCreateShipment(order)) {
                  requiredDocs.push('Shipment Notice');
                }
                if (canCreateDelivery(order)) {
                  requiredDocs.push('Order Delivery Notice');
                }
                if (canCreateAvailability(order)) {
                  requiredDocs.push('Availability Notice');
                }
              }
            } else {
              // Solo hay una orden con este PC → SIEMPRE crear ORN
              requiredDocs.push('Order Receipt Notice');
              // Si tiene factura, crear también los otros documentos
              if (hasFactura) {
                if (canCreateShipment(order)) {
                  requiredDocs.push('Shipment Notice');
                }
                if (canCreateDelivery(order)) {
                  requiredDocs.push('Order Delivery Notice');
                }
                if (canCreateAvailability(order)) {
                  requiredDocs.push('Availability Notice');
                }
              }
            }
            
            // Filtrar los que ya existen (usar file_id para evitar duplicados cuando cambia el nombre)
            const existingFileIds = new Set(existingFiles.map(f => f.file_id).filter(Boolean));
            const documentsToCreate = requiredDocs
              .filter(name => !existingFileIds.has(FILE_ID_MAP[name]))
              .map(name => ({
                name,
                pc: order.pc,
                oc: order.oc,
                path: directoryPath,
                file_id: FILE_ID_MAP[name],
                factura: order.factura,
                customerRut: rut
              }));

            // Si no hay documentos por crear, continuar
            if (documentsToCreate.length === 0) {
              totalOrdersProcessed++;
              continue;
            }
            
            // Insertar los documentos
            for (const doc of documentsToCreate) {
              try {
                await insertDefaultFile(doc);
                totalFilesCreated++;
              } catch (insertError) {
                logger.error(`[createDefaultRecords] Error insertando ${doc.name} pc=${order.pc} oc=${order.oc || 'N/A'} factura=${order.factura || 'N/A'}: ${insertError.message}`);
              }
            }
            
            totalOrdersProcessed++;
            
          } catch (orderError) {
            logger.error(`[createDefaultRecords] Error procesando orden ${order.id}: ${orderError.message}`);
          }
        }
      }
    }
    
    const endTime = new Date();
    const duration = ((Date.now() - startTimeMs) / 1000).toFixed(2);
    logger.info(`[createDefaultRecords] Registros creados - timestamp=${endTime.toISOString()} duration=${duration}s files=${totalFilesCreated} orders=${totalOrdersProcessed} dirs=${totalDirectoriesCreated}`);
    
  } catch (error) {
    const errorTime = new Date();
    const duration = ((Date.now() - startTimeMs) / 1000).toFixed(2);
    logger.error(`[createDefaultRecords] Error en creación de registros por defecto: ${error.message} - timestamp=${errorTime.toISOString()} duration=${duration}s`);
    logger.error(`[createDefaultRecords] Stack: ${error.stack}`);
    throw error;
  }
}

/**
 * Verifica si ya existen archivos para una orden específica (busca solo por PC + factura)
 * @param {number} orderId - ID de la orden
 * @param {string} pc - Número PC
 * @param {string|null} factura - Número de factura
 * @returns {Promise<Array>} Array de archivos existentes
 */
async function checkExistingFiles(orderId, pc, factura = null) {
  const pool = await poolPromise;
  
  try {
    const normalizedPc = pc == null ? '' : String(pc).trim();
    const normalizedFactura = factura !== null && factura !== undefined && factura !== '' && factura !== 0 && factura !== '0'
      ? String(factura).trim()
      : null;
    // Buscar TODOS los registros para este PC: tanto los que tienen la factura
    // específica como los que tienen factura NULL (ORN recién sincronizados o pendientes).
    // Esto evita duplicados cuando syncFactura acaba de actualizar un registro.
    let query, params;
    if (normalizedFactura) {
      query = `SELECT f.* FROM order_files f WHERE TRIM(COALESCE(f.pc, '')) = ? AND (f.factura = ? OR f.factura IS NULL OR f.factura = '' OR f.factura = '0')`;
      params = [normalizedPc, normalizedFactura];
    } else {
      query = `SELECT f.* FROM order_files f WHERE TRIM(COALESCE(f.pc, '')) = ? AND (f.factura IS NULL OR f.factura = '' OR f.factura = '0')`;
      params = [normalizedPc];
    }
    const [rows] = await pool.query(query, params);
    
    return rows;
    
  } catch (error) {
    logger.error(`[createDefaultRecords] Error verificando archivos existentes pc=${pc}: ${error.message}`);
    logger.error(`[createDefaultRecords] Stack: ${error.stack}`);
    return [];
  }
}

/**
 * Inserta un nuevo registro de archivo en order_files con status_id = 1
 * @param {Object} fileData - Datos del archivo a insertar
 * @returns {Promise<Object>} Resultado de la inserción
 */
async function insertDefaultFile(fileData) {
  const pool = await poolPromise;
  
  try {
    const normalizedOc = fileData.oc == null ? '' : String(fileData.oc).trim();
    const query = `
      INSERT INTO order_files (
        pc, oc, factura, rut, name, path, file_identifier, file_id, was_sent, 
        document_type, file_type, status_id, is_visible_to_client, 
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 0, 'PDF', 1, 0, NOW(), NOW())
    `;

    const nextIdentifier = await getNextFileIdentifier(fileData.pc);
    if (!nextIdentifier) {
      throw new Error(`No se pudo generar file_identifier para PC ${fileData.pc}`);
    }
    const normalizedFactura = fileData.factura !== null && fileData.factura !== undefined && fileData.factura !== '' && fileData.factura !== 0 && fileData.factura !== '0'
      ? String(fileData.factura).trim()
      : null;
    const normalizedRut = fileData.customerRut ? String(fileData.customerRut).trim() : null;
    const params = [
      fileData.pc,
      normalizedOc || null,
      normalizedFactura,
      normalizedRut,
      fileData.name,
      fileData.path,
      nextIdentifier,
      fileData.file_id || null
    ];

    const [result] = await pool.query(query, params);
    logger.info(`[createDefaultRecords] Registro insertado pc=${fileData.pc} oc=${fileData.oc || 'N/A'} factura=${fileData.factura || 'N/A'} rut=${normalizedRut || 'N/A'} doc=${fileData.name}`);
    await logDocumentEvent({
      source: 'cron',
      action: 'create_record',
      process: 'createDefaultRecords',
      fileId: result.insertId,
      docType: fileData.name,
      pc: fileData.pc,
      oc: fileData.oc,
      factura: fileData.factura,
      customerRut: fileData.customerRut || null,
      userId: null,
      status: 'ok'
    });
    return result;
    
  } catch (error) {
    logger.error(`[createDefaultRecords] Error insertando registro ${fileData.name} pc=${fileData.pc}: ${error.message}`);
    
    // Registrar evento de error
    await logDocumentEvent({
      source: 'cron',
      action: 'create_record',
      process: 'createDefaultRecords',
      fileId: null,
      docType: fileData.name,
      pc: fileData.pc,
      oc: fileData.oc,
      factura: fileData.factura,
      customerRut: fileData.customerRut || null,
      userId: null,
      status: 'error',
      message: error.message
    });
    
    throw error;
  }
}

/**
 * Crea el directorio físico para el cliente y orden
 * @param {string} customerName - Nombre del cliente
 * @param {string} pc - Número PC de la orden
 * @returns {Promise<string|null>} Ruta del directorio creado o null si hay error
 */
async function createClientDirectory(customerName, pc) {
  try {
    const fileServerRoot = process.env.FILE_SERVER_ROOT || '/var/www/html';
    
    if (!fileServerRoot) {
      logger.error('[createDefaultRecords] FILE_SERVER_ROOT no está configurado en .env');
      return null;
    }

    // Limpiar nombre del cliente para usar como nombre de directorio
    const cleanCustomerName = cleanDirectoryName(customerName);

    // Crear ruta RELATIVA: uploads/CLIENTE_NOMBRE/Numero PC
    const relativePath = path.join('uploads', cleanCustomerName, pc);
    
    // Crear ruta COMPLETA para verificar/crear el directorio físico
    const fullPath = path.join(fileServerRoot, relativePath);
    
    // Verificar si el directorio ya existe
    try {
      await fs.access(fullPath);
      return relativePath; // Retornar ruta RELATIVA
    } catch (accessError) {
      // El directorio no existe, crearlo
    }
    
    // Crear directorio y subdirectorios si no existen
    await fs.mkdir(fullPath, { recursive: true });
    return relativePath; // Retornar ruta RELATIVA
    
  } catch (error) {
    logger.error(`[createDefaultRecords] Error creando directorio para cliente ${customerName}, pc=${pc}: ${error.message}`);
    logger.error(`[createDefaultRecords] Stack: ${error.stack}`);
    return null;
  }
}

/**
 * Actualiza la factura de un Order Receipt Notice existente que tiene factura=NULL
 * Esto ocurre cuando una orden inicialmente sin factura ahora tiene factura asignada
 * @param {string} pc - Número PC
 * @param {string} oc - Número OC
 * @param {string} factura - Número de factura a asignar
 * @returns {Promise<boolean>} true si se actualizó algún registro
 */
async function updateOrderReceiptNoticeFactura(pc, oc, factura) {
  const pool = await poolPromise;
  
  try {
    const normalizedPc = String(pc).trim();
    const normalizedFactura = String(factura).trim();
    
    // Buscar ORN con factura=NULL para este PC (sin OC, ya que el ORN es por PC)
    const query = `
      UPDATE order_files 
      SET factura = ?, updated_at = NOW()
      WHERE TRIM(COALESCE(pc, '')) = ? 
        AND file_id = 9
        AND (factura IS NULL OR factura = '' OR factura = 0 OR factura = '0')
    `;
    
    const [result] = await pool.query(query, [normalizedFactura, normalizedPc]);
    
    if (result.affectedRows > 0) {
      logger.info(`[createDefaultRecords] ORN actualizado con factura pc=${normalizedPc} factura=${normalizedFactura} rows=${result.affectedRows}`);
      return true;
    }
    
    return false;
    
  } catch (error) {
    logger.error(`[createDefaultRecords] Error actualizando ORN con factura pc=${pc}: ${error.message}`);
    throw error;
  }
}

module.exports = { createDefaultRecords };
