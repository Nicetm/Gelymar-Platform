const { poolPromise } = require('../config/db');
const File = require('../models/file');
const fs = require('fs').promises;
const path = require('path');
const { cleanDirectoryName } = require('../utils/directoryUtils');

/**
 * Inserta un nuevo archivo en la base de datos
 * @param {Object} fileData - Datos del archivo a insertar
 * @returns {Object} Resultado de la inserción
 */
const insertFile = async ({
  customer_id,
  order_id,
  pc,
  oc,
  name,
  path,
  file_identifier = null,
  eta = null,
  etd = null,
  was_sent = false,
  document_type = null,
  file_type = 'PDF',
  status_id = 1
}) => {
  
  const pool = await poolPromise;
  const [rows] = await pool.query('SELECT id FROM customers WHERE uuid = ?', [customer_id]);

  if (rows.length === 0) {
    throw new Error('Cliente no encontrado');
  }
  
  const realCustomerId = rows[0].id;

  const [result] = await pool.query(
    `INSERT INTO files (
      order_id, pc, oc, name, path, file_identifier,
      created_at, updated_at, was_sent, 
      document_type, file_type, status_id
    ) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW(), ?, ?, ?, ?)`,
    [
      order_id, pc, oc, name, path, file_identifier,
      was_sent, document_type, file_type, status_id
    ]
  );
  return result;
};

/**
 * Renombra un archivo existente en la base de datos
 * @param {number} id 
 * @param {string} newName 
 * @returns 
 */
const RenameFile = async (id, newName, visible) => {
  const pool = await poolPromise;

  let sql = 'UPDATE files SET name = ?, updated_at = NOW()';
  const params = [newName];

  if (visible !== undefined && visible !== null && visible !== '') {
    sql += ', is_visible_to_client = ?';
    params.push(visible);
  }

  sql += ' WHERE id = ?';
  params.push(id);
  
  const [result] = await pool.query(sql, params);
  return result.affectedRows > 0;
}

/**
 * Elimina el archivo de la base de datos
 * @param {number} id
 * @returns {Promise<boolean>}
 */
const deleteFileById = async (id) => {
  const pool = await poolPromise;

  // Obtener la ruta del archivo antes de eliminar
  const [rows] = await pool.query('SELECT path FROM files WHERE id = ?', [id]);
  if (rows.length === 0) return false;

  // Eliminar de la BD
  await pool.query('DELETE FROM files WHERE id = ?', [id]);

  return true;
};

/**
 * Obtiene todos los archivos de una carpeta específica para un cliente
 * @param {number} customerId - ID interno del cliente
 * @param {number} folderId - ID de la carpeta
 * @returns {Array<Object>} Lista de archivos
 */
const getFiles = async (customerId, folderId) => {
  const pool = await poolPromise;
  const [rows] = await pool.query(
    `SELECT 
        f.*, 
        os.id AS status_id, 
        os.name AS status_name,
        o.pc,
        o.oc
     FROM files f
     LEFT JOIN order_status os ON f.status_id = os.id
     JOIN orders o ON f.order_id = o.id
     WHERE f.order_id = ?
     ORDER BY f.created_at DESC`,
    [folderId]
  );
  return rows.map(row => new File(row));
};

/**
 * Devuelve un mapa con el conteo de archivos por carpeta del cliente
 * @param {number} customerId - ID interno del cliente
 * @returns {Object} Mapa con folder_id como clave y cantidad de archivos como valor
 */
const getFileCountByCustomer = async (customerId) => {
  const pool = await poolPromise;

  const [rows] = await pool.query(`
    SELECT f.order_id, COUNT(*) AS fileCount
    FROM files f
    INNER JOIN orders o ON f.order_id = o.id
    WHERE o.customer_id = ?
    GROUP BY f.order_id
  `, [customerId]);

  const countMap = {};
  rows.forEach(row => {
    countMap[row.order_id] = row.fileCount;
  });

  return countMap;
};

const getFileById = async(id) => {
  const pool = await poolPromise;
  const [rows] = await pool.query(`
    SELECT 
      f.*, 
      c.name AS customer_name, 
      cc.primary_email AS customer_email,
      GROUP_CONCAT(cc.contact_email SEPARATOR ',') AS contact_emails
    FROM files f
    JOIN orders fd ON f.order_id = fd.id
    JOIN customers c ON fd.customer_id = c.id
    LEFT JOIN customer_contacts cc ON c.id = cc.customer_id
    WHERE f.id = ?
    GROUP BY f.id, c.name, cc.primary_email
  `, [id]);

  if (rows.length === 0) return null;

  return rows[0];
}

