const { poolPromise } = require('../config/db');
const File = require('../models/file');

/**
 * Inserta un nuevo archivo en la base de datos
 * @param {Object} fileData - Datos del archivo a insertar
 * @returns {Object} Resultado de la inserción
 */
const insertFile = async ({
  customer_id,
  folder_id,
  name,
  path,
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
    return res.status(400).json({ message: 'Cliente no encontrado' });
  }
  
  const realCustomerId = rows[0].id;

  const [result] = await pool.query(
    `INSERT INTO files (
      folder_id, name, path, 
      created_at, updated_at, eta, etd, was_sent, 
      document_type, file_type, status_id
    ) VALUES (?, ?, ?, NOW(), NOW(), ?, ?, ?, ?, ?, ?)`,
    [
      folder_id, name, path,
      eta, etd, was_sent, document_type, file_type, status_id
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
        o.name AS folder_name
     FROM files f
     LEFT JOIN order_status os ON f.status_id = os.id
     JOIN orders o ON f.folder_id = o.id
     WHERE f.folder_id = ?
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
    SELECT f.folder_id, COUNT(*) AS fileCount
    FROM files f
    INNER JOIN orders o ON f.folder_id = o.id
    WHERE o.customer_id = ?
    GROUP BY f.folder_id
  `, [customerId]);

  const countMap = {};
  rows.forEach(row => {
    countMap[row.folder_id] = row.fileCount;
  });

  return countMap;
};

const getFileById = async(id) => {
  const pool = await poolPromise;
  const [rows] = await pool.query(`
    SELECT 
      f.*, 
      c.name AS customer_name, 
      c.email AS customer_email,
      GROUP_CONCAT(cc.email SEPARATOR ',') AS contact_emails,
      fd.name AS folder_name 
    FROM files f
    JOIN orders fd ON f.folder_id = fd.id
    JOIN customers c ON fd.customer_id = c.id
    LEFT JOIN customer_contacts cc ON c.id = cc.customer_id
    WHERE f.id = ?
    GROUP BY f.id
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
      folder_id, name, path, 
      created_at, updated_at, eta, etd, was_sent, 
      document_type, file_type, status_id
    ) VALUES (?, ?, ?, NOW(), NOW(), ?, ?, ?, ?, ?, ?)`,
    [
      file.folder_id, file.name, file.path,
      file.eta, file.etd, true, file.document_type, file.file_type, 4
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
    SELECT id, rut, pc, oc, name, created_at 
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
 * Obtiene el siguiente folder_id disponible
 * @returns {Promise<number>} El siguiente folder_id
 */
const getNextFolderId = async () => {
  const pool = await poolPromise;
  
  // Obtener el máximo folder_id actual
  const [rows] = await pool.query('SELECT MAX(folder_id) as max_folder_id FROM files');
  const maxFolderId = rows[0].max_folder_id || 4800; // Si no hay registros, empezar en 4800
  
  return maxFolderId + 1;
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
 * Obtiene archivos por folder_id
 * @param {number} folderId - ID del folder
 * @returns {Promise<Array>}
 */
const getFilesByFolderId = async (folderId) => {
  const pool = await poolPromise;
  const [rows] = await pool.query('SELECT * FROM files WHERE folder_id = ?', [folderId]);
  return rows;
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
  getFilesByFolderId
};
