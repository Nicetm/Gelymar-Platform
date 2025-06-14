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
      customer_id, folder_id, name, path, 
      created_at, updated_at, eta, etd, was_sent, 
      document_type, file_type, status_id
    ) VALUES (?, ?, ?, ?, NOW(), NOW(), ?, ?, ?, ?, ?, ?)`,
    [
      realCustomerId, folder_id, name, path,
      eta, etd, was_sent, document_type, file_type, status_id
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
        os.name AS status_name,
        fd.name AS folder_name
     FROM files f
     LEFT JOIN order_status os ON f.status_id = os.id
     JOIN folders fd ON f.folder_id = fd.id
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
      c.email AS customer_email,
      GROUP_CONCAT(cc.email SEPARATOR ',') AS contact_emails,
      fd.name AS folder_name 
    FROM files f
    JOIN customers c ON f.customer_id = c.id
    JOIN folders fd ON f.folder_id = fd.id
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
      customer_id, folder_id, name, path, 
      created_at, updated_at, eta, etd, was_sent, 
      document_type, file_type, status_id
    ) VALUES (?, ?, ?, ?, NOW(), NOW(), ?, ?, ?, ?, ?, ?)`,
    [
      file.customer_id, file.folder_id, file.name, file.path,
      file.eta, file.etd, true, file.document_type, file.file_type, 4
    ]
  );

  return result.insertId;
};

module.exports = {
  getFileById,
  insertFile,
  getFiles,
  updateFile,
  getFileCountByCustomer,
  duplicateFile,
};