const updateFile = async(data) => {
  const pool = await poolPromise;
  await pool.query(`
    UPDATE files 
    SET status_id = ?, updated_at = ?, path = ?, file_type = 'PDF'
    WHERE id = ?
  `, [data.status_id, data.updated_at, data.path, data.id]);
}

const duplicateFile = async (fileId) => {

  const pool = await poolPromise;

  console.log('Duplicando archivo con ID:', fileId);

  // Leer el registro original
  const [rows] = await pool.query(`SELECT * FROM files WHERE id = ?`, [fileId]);
  if (rows.length === 0) throw new Error('Archivo original no encontrado');

  const file = rows[0];

  // Insertar el nuevo registro duplicado
  const [result] = await pool.query(`
    INSERT INTO files (
      order_id, pc, oc, name, path, 
      created_at, updated_at, was_sent, 
      document_type, file_type, status_id, is_visible_to_client
    ) VALUES (?, ?, ?, ?, ?, NOW(), NOW(), ?, ?, ?, ?, ?, ?, ?)`,
    [
      file.order_id, file.pc, file.oc, file.name, file.path,
      file.eta, file.etd, true, file.document_type, file.file_type, 4, file.is_visible_to_client
    ]
  );

  return result.insertId;
};

/**
 * Obtiene todas las órdenes agrupadas por RUT
 * @returns {Promise<Object>} Objeto con RUT como clave y array de órdenes como valor
 */
const getAllOrdersGroupedByRut = async () => {
  const pool = await poolPromise;
  const [rows] = await pool.query(`
    SELECT id, rut, pc, oc, created_at 
    FROM orders 
    WHERE rut IS NOT NULL AND pc IS NOT NULL AND oc IS NOT NULL
    ORDER BY rut, created_at
  `);
  
  // Agrupar por RUT
  const ordersByRut = {};
  rows.forEach(order => {
    if (!ordersByRut[order.rut]) {
      ordersByRut[order.rut] = [];
    }
    ordersByRut[order.rut].push(order);
  });
  
  return ordersByRut;
};

/**
 * Obtiene el siguiente order_id disponible
 * @returns {Promise<number>} El siguiente order_id
 */
const getNextFolderId = async () => {
  const pool = await poolPromise;
  
  // Obtener el máximo order_id actual
  const [rows] = await pool.query('SELECT MAX(order_id) as max_order_id FROM files');
  const maxOrderId = rows[0].max_order_id || 4800; // Si no hay registros, empezar en 4800
  
  return maxOrderId + 1;
};

/**
 * Obtiene todos los archivos
 * @returns {Promise<Array>}
 */
const getAllFiles = async () => {
  const pool = await poolPromise;
  const [rows] = await pool.query('SELECT * FROM files ORDER BY created_at DESC');
  return rows;
};

/**
 * Obtiene archivos por order_id
 * @param {number} orderId - ID del order
 * @returns {Promise<Array>}
 */
const getFilesByFolderId = async (orderId) => {
  const pool = await poolPromise;
  const [rows] = await pool.query('SELECT * FROM files WHERE order_id = ?', [orderId]);
  return rows;
};

/**
 * Crea archivos por defecto para una orden específica
 * @param {number} orderId - ID de la orden
 * @param {string} customerName - Nombre del cliente
 * @param {string} pc - Número PC
 * @param {string} oc - Número OC
 * @returns {Promise<Object>} Resultado de la operación
 */
