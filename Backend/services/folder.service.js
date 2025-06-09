const { poolPromise } = require('../config/db');
const Folder = require('../models/folder.model');
const Subfolder = require('../models/subfolder.model');

async function getFoldersByCustomer(customerId) {
  const pool = await poolPromise;

  const [rows] = await pool.query(`
    SELECT 
      f.*, 
      c.uuid AS customer_uuid 
    FROM folders f
    INNER JOIN customers c ON f.customer_id = c.id
    WHERE f.customer_id = ?
  `, [customerId]);

  return rows.map(r => {
    const folder = new Folder(r);
    folder.customer_uuid = r.customer_uuid;
    return folder;
  });
}

async function createFolder({ customer_id, name, path }) {
  const pool = await poolPromise;
  const [result] = await pool.query(
    'INSERT INTO folders (customer_id, name, path) VALUES (?, ?, ?)',
    [customer_id, name, path]
  );
  return { id: result.insertId, customer_id, name, path };
}

async function createSubfolder({ folder_id, name, path }) {
  const pool = await poolPromise;
  const [result] = await pool.query(
    'INSERT INTO subfolders (folder_id, name, path) VALUES (?, ?, ?)',
    [folder_id, name, path]
  );
  return { id: result.insertId, folder_id, name, path };
}

async function getSubfoldersByFolder(folderId) {
  const pool = await poolPromise;
  const [rows] = await pool.query('SELECT * FROM subfolders WHERE folder_id = ?', [folderId]);
  return rows.map(r => new Subfolder(r));
}

async function deleteSubfolder(folderId, subfolderName) {
  const pool = await poolPromise;
  const [result] = await pool.query(
    'DELETE FROM subfolders WHERE folder_id = ? AND name = ?',
    [folderId, subfolderName]
  );
  return result.affectedRows > 0;
}

async function existsGlobalPCFolder(name) {
    const pool = await poolPromise;
    const [rows] = await pool.query('SELECT id FROM folders WHERE name = ?', [name]);
    return rows.length > 0;
}

async function existsCustomerFolder(customer_id, name) {
    const pool = await poolPromise;
    const [rows] = await pool.query(
        'SELECT id FROM folders WHERE customer_id = ? AND name = ?',
        [customer_id, name]
    );
    return rows.length > 0;
}

async function getCountDirectoryByCustomerID(customer_id) {
  const pool = await poolPromise;
  const [rows] = await pool.query(
    'SELECT COUNT(*) AS total FROM folders WHERE customer_id = ?',
    [customer_id]
  );
  return rows[0].total;
}

module.exports = {
  getFoldersByCustomer,
  createFolder,
  createSubfolder,
  getSubfoldersByFolder,
  deleteSubfolder,
  existsGlobalPCFolder,
  existsCustomerFolder,
  getCountDirectoryByCustomerID,
};
