const { poolPromise } = require('../config/db');

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
    `SELECT * FROM files WHERE customer_id = ? AND folder_id = ? ORDER BY created_at DESC`,
    [customerId, folderId]
  );
  return rows;
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

module.exports = {
  insertFile,
  getFiles,
  getFileCountByCustomer,
};
