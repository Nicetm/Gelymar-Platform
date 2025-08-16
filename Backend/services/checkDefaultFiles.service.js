const { poolPromise } = require('../config/db');
const { getAllOrdersGroupedByRut, getNextFolderId } = require('./file.service');
const { getCustomerByRut } = require('./customer.service');
const fs = require('fs').promises;
const path = require('path');
const { cleanDirectoryName } = require('../utils/directoryUtils');
require('dotenv').config();

async function generateDefaultFiles() {
  try {
    console.log('Iniciando generación de documentos por defecto...');
    console.log(`FILE_SERVER_ROOT configurado: "${process.env.FILE_SERVER_ROOT}"`);
    
    // Obtener todas las órdenes agrupadas por RUT
    const ordersByRut = await getAllOrdersGroupedByRut();
    console.log(`Total de clientes con órdenes: ${Object.keys(ordersByRut).length}`);
    
    let totalFilesCreated = 0;
    let totalOrdersProcessed = 0;
    let totalDirectoriesCreated = 0;
    
    for (const [rut, orders] of Object.entries(ordersByRut)) {
      console.log(`Procesando cliente RUT: ${rut} con ${orders.length} órdenes`);
      
      for (const order of orders) {
        try {
          // Obtener información del cliente
          const customer = await getCustomerByRut(order.rut);
          if (!customer) {
            console.log(`Cliente no encontrado para RUT: ${order.rut}, omitiendo orden ${order.id}`);
            continue;
          }
          
          // Crear directorio físico en el servidor de archivos (siempre)
          const directoryPath = await createClientDirectory(customer.name, order.pc);
          if (!directoryPath) {
            console.log(`Error creando directorio para orden ${order.id}, omitiendo`);
            continue;
          }
          totalDirectoriesCreated++;
          
          // Verificar si ya existen los tres documentos para esta orden
          const existingFiles = await checkExistingFiles(order.id);
          
          if (existingFiles.length >= 3) {
            console.log(`Orden ${order.id} ya tiene documentos por defecto (${existingFiles.length} archivos), pero directorio creado: ${directoryPath}`);
            continue;
          }
          
          // Crear los tres documentos por defecto
          const defaultDocuments = [
            {
              name: 'Recepcion de orden',
              order_id: order.id, // Usar el ID real de la orden
              pc: order.pc,
              oc: order.oc,
              path: directoryPath
            },
            {
              name: 'Aviso de Embarque',
              order_id: order.id, // Usar el ID real de la orden
              pc: order.pc,
              oc: order.oc,
              path: directoryPath
            },
            {
              name: 'Aviso de Recepcion de orden',
              order_id: order.id, // Usar el ID real de la orden
              pc: order.pc,
              oc: order.oc,
              path: directoryPath
            }
          ];
          
          // Insertar los documentos
          for (const doc of defaultDocuments) {
            await insertDefaultFile(doc);
            totalFilesCreated++;
          }
          
          console.log(`Creados 3 documentos para orden ${order.id} (PC: ${order.pc}, OC: ${order.oc}) con order_id: ${order.id} en directorio: ${directoryPath}`);
          totalOrdersProcessed++;
          
        } catch (error) {
          console.error(`Error procesando orden ${order.id}:`, error.message);
        }
      }
    }
    
    console.log(`Proceso completado:`);
    console.log(`- Órdenes procesadas: ${totalOrdersProcessed}`);
    console.log(`- Directorios creados: ${totalDirectoriesCreated}`);
    console.log(`- Archivos creados: ${totalFilesCreated}`);
    
  } catch (error) {
    console.error('Error en generación de documentos por defecto:', error.message);
  }
}

async function checkExistingFiles(orderId) {
  const pool = await poolPromise;
  
  // Primero verificar si la tabla files existe
  try {
    const [rows] = await pool.query(`
      SELECT f.* FROM files f 
      WHERE f.order_id = ? AND f.name IN ('Recepcion de orden', 'Aviso de Embarque', 'Aviso de Recepcion de orden')
    `, [orderId]);
    return rows;
  } catch (error) {
    console.error(`Error verificando archivos existentes para orden ${orderId}:`, error.message);
    // Si hay error, retornar array vacío para que continúe el proceso
    return [];
  }
}

async function insertDefaultFile(fileData) {
  const pool = await poolPromise;
  
  const query = `
    INSERT INTO files (
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

  console.log(`Ejecutando INSERT en MySQL (files):`);
  console.log(`   Query: ${query}`);
  console.log(`   Params: [${params.map(p => `"${p}"`).join(', ')}]`);

  const [result] = await pool.query(query, params);
  
  console.log(`INSERT exitoso - ID insertado: ${result.insertId}`);
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
    
    console.log(`Intentando crear directorio: "${directoryPath}"`);
    
    // Verificar si el directorio ya existe
    try {
      await fs.access(directoryPath);
      console.log(`El directorio ya existe: ${directoryPath}`);
      return directoryPath;
    } catch (accessError) {
      console.log(`El directorio no existe, creando: ${directoryPath}`);
    }
    
    // Crear directorio y subdirectorios si no existen
    await fs.mkdir(directoryPath, { recursive: true });
    
    // Verificar que se creó correctamente
    try {
      await fs.access(directoryPath);
      console.log(`Directorio creado exitosamente: ${directoryPath}`);
      return directoryPath;
    } catch (verifyError) {
      console.error(`Error verificando directorio creado: ${directoryPath}`);
      return null;
    }
    
  } catch (error) {
    console.error(`Error creando directorio para cliente ${customerName}, PC ${pc}:`);
    console.error(`   Error: ${error.message}`);
    console.error(`   Stack: ${error.stack}`);
    return null;
  }
}

module.exports = { generateDefaultFiles }; 