// src/services/file.service.js
const { poolPromise } = require('../config/db');

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

const getFiles = async (customerId, folderId) => {
  const pool = await poolPromise;
  const [rows] = await pool.query(
    `SELECT * FROM files WHERE customer_id = ? AND folder_id = ? ORDER BY created_at DESC`,
    [customerId, folderId]
  );
  return rows;
};

module.exports = {
  insertFile,
  getFiles
};