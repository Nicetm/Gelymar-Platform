// services/user.service.js
const { poolPromise } = require('../config/db');
const Customer = require('../models/customer.model');

/**
 * Obtiene todos los clientes con un conteo de carpetas asociadas (folder_count)
 * @returns {Array<Customer>} Lista de clientes con propiedad adicional folder_count
 */
async function getAllCustomers() {
  const pool = await poolPromise;
  const [rows] = await pool.query(`
    SELECT 
      c.*, 
      COUNT(f.id) AS folder_count
    FROM customers c
    LEFT JOIN folders f ON f.customer_id = c.id
    GROUP BY c.id
  `);

  return rows.map(row => {
    const customer = new Customer(row);
    customer.folder_count = row.folder_count;
    return customer;
  });
}

/**
 * Obtiene un cliente por su ID interno
 * @param {number} id - ID numérico del cliente
 * @returns {Customer|null} Objeto Customer si existe, null si no encontrado
 */
async function getCustomerById(id) {
  const pool = await poolPromise;
  const [rows] = await pool.query('SELECT * FROM customers WHERE id = ?', [id]);

  if (rows.length === 0) return null;

  return new Customer(rows[0]);
}

/**
 * Obtiene un cliente por su UUID público
 * @param {string} uuid - UUID del cliente
 * @returns {Customer|null} Objeto Customer si existe, null si no encontrado
 */
async function getCustomerByUUID(uuid) {
  const pool = await poolPromise;
  const [rows] = await pool.query('SELECT * FROM customers WHERE uuid = ?', [uuid]);

  if (rows.length === 0) return null;

  return new Customer(rows[0]);
}

module.exports = {
  getAllCustomers,
  getCustomerById,
  getCustomerByUUID
};
