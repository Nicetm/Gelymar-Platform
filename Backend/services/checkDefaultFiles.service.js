const { poolPromise } = require('../config/db');
const { getAllOrdersGroupedByRut, getNextFileIdentifier } = require('./file.service');
const { getCustomerByRut } = require('./customer.service');
const fs = require('fs').promises;
const path = require('path');
const { cleanDirectoryName } = require('../utils/directoryUtils');
const { logger } = require('../utils/logger');
const { logDocumentEvent } = require('./documentEvent.service');
// Las variables de entorno ya se cargan automáticamente en app.js

async function generateDefaultFiles(filters = {}) {
  try {
    const { pc, factura, idNroOvMasFactura } = filters || {};
    const normalizedFilterPc = pc ? String(pc).trim() : null;
    const normalizedFilterId = idNroOvMasFactura ? String(idNroOvMasFactura).trim() : null;
    const normalizedFilterFactura = !normalizedFilterId && factura ? String(factura).trim() : null;
    const parts = [];
    if (normalizedFilterPc) parts.push(`pc=${normalizedFilterPc}`);
    if (normalizedFilterId) parts.push(`id=${normalizedFilterId}`);
    if (!normalizedFilterId && normalizedFilterFactura) parts.push(`factura=${normalizedFilterFactura}`);
    logger.info(`[checkDefaultFiles] Iniciando generación de documentos por defecto${parts.length ? ` ${parts.join(' ')}` : ''}`);
    
    // Obtener todas las órdenes agrupadas por RUT
    const ordersByRut = await getAllOrdersGroupedByRut();
    const totalClients = Object.keys(ordersByRut).length;
    
    if (totalClients === 0) {
      logger.info('[checkDefaultFiles] No hay órdenes para procesar');
      return;
    }
    
    let totalFilesCreated = 0;
    let totalOrdersProcessed = 0;
    let totalDirectoriesCreated = 0;
    const { normalizeOcForCompare: normalizeOcKey } = require('../utils/oc.util');

    
    const shipmentIncoterms = new Set(['CFR', 'CIF', 'CIP', 'DAP', 'DDP', 'CPT']);
    const availabilityIncoterms = new Set([
      'EWX',
      'FCA',
      'FOB',
      'FCA PORT',
      'FCA WAREHOUSE SANTIAGO',
      'FCA AIRPORT',
      'FCAWSTGO'
    ]);
    const hasFacturaValue = (value) => (
      value !== null &&
      value !== undefined &&
      value !== '' &&
      value !== 0 &&
      value !== '0'
    );
    const isInList = (list, value) => list.has(String(value || '').trim().toUpperCase());
    const canCreateShipment = (order) => (
      hasFacturaValue(order.factura) &&
      isInList(shipmentIncoterms, order.incoterm) &&
      !!order.fecha_etd_factura &&
      !!order.fecha_eta_factura
    );
    const canCreateDelivery = (order) => (
      hasFacturaValue(order.factura) &&
      !!order.fecha_eta_factura
    );
    const canCreateAvailability = (order) => (
      hasFacturaValue(order.factura) &&
      isInList(availabilityIncoterms, order.incoterm)
    );

    // Procesar clientes en lotes para evitar problemas de memoria
    let clientEntries = Object.entries(ordersByRut);
    if (normalizedFilterPc || normalizedFilterId || normalizedFilterFactura) {
      clientEntries = clientEntries
        .map(([rut, orders]) => {
          const filtered = orders.filter((order) => {
            if (normalizedFilterPc && String(order.pc || '').trim() !== normalizedFilterPc) return false;
            if (normalizedFilterId) {
              return String(order.id_nro_ov_mas_factura || '').trim() === normalizedFilterId;
            }
            if (normalizedFilterFactura) {
              return String(order.factura || '').trim() === normalizedFilterFactura;
            }
            return true;
          });
          return [rut, filtered];
        })
        .filter(([, orders]) => orders.length > 0);
    }
    if (clientEntries.length === 0) {
      logger.info(`[checkDefaultFiles] No hay órdenes para procesar${parts.length ? ` (${parts.join(' ')})` : ''}`);
      return;
    }

    const batchSize = 10; // Lotes más pequeños para clientes
    const totalBatches = Math.ceil(clientEntries.length / batchSize);

    const partialKeyCount = new Map();
    const partialKeyMinDate = new Map();
    clientEntries.forEach(([, orders]) => {
      orders.forEach((order) => {
        const key = order.id_nro_ov_mas_factura
          ? String(order.id_nro_ov_mas_factura).trim()
          : `${String(order.pc || '').trim()}|${normalizeOcKey(order.oc)}`;
        partialKeyCount.set(key, (partialKeyCount.get(key) || 0) + 1);
        const orderDate = order.created_at ? new Date(order.created_at) : null;
        if (orderDate && !Number.isNaN(orderDate.getTime())) {
          const currentMin = partialKeyMinDate.get(key);
          if (!currentMin || orderDate < currentMin) {
            partialKeyMinDate.set(key, orderDate);
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
            
            // Verificar si ya existen documentos para esta orden
            const existingFiles = await checkExistingFiles(
              order.id,
              order.pc,
              order.oc,
              order.factura,
              order.id_nro_ov_mas_factura
            );
            // Determinar ruta base: usar la existente si hay archivos previos
            let directoryPath = existingFiles[0]?.path;

            // Crear directorio físico en el servidor de archivos si no existen registros previos
            if (!directoryPath) {
              directoryPath = await createClientDirectory(customer.name, order.pc);
              if (!directoryPath) {
                logger.warn(`[checkDefaultFiles] Error creando directorio para orden ${order.id}, omitiendo`);
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
            const hasFactura = hasFacturaValue(order.factura);
            const partialKey = order.id_nro_ov_mas_factura
              ? String(order.id_nro_ov_mas_factura).trim()
              : `${String(order.pc || '').trim()}|${normalizeOcKey(order.oc)}`;
            const hasPartial = (partialKeyCount.get(partialKey) || 0) > 1;
            const orderDate = order.created_at ? new Date(order.created_at) : null;
            const minDate = partialKeyMinDate.get(partialKey) || null;
            const isParent =
              !hasPartial ||
              (orderDate && minDate && !Number.isNaN(orderDate.getTime()) && orderDate.getTime() === minDate.getTime());

            // Determinar documentos requeridos según estado de factura
            const requiredDocs = hasPartial
              ? (isParent && !hasFactura
                ? ['Order Receipt Notice']
                : ['Shipment Notice', 'Order Delivery Notice', 'Availability Notice'])
              : hasFactura
                ? ['Shipment Notice', 'Order Delivery Notice', 'Availability Notice']
                : ['Order Receipt Notice'];

            // Filtrar los que ya existen (usar file_id para evitar duplicados cuando cambia el nombre)
            const existingFileIds = new Set(existingFiles.map(f => f.file_id).filter(Boolean));
            const documentsToCreate = requiredDocs
              .filter(name => !existingFileIds.has(FILE_ID_MAP[name]))
              .filter((name) => {
                if (name === 'Shipment Notice') {
                  return canCreateShipment(order);
                }
                if (name === 'Order Delivery Notice') {
                  return canCreateDelivery(order);
                }
                if (name === 'Availability Notice') {
                  return canCreateAvailability(order);
                }
                return true;
              })
              .map(name => ({
                name,
                pc: order.pc,
                oc: order.oc,
                path: directoryPath,
                file_id: FILE_ID_MAP[name],
                factura: order.factura,
                id_nro_ov_mas_factura: order.id_nro_ov_mas_factura,
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
                logger.error(`[checkDefaultFiles] Error insertando ${doc.name} pc=${order.pc} oc=${order.oc || 'N/A'} factura=${order.factura || 'N/A'} id=${order.id_nro_ov_mas_factura || 'N/A'}: ${insertError.message}`);
              }
            }
            
            totalOrdersProcessed++;
            
          } catch (orderError) {
            logger.error(`[CheckDefaultFilesService] Error procesando orden ${order.id}: ${orderError.message}`);
          }
        }
      }
    }
    
    logger.info(`[checkDefaultFiles] Documentos generados: files=${totalFilesCreated} orders=${totalOrdersProcessed} dirs=${totalDirectoriesCreated}`);
    
  } catch (error) {
    logger.error(`[checkDefaultFiles] Error en generación de documentos por defecto: ${error.message}`);
    logger.error(`[checkDefaultFiles] Stack: ${error.stack}`);
    throw error;
  }
}

async function checkExistingFiles(orderId, pc, oc, factura = null, idNroOvMasFactura = null) {
  const pool = await poolPromise;
  
  try {
    const normalizedPc = pc == null ? '' : String(pc).trim();
    const normalizedOc = oc == null ? '' : String(oc).toUpperCase().replace(/[\s-]+/g, '');
    const normalizedFactura = factura !== null && factura !== undefined && factura !== '' && factura !== 0 && factura !== '0'
      ? String(factura).trim()
      : null;
    const normalizedId = idNroOvMasFactura ? String(idNroOvMasFactura).trim() : null;
    const idClause = normalizedId ? ' AND f.id_nro_ov_mas_factura = ?' : '';
    const facturaClause = normalizedFactura ? ' AND f.factura = ?' : " AND (f.factura IS NULL OR f.factura = '' OR f.factura = 0 OR f.factura = '0')";
    const query = normalizedOc
      ? `SELECT f.* FROM order_files f WHERE TRIM(COALESCE(f.pc, '')) = ? AND REPLACE(REPLACE(UPPER(COALESCE(f.oc, '')), ' ', ''), '-', '') = ?${facturaClause}${idClause}`
      : `SELECT f.* FROM order_files f WHERE TRIM(COALESCE(f.pc, '')) = ? AND (f.oc IS NULL OR TRIM(f.oc) = '')${facturaClause}${idClause}`;
    const params = normalizedOc
      ? (normalizedFactura ? [normalizedPc, normalizedOc, normalizedFactura] : [normalizedPc, normalizedOc])
      : (normalizedFactura ? [normalizedPc, normalizedFactura] : [normalizedPc]);
    if (normalizedId) {
      params.push(normalizedId);
    }
    const [rows] = await pool.query(query, params);
    
    return rows;
    
  } catch (error) {
    logger.error(`[checkDefaultFiles] Error verificando archivos existentes pc=${pc}: ${error.message}`);
    logger.error(`[checkDefaultFiles] Stack: ${error.stack}`);
    // Si hay error, retornar array vacío para que continúe el proceso
    return [];
  }
}

async function insertDefaultFile(fileData) {
  const pool = await poolPromise;
  
  try {
    const normalizedOc = fileData.oc == null ? '' : String(fileData.oc).trim();
    const query = `
      INSERT INTO order_files (
        pc, oc, factura, id_nro_ov_mas_factura, name, path, file_identifier, file_id, was_sent, 
        document_type, file_type, status_id, is_visible_to_client, 
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, 'PDF', 1, 0, NOW(), NOW())
    `;

    const nextIdentifier = await getNextFileIdentifier(fileData.pc);
    if (!nextIdentifier) {
      throw new Error(`No se pudo generar file_identifier para PC ${fileData.pc}`);
    }
    const normalizedFactura = fileData.factura !== null && fileData.factura !== undefined && fileData.factura !== '' && fileData.factura !== 0 && fileData.factura !== '0'
      ? String(fileData.factura).trim()
      : null;
    const normalizedId = fileData.id_nro_ov_mas_factura ? String(fileData.id_nro_ov_mas_factura).trim() : null;
    const params = [
      fileData.pc,
      normalizedOc || null,
      normalizedFactura,
      normalizedId,
      fileData.name,
      fileData.path,
      nextIdentifier,
      fileData.file_id || null
    ];

    const [result] = await pool.query(query, params);
    logger.info(`[checkDefaultFiles] Archivo por defecto insertado pc=${fileData.pc} oc=${fileData.oc || 'N/A'} factura=${fileData.factura || 'N/A'} doc=${fileData.name}`);
    await logDocumentEvent({
      source: 'cron',
      action: 'create_record',
      process: 'checkDefaultFiles',
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
    logger.error(`[checkDefaultFiles] Error insertando archivo por defecto ${fileData.name} pc=${fileData.pc}: ${error.message}`);
    
    // Registrar evento de error
    await logDocumentEvent({
      source: 'cron',
      action: 'create_record',
      process: 'checkDefaultFiles',
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
      logger.error('[CheckDefaultFilesService] FILE_SERVER_ROOT no está configurado en .env');
      return null;
    }

    // Limpiar nombre del cliente para usar como nombre de directorio
    const cleanCustomerName = cleanDirectoryName(customerName);

    // Crear ruta del directorio: /uploads/CLIENTE_NOMBRE/Numero PC
    const directoryPath = path.join(fileServerRoot, 'uploads', cleanCustomerName, pc);
    
    // Verificar si el directorio ya existe
    try {
      await fs.access(directoryPath);
      return directoryPath;
    } catch (accessError) {
      // El directorio no existe, crearlo
    }
    
    // Crear directorio y subdirectorios si no existen
    await fs.mkdir(directoryPath, { recursive: true });
      return directoryPath;
    
  } catch (error) {
    logger.error(`[CheckDefaultFilesService] Error creando directorio para cliente ${customerName}, pc=${pc}: ${error.message}`);
    logger.error(`[CheckDefaultFilesService] Stack: ${error.stack}`);
    return null;
  }
}

module.exports = { generateDefaultFiles }; 
