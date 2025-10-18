const { poolPromise } = require('../config/db');
const Folder = require('../models/folder.model');
const Subfolder = require('../models/subfolder.model');
const { getFileCountByCustomer } = require('./file.service');

/**
 * Retorna todas las carpetas asociadas a un cliente, incluyendo:
 * - UUID del cliente
 * - Cantidad de archivos por carpeta (fileCount)
 * @param {number} customerId - ID interno del cliente
 * @returns {Array<Folder>} Lista de carpetas con información extendida
 */
async function getFoldersByCustomer(customerId) {
  const pool = await poolPromise;

  const [rows] = await pool.query(`
    SELECT DISTINCT
      o.id,
      o.rut,
      o.oc,
      o.pc,
      o.created_at,
      o.updated_at,
      c.name AS customer_name,
      c.uuid AS customer_uuid,
      o.factura,
      o.fecha_factura,
      od.order_id,
      od.fecha,
      od.fecha_etd,
      od.fecha_eta,
      od.currency,
      od.medio_envio_factura,
      od.incoterm,
      od.puerto_destino,
      od.certificados
    FROM orders o
    JOIN customers c ON o.customer_id = c.id
    LEFT JOIN order_detail od ON o.id = od.order_id
    WHERE o.customer_id = ?
    ORDER BY o.fecha_factura DESC
  `, [customerId]);

  const countMap = await getFileCountByCustomer(customerId);

  return rows.map(r => {
    const folder = new Folder(r);
    folder.customer_uuid = r.customer_uuid;
    folder.fileCount = countMap[r.id] || 0;
    return folder;
  });
}

/**
 * Crea un folder y los archivos asociados por defecto
 * @param {Object} data - Datos de la carpeta
 * @param {number} data.customer_id - ID del cliente
 * @param {string} data.name - Nombre de la carpeta
 * @param {string} data.path - Ruta relativa de la carpeta
 * @returns {Object} Objeto con los datos de la carpeta creada
 */
async function createFolder({ customer_id, name, path }) {
  const pool = await poolPromise;

  // Insert en folders
  const [result] = await pool.query(
    'INSERT INTO orders (customer_id, name, path) VALUES (?, ?, ?)',
    [customer_id, name, path]
  );

  const folderId = result.insertId;

  // Insert en files (los 3 registros)
  const filesToInsert = [
    { name: 'Order Receipt Advice' },
    { name: 'Shipment Advice' },
    { name: 'Aviso de entrega' },
    { name: 'Availability Advice' }
  ];

  for (const file of filesToInsert) {
    await pool.query(
      `INSERT INTO order_files (folder_id, name, path, was_sent, document_type, file_type, status_id)
       VALUES (?, ?, NULL, NULL, NULL, NULL, NULL, NULL, 1)`,
      [folderId, file.name]
    );
  }

  return { id: folderId, name, path };
}


/**
 * Crea una subcarpeta dentro de una carpeta existente
 * @param {Object} data - Datos de la subcarpeta
 * @param {number} data.folder_id - ID de la carpeta padre
 * @param {string} data.name - Nombre de la subcarpeta
 * @param {string} data.path - Ruta relativa
 * @returns {Object} Objeto con los datos de la subcarpeta creada
 */
async function createSubfolder({ folder_id, name, path }) {
  const pool = await poolPromise;
  const [result] = await pool.query(
    'INSERT INTO subfolders (folder_id, name, path) VALUES (?, ?, ?)',
    [folder_id, name, path]
  );
  return { id: result.insertId, folder_id, name, path };
}

/**
 * Obtiene todas las subcarpetas asociadas a una carpeta
 * @param {number} folderId - ID de la carpeta padre
 * @returns {Array<Subfolder>} Lista de subcarpetas
 */
async function getSubfoldersByFolder(folderId) {
  const pool = await poolPromise;
  const [rows] = await pool.query('SELECT * FROM subfolders WHERE folder_id = ?', [folderId]);
  return rows.map(r => new Subfolder(r));
}

/**
 * Elimina una subcarpeta específica por nombre dentro de una carpeta
 * @param {number} folderId - ID de la carpeta
 * @param {string} subfolderName - Nombre de la subcarpeta
 * @returns {boolean} true si se eliminó, false si no existía
 */
async function deleteSubfolder(folderId, subfolderName) {
  const pool = await poolPromise;
  const [result] = await pool.query(
    'DELETE FROM subfolders WHERE folder_id = ? AND name = ?',
    [folderId, subfolderName]
  );
  return result.affectedRows > 0;
}

/**
 * Verifica si existe una carpeta global con nombre único (usado para carpetas tipo PCXXXXX)
 * @param {string} name - Nombre de la carpeta a verificar
 * @returns {boolean} true si ya existe, false si es única
 */
async function existsGlobalPCFolder(name) {
  const pool = await poolPromise;
  const [rows] = await pool.query('SELECT id FROM orders WHERE name = ?', [name]);
  return rows.length > 0;
}

/**
 * Verifica si un cliente ya tiene una carpeta con el mismo nombre
 * @param {number} customer_id - ID del cliente
 * @param {string} name - Nombre de la carpeta
 * @returns {boolean} true si ya existe, false si no
 */
async function existsCustomerFolder(customer_id, name) {
  const pool = await poolPromise;
  const [rows] = await pool.query('SELECT id FROM orders WHERE customer_id = ? AND name = ?', [customer_id, name]);
  return rows.length > 0;
}

/**
 * Retorna el número total de carpetas que tiene un cliente
 * @param {number} customer_id - ID del cliente
 * @returns {number} Total de carpetas
 */
async function getCountDirectoryByCustomerID(customer_id) {
  const pool = await poolPromise;
  const [rows] = await pool.query(
    'SELECT COUNT(*) AS total FROM orders WHERE customer_id = ?',
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
