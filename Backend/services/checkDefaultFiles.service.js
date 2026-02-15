const { poolPromise } = require('../config/db');
const { getAllOrdersGroupedByRut, getNextFileIdentifier } = require('./file.service');
const { getCustomerByRut } = require('./customer.service');
const fs = require('fs').promises;
const path = require('path');
const { cleanDirectoryName } = require('../utils/directoryUtils');
// Las variables de entorno ya se cargan automáticamente en app.js

async function generateDefaultFiles() {
  try {
    console.log('Iniciando generación de documentos por defecto...');
    
    // Obtener todas las órdenes agrupadas por RUT
    const ordersByRut = await getAllOrdersGroupedByRut();
    const totalClients = Object.keys(ordersByRut).length;
    
    if (totalClients === 0) {
      console.log(`No hay órdenes para procesar`);
      return;
    }
    
    let totalFilesCreated = 0;
    let totalOrdersProcessed = 0;
    let totalDirectoriesCreated = 0;
    
    // Procesar clientes en lotes para evitar problemas de memoria
    const clientEntries = Object.entries(ordersByRut);
    const batchSize = 10; // Lotes más pequeños para clientes
    const totalBatches = Math.ceil(clientEntries.length / batchSize);
    
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
            const existingFiles = await checkExistingFiles(order.id, order.pc, order.oc);
            // Determinar ruta base: usar la existente si hay archivos previos
            let directoryPath = existingFiles[0]?.path;

            // Crear directorio físico en el servidor de archivos si no existen registros previos
            if (!directoryPath) {
              directoryPath = await createClientDirectory(customer.name, order.pc);
              if (!directoryPath) {
                console.log(`[${new Date().toISOString()}] -> Check Default Files Process -> Error creando directorio para orden ${order.id}, omitiendo`);
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
            const hasFactura = order.factura !== null && order.factura !== undefined && order.factura !== '' && order.factura !== 0 && order.factura !== '0';

            // Determinar documentos requeridos según estado de factura
            const requiredDocs = hasFactura
              ? [
                  'Shipment Notice',
                  'Order Delivery Notice',
                  'Availability Notice'
                ]
              : [
                  'Order Receipt Notice'
                ];

            // Filtrar los que ya existen (usar file_id para evitar duplicados cuando cambia el nombre)
            const existingFileIds = new Set(existingFiles.map(f => f.file_id).filter(Boolean));
            const documentsToCreate = requiredDocs
              .filter(name => !existingFileIds.has(FILE_ID_MAP[name]))
              .map(name => ({
                name,
                pc: order.pc,
                oc: order.oc,
                path: directoryPath,
                file_id: FILE_ID_MAP[name]
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
                console.error(`[${new Date().toISOString()}] -> Check Default Files Process -> Error insertando ${doc.name} para PC ${order.pc}:`, insertError.message);
              }
            }
            
            totalOrdersProcessed++;
            
          } catch (orderError) {
            console.error(`Error procesando orden ${order.id}:`, orderError.message);
          }
        }
      }
    }
    
    console.log(`Documentos generados: ${totalFilesCreated} archivos, ${totalOrdersProcessed} órdenes, ${totalDirectoriesCreated} directorios`);
    
  } catch (error) {
    console.error(`[${new Date().toISOString()}] -> Check Default Files Process -> Error en generación de documentos por defecto:`, error.message);
    console.error(`   Stack: ${error.stack}`);
    throw error;
  }
}

async function checkExistingFiles(orderId, pc, oc) {
  const pool = await poolPromise;
  
  try {
    const normalizedPc = pc == null ? '' : String(pc).trim();
    const normalizedOc = oc == null ? '' : String(oc).toUpperCase().replace(/[\s-]+/g, '');
    const query = normalizedOc
      ? `SELECT f.* FROM order_files f WHERE TRIM(COALESCE(f.pc, '')) = ? AND REPLACE(REPLACE(UPPER(COALESCE(f.oc, '')), ' ', ''), '-', '') = ?`
      : `SELECT f.* FROM order_files f WHERE TRIM(COALESCE(f.pc, '')) = ? AND (f.oc IS NULL OR TRIM(f.oc) = '')`;
    const params = normalizedOc ? [normalizedPc, normalizedOc] : [normalizedPc];
    console.log(`[${new Date().toISOString()}] -> Check Default Files Process -> checkExistingFiles query: ${query} params=${JSON.stringify(params)}`);
    const [rows] = await pool.query(query, params);
    
    return rows;
    
  } catch (error) {
    console.error(`[${new Date().toISOString()}] -> Check Default Files Process -> Error verificando archivos existentes para PC ${pc}:`, error.message);
    console.error(`[${new Date().toISOString()}] -> Check Default Files Process -> Stack completo:`, error.stack);
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
        pc, oc, name, path, file_identifier, file_id, was_sent, 
        document_type, file_type, status_id, is_visible_to_client, 
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, 'PDF', 1, 0, NOW(), NOW())
    `;

    const nextIdentifier = await getNextFileIdentifier(fileData.pc);
    if (!nextIdentifier) {
      throw new Error(`No se pudo generar file_identifier para PC ${fileData.pc}`);
    }
    const params = [
      fileData.pc,
      normalizedOc || null,
      fileData.name,
      fileData.path,
      nextIdentifier,
      fileData.file_id || null
    ];

    const [result] = await pool.query(query, params);
    console.log(`[${new Date().toISOString()}] -> Check Default Files Process -> Archivo por defecto insertado: ${fileData.name} para PC ${fileData.pc}`);
    return result;
    
  } catch (error) {
    console.error(`[${new Date().toISOString()}] -> Check Default Files Process -> Error insertando archivo por defecto ${fileData.name} para PC ${fileData.pc}:`, error.message);
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
      console.error('FILE_SERVER_ROOT no está configurado en .env');
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
    console.error(`[${new Date().toISOString()}] -> Check Default Files Process -> Error creando directorio para cliente ${customerName}, PC ${pc}:`);
    console.error(`   Error: ${error.message}`);
    console.error(`   Stack: ${error.stack}`);
    return null;
  }
}

module.exports = { generateDefaultFiles }; 
