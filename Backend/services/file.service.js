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
  status_id = 1,
  is_generated = 1,
  is_visible_to_customer = null,
}) => {
  
  const pool = await poolPromise;
  const [rows] = await pool.query('SELECT id FROM customers WHERE uuid = ?', [customer_id]);

  if (rows.length === 0) {
    throw new Error('Cliente no encontrado');
  }
  
  const realCustomerId = rows[0].id;
  const visibleValue = (() => {
    if (is_visible_to_customer === null || is_visible_to_customer === undefined || is_visible_to_customer === '') {
      return null;
    }

    if (typeof is_visible_to_customer === 'boolean') {
      return is_visible_to_customer ? 1 : 0;
    }

    if (typeof is_visible_to_customer === 'number') {
      return is_visible_to_customer === 0 ? 0 : 1;
    }

    const normalized = String(is_visible_to_customer).trim().toLowerCase();
    if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
      return 1;
    }
    if (normalized === 'false' || normalized === '0' || normalized === 'no') {
      return 0;
    }

    return null;
  })();

  const [result] = await pool.query(
    `INSERT INTO order_files (
      order_id, pc, oc, name, path, file_identifier,
      created_at, updated_at, was_sent, 
      document_type, file_type, status_id, is_generated, is_visible_to_client
    ) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW(), ?, ?, ?, ?, ?, ?)`,
    [
      order_id, pc, oc, name, path, file_identifier,
      was_sent, document_type, file_type, status_id, is_generated, visibleValue
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

  let sql = 'UPDATE order_files SET name = ?, updated_at = NOW()';
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
  const [rows] = await pool.query('SELECT path FROM order_files WHERE id = ?', [id]);
  if (rows.length === 0) return false;

  // Eliminar de la BD
  await pool.query('DELETE FROM order_files WHERE id = ?', [id]);

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
        o.oc,
        f.fecha_generacion,
        f.fecha_envio,
        f.fecha_reenvio
     FROM order_files f
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
    FROM order_files f
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
      c.id AS customer_id,
      c.name AS customer_name, 
      c.country,
      cc.primary_email AS customer_email,
      cl.lang,
      f.fecha_generacion,
      f.fecha_envio,
      f.fecha_reenvio,
      cc.contact_email AS contact_email_json
    FROM order_files f
    JOIN orders fd ON f.order_id = fd.id
    JOIN customers c ON fd.customer_id = c.id
    JOIN country_lang cl on c.country = cl.country
    LEFT JOIN customer_contacts cc ON c.id = cc.customer_id
    WHERE f.id = ?
  `, [id]);

  if (rows.length === 0) return null;

  const file = rows[0];
  
  // Parsear contact_email JSON y extraer emails
  let contactEmails = [];
  if (file.contact_email_json) {
    try {
      const contacts = typeof file.contact_email_json === 'string' 
        ? JSON.parse(file.contact_email_json) 
        : file.contact_email_json;
      
      if (Array.isArray(contacts)) {
        contactEmails = contacts
          .map(contact => contact.email)
          .filter(email => email && email.trim());
      }
    } catch (error) {
      console.error('Error parseando contact_email:', error);
    }
  }
  
  file.contact_emails = contactEmails.join(',');
  delete file.contact_email_json;
  
  return file;
}

const updateFile = async(data) => {
  const pool = await poolPromise;
  
  // Construir la query dinámicamente basada en los campos proporcionados
  const fields = [];
  const values = [];
  
  if (data.status_id !== undefined) {
    fields.push('status_id = ?');
    values.push(data.status_id);
  }
  
  if (data.is_visible_to_client !== undefined) {
    fields.push('is_visible_to_client = ?');
    values.push(data.is_visible_to_client);
  }
  
  if (data.updated_at !== undefined) {
    fields.push('updated_at = ?');
    values.push(data.updated_at);
  }
  
  if (data.path !== undefined) {
    fields.push('path = ?');
    values.push(data.path);
  }
  
  if (data.fecha_generacion !== undefined) {
    fields.push('fecha_generacion = ?');
    values.push(data.fecha_generacion);
  }
  
  if (data.fecha_envio !== undefined) {
    fields.push('fecha_envio = ?');
    values.push(data.fecha_envio);
  }
  
  if (data.fecha_reenvio !== undefined) {
    fields.push('fecha_reenvio = ?');
    values.push(data.fecha_reenvio);
  }
  
  // Siempre establecer file_type como PDF si se está actualizando
  fields.push('file_type = ?');
  values.push('PDF');
  
  // Agregar el ID al final
  values.push(data.id);
  
  const query = `UPDATE order_files SET ${fields.join(', ')} WHERE id = ?`;
  await pool.query(query, values);
}

const duplicateFile = async (fileId, newPath = null) => {

  const pool = await poolPromise;

  // Leer el registro original
  const [rows] = await pool.query(`SELECT * FROM order_files WHERE id = ?`, [fileId]);
  if (rows.length === 0) throw new Error('Archivo original no encontrado');

  const file = rows[0];

  // Usar el nuevo path si se proporciona, sino usar el original
  const pathToUse = newPath || file.path;

  // Insertar el nuevo registro duplicado
  const [result] = await pool.query(`
    INSERT INTO order_files (
      order_id, pc, oc, name, path, file_identifier,
      created_at, updated_at, was_sent, 
      document_type, file_type, status_id, is_visible_to_client,
      fecha_generacion, fecha_envio
    ) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW(), ?, ?, ?, ?, ?, ?, ?)`,
    [
      file.order_id, file.pc, file.oc, file.name, pathToUse, file.file_identifier,
      true, file.document_type, file.file_type, 4, file.is_visible_to_client,
      file.fecha_generacion, file.fecha_envio
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
  const [rows] = await pool.query('SELECT MAX(order_id) as max_order_id FROM order_files');
  const maxOrderId = rows[0].max_order_id || 4800; // Si no hay registros, empezar en 4800
  
  return maxOrderId + 1;
};

/**
 * Obtiene todos los archivos
 * @returns {Promise<Array>}
 */
const getAllFiles = async () => {
  const pool = await poolPromise;
  const [rows] = await pool.query('SELECT * FROM order_files ORDER BY created_at DESC');
  return rows;
};

/**
 * Obtiene archivos por order_id
 * @param {number} orderId - ID del order
 * @returns {Promise<Array>}
 */
const getFilesByFolderId = async (orderId) => {
  const pool = await poolPromise;
  const [rows] = await pool.query('SELECT * FROM order_files WHERE order_id = ?', [orderId]);
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
        name: 'Order Receipt Notice',
        order_id: orderId,
        pc: pc,
        oc: oc,
        path: directoryPath,
        file_identifier: fileIdentifier
      },
      {
        name: 'Shipment Notice',
        order_id: orderId,
        pc: pc,
        oc: oc,
        path: directoryPath,
        file_identifier: fileIdentifier
      },
      {
        name: 'Order Delivery Notice',
        order_id: orderId,
        pc: pc,
        oc: oc,
        path: directoryPath,
        file_identifier: fileIdentifier
      },
      {
        name: 'Availability Notice',
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
      FROM order_files 
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
      INSERT INTO order_files (
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
    // Limpiar nombre del cliente para usar como nombre de directorio
    const cleanCustomerName = cleanDirectoryName(customerName);

    // Crear ruta del directorio: uploads/CLIENTE_NOMBRE/Numero PC_Identificador
    const directoryPath = path.join('uploads', cleanCustomerName, `${pc}_${fileIdentifier}`);
    
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

// Función para obtener email del cliente por order_id
const getCustomerEmailByOrderId = async (orderId) => {
  try {
    const pool = await poolPromise;
    const [rows] = await pool.query(`
      SELECT c.email 
      FROM customers c
      JOIN orders o ON c.id = o.customer_id
      WHERE o.id = ?
    `, [orderId]);
    
    return rows[0]?.email || null;
  } catch (error) {
    console.error('Error obteniendo email del cliente:', error);
    return null;
  }
};

// Función para marcar archivo como visible al cliente
const markFileAsVisibleToClient = async (fileId) => {
  try {
    const pool = await poolPromise;
    await pool.query(
      'UPDATE order_files SET is_visible_to_client = 1 WHERE id = ?',
      [fileId]
    );
  } catch (error) {
    console.error('Error marcando archivo como visible:', error);
    throw error;
  }
};

// Función para obtener datos completos de la orden para PDF
const getOrderDataForPDF = async (orderId) => {
  try {
    const pool = await poolPromise;
    const [rows] = await pool.query(`
      SELECT 
        o.*,
        c.name as customer_name,
        c.email as customer_email,
        c.rut as customer_rut,
        c.address as customer_address,
        c.city as customer_city,
        c.country as customer_country,
        od.*
      FROM orders o
      JOIN customers c ON o.customer_id = c.id
      LEFT JOIN order_detail od ON o.id = od.order_id
      WHERE o.id = ?
    `, [orderId]);
    
    return rows[0] || null;
  } catch (error) {
    console.error('Error obteniendo datos de la orden para PDF:', error);
    return null;
  }
};

// Función para crear archivos por defecto si no existen
const createDefaultFilesIfNotExist = async (orderId) => {
  try {
    // Verificar si ya existen archivos para esta orden
    const existingFiles = await getFilesByFolderId(orderId);
    if (existingFiles.length > 0) {
      return existingFiles;
    }

    // Obtener información de la orden y cliente
    const pool = await poolPromise;
    const [[order]] = await pool.query(`
      SELECT o.*, c.name as customer_name 
      FROM orders o
      JOIN customers c ON o.customer_id = c.id
      WHERE o.id = ?
    `, [orderId]);

    if (!order) {
      throw new Error('Orden no encontrada');
    }

    // Crear archivos por defecto usando la función existente
    const result = await createDefaultFilesForOrder(
      orderId,
      order.customer_name,
      order.pc,
      order.oc
    );

    return result.files;
  } catch (error) {
    console.error(`Error creando archivos por defecto para orden ${orderId}:`, error.message);
    throw error;
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
  getNextFileIdentifier,
  getCustomerEmailByOrderId,
  markFileAsVisibleToClient,
  getOrderDataForPDF,
  createDefaultFilesIfNotExist
};