const createDefaultFilesForOrder = async (orderId, customerName, pc, oc) => {
  try {
    // Verificar si ya existen archivos para esta orden
    const existingFiles = await getFilesByFolderId(orderId);
    if (existingFiles.length > 0) {
      throw new Error('Ya existen archivos para esta orden');
    }

    // Generar identificador único para esta fila (incrementador)
    const fileIdentifier = await getNextFileIdentifier(pc);

    // Crear directorio físico
    const directoryPath = await createClientDirectory(customerName, pc, fileIdentifier);
    if (!directoryPath) {
      throw new Error('Error creando directorio físico');
    }

    // Definir los 4 archivos por defecto
    const defaultDocuments = [
      {
        name: 'Recepcion de orden',
        order_id: orderId,
        pc: pc,
        oc: oc,
        path: directoryPath,
        file_identifier: fileIdentifier
      },
      {
        name: 'Aviso de Embarque',
        order_id: orderId,
        pc: pc,
        oc: oc,
        path: directoryPath,
        file_identifier: fileIdentifier
      },
      {
        name: 'Aviso de entrega',
        order_id: orderId,
        pc: pc,
        oc: oc,
        path: directoryPath,
        file_identifier: fileIdentifier
      },
      {
        name: 'Aviso de Disponibilidad de Orden',
        order_id: orderId,
        pc: pc,
        oc: oc,
        path: directoryPath,
        file_identifier: fileIdentifier
      }
    ];

    // Insertar los archivos en la base de datos
    const createdFiles = [];
    for (const doc of defaultDocuments) {
      const result = await insertDefaultFile(doc);
      createdFiles.push({
        id: result.insertId,
        name: doc.name,
        path: doc.path
      });
    }

    return {
      success: true,
      message: 'Archivos por defecto creados exitosamente',
      filesCreated: createdFiles.length,
      directoryPath: directoryPath,
      files: createdFiles
    };

  } catch (error) {
    console.error(`Error creando archivos por defecto para orden ${orderId}:`, error.message);
    throw error;
  }
};

/**
 * Obtiene el siguiente identificador único para un PC
 * @param {string} pc - Número PC
 * @returns {Promise<number>} Identificador único (ej: 1, 2, 3)
 */
const getNextFileIdentifier = async (pc) => {
  const pool = await poolPromise;
  
  try {
    // Buscar el último identificador usado para este PC
    const [rows] = await pool.query(`
      SELECT file_identifier 
      FROM files 
      WHERE pc = ? AND file_identifier IS NOT NULL
      ORDER BY file_identifier DESC 
      LIMIT 1
    `, [pc]);

    if (rows.length === 0) {
      // Si no hay archivos para este PC, empezar con 1
      return 1;
    }

    // El último identificador es un número, solo incrementarlo
    const lastIdentifier = rows[0].file_identifier;
    return lastIdentifier + 1;
    
  } catch (error) {
    console.error(`Error obteniendo siguiente identificador para PC ${pc}:`, error.message);
    // En caso de error, usar 1 como fallback
    return 1;
  }
};

/**
 * Inserta un archivo por defecto en la base de datos
 * @param {Object} fileData - Datos del archivo
 * @returns {Promise<Object>} Resultado de la inserción
 */
const insertDefaultFile = async (fileData) => {
  const pool = await poolPromise;
  
  try {
    const query = `
      INSERT INTO files (
        order_id, pc, oc, name, path, file_identifier, was_sent, 
        document_type, file_type, status_id, is_visible_to_client, 
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, 'PDF', 1, 0, NOW(), NOW())
    `;

    const params = [
      fileData.order_id,
      fileData.pc,
      fileData.oc,
      fileData.name,
      fileData.path,
      fileData.file_identifier
    ];

    const [result] = await pool.query(query, params);
    return result;
    
  } catch (error) {
    console.error(`Error insertando archivo por defecto ${fileData.name}:`, error.message);
    throw error;
  }
};

/**
 * Crea el directorio físico para el cliente y orden
 * @param {string} customerName - Nombre del cliente
 * @param {string} pc - Número PC de la orden
 * @param {string} fileIdentifier - Identificador único para diferenciar filas
 * @returns {Promise<string|null>} Ruta del directorio creado o null si hay error
 */
const createClientDirectory = async (customerName, pc, fileIdentifier) => {
  try {
    const fileServerRoot = process.env.FILE_SERVER_ROOT || '/var/www/html';
    
    if (!fileServerRoot) {
      console.error('FILE_SERVER_ROOT no está configurado en .env');
      return null;
    }

    // Limpiar nombre del cliente para usar como nombre de directorio
    const cleanCustomerName = cleanDirectoryName(customerName);

    // Crear ruta del directorio: /uploads/CLIENTE_NOMBRE/Numero PC_Identificador
    const directoryPath = path.join(fileServerRoot, 'uploads', cleanCustomerName, `${pc}_${fileIdentifier}`);
    
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
    console.error(`Error creando directorio para cliente ${customerName}, PC ${pc}:`, error.message);
    return null;
  }
};

module.exports = {
  RenameFile,
  getFileById,
  insertFile,
  getFiles,
  updateFile,
  getFileCountByCustomer,
  duplicateFile,
  deleteFileById,
  getAllOrdersGroupedByRut,
  getNextFolderId,
  getAllFiles,
  getFilesByFolderId,
  createDefaultFilesForOrder,
  insertDefaultFile,
  createClientDirectory,
  getNextFileIdentifier
};
