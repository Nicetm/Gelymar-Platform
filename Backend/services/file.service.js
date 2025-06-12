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
  format,
  path,
  eta = null,
  etd = null,
  was_sent = false,
  status = 'creado',
  document_type = null,
  file_type = null
}) => {
  const pool = await poolPromise;
  const [result] = await pool.query(
    `INSERT INTO files (
      customer_id, folder_id, name, format, path, 
      created_at, updated_at, eta, etd, was_sent, 
      status, document_type, file_type
    ) VALUES (?, ?, ?, ?, ?, NOW(), NOW(), ?, ?, ?, ?, ?, ?)`,
    [
      customer_id, folder_id, name, format, path,
      eta, etd, was_sent, status, document_type, file_type
    ]
  );
  return result;
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
        os.name AS status_name
     FROM files f
     LEFT JOIN order_status os ON f.status_id = os.id
     WHERE f.customer_id = ? AND f.folder_id = ?
     ORDER BY f.created_at DESC`,
    [customerId, folderId]
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
  const [rows] = await pool.query(
    `SELECT folder_id, COUNT(*) AS fileCount 
     FROM files 
     WHERE customer_id = ? 
     GROUP BY folder_id`,
    [customerId]
  );

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
      fd.name AS folder_name 
    FROM files f
    JOIN customers c ON f.customer_id = c.id
    JOIN folders fd ON f.folder_id = fd.id
    WHERE f.id = ?
  `, [id]);

  if (rows.length === 0) return null;

  return rows[0];
}

const updateFile = async(data) => {
  const pool = await poolPromise;
  await pool.query(`
    UPDATE files 
    SET status_id = ?, updated_at = ?, path = ?
    WHERE id = ?
  `, [data.status_id, data.updated_at, data.path, data.id]);
}

module.exports = {
  getFileById,
  insertFile,
  getFiles,
  updateFile,
  getFileCountByCustomer,
};
