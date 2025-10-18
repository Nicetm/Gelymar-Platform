const { poolPromise } = require('../config/db');
const { getAllOrdersGroupedByRut, getNextFolderId } = require('./file.service');
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
            
            // Verificar si ya existen documentos por defecto para esta orden
            // Si existe al menos un registro, NO crear ni registros en BD ni directorio
            const existingFiles = await checkExistingFiles(order.id, order.pc);
            if (existingFiles.length > 0) {
              totalOrdersProcessed++;
              continue;
            }

            // Crear directorio físico en el servidor de archivos SOLO si no existen registros
            const directoryPath = await createClientDirectory(customer.name, order.pc);
            if (!directoryPath) {
              console.log(`[${new Date().toISOString()}] -> Check Default Files Process -> Error creando directorio para orden ${order.id}, omitiendo`);
              continue;
            }
            totalDirectoriesCreated++;

            // Crear los cuatro documentos por defecto
            const defaultDocuments = [
              {
                name: 'Order Receipt Advice',
                order_id: order.id,
                pc: order.pc,
                oc: order.oc,
                path: directoryPath
              },
              {
                name: 'Shipment Advice',
                order_id: order.id,
                pc: order.pc,
                oc: order.oc,
                path: directoryPath
              },
              {
                name: 'Order Delivery Advice',
                order_id: order.id,
                pc: order.pc,
                oc: order.oc,
                path: directoryPath
              },
              {
                name: 'Availability Advice',
                order_id: order.id,
                pc: order.pc,
                oc: order.oc,
                path: directoryPath
              }
            ];
            
            // Insertar los documentos
            for (const doc of defaultDocuments) {
              try {
                await insertDefaultFile(doc);
                totalFilesCreated++;
              } catch (insertError) {
                console.error(`[${new Date().toISOString()}] -> Check Default Files Process -> Error insertando ${doc.name} para orden ${order.id}:`, insertError.message);
              }
            }
            
            totalOrdersProcessed++;
            
          } catch (orderError) {
            console.error(`Error procesando orden ${order.id}:`, orderError.message);
          }
        }
      }
    }
    
    console.log(`✅ Documentos generados: ${totalFilesCreated} archivos, ${totalOrdersProcessed} órdenes, ${totalDirectoriesCreated} directorios`);
    
  } catch (error) {
    console.error(`[${new Date().toISOString()}] -> Check Default Files Process -> Error en generación de documentos por defecto:`, error.message);
    console.error(`   Stack: ${error.stack}`);
    throw error;
  }
}

async function checkExistingFiles(orderId, pc) {
  const pool = await poolPromise;
  
  try {
    const [rows] = await pool.query(`
      SELECT f.* FROM order_files f 
      WHERE f.order_id = ? AND f.pc = ?
    `, [orderId, pc]);
    
    return rows;
    
  } catch (error) {
    console.error(`[${new Date().toISOString()}] -> Check Default Files Process -> Error verificando archivos existentes para orden ${orderId}:`, error.message);
    console.error(`[${new Date().toISOString()}] -> Check Default Files Process -> Stack completo:`, error.stack);
    // Si hay error, retornar array vacío para que continúe el proceso
    return [];
  }
}

async function insertDefaultFile(fileData) {
  const pool = await poolPromise;
  
  try {
    const query = `
      INSERT INTO order_files (
        order_id, pc, oc, name, path, eta, etd, was_sent, 
        document_type, file_type, status_id, is_visible_to_client, 
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, 'PDF', 1, 0, NOW(), NOW())
    `;

    const params = [
      fileData.order_id, // Usar el order_id real
      fileData.pc,
      fileData.oc,
      fileData.name,
      fileData.path
    ];

    const [result] = await pool.query(query, params);
    console.log(`[${new Date().toISOString()}] -> Check Default Files Process -> Archivo por defecto insertado: ${fileData.name} para orden ${fileData.order_id}`);
    return result;
    
  } catch (error) {
    console.error(`[${new Date().toISOString()}] -> Check Default Files Process -> Error insertando archivo por defecto ${fileData.name} para orden ${fileData.order_id}:`, error.message);
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
