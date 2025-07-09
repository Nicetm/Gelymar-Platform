// services/user.service.js
const { poolPromise } = require('../config/db');
const { v4: uuidv4 } = require('uuid');
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
      COUNT(o.id) AS order_count
    FROM customers c
    LEFT JOIN orders o ON o.customer_id = c.id
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


async function getAllCustomerRuts() {
  const pool = await poolPromise;
  const [rows] = await pool.query('SELECT rut FROM customers');
  return rows.map(r => r.rut);
}

async function insertCustomer(data) {
  const pool = await poolPromise;
  const query = `
    INSERT INTO customers (
      uuid, rut, name, email, address, address_alt, city, country,
      contact_name, contact_secondary, fax, phone, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW())
  `;

  const params = [
    uuidv4(),
    data.rut,
    data.name,
    data.email || null,
    data.address,
    data.address_alt,
    data.city,
    data.country,
    data.contact_name,
    data.contact_secondary,
    data.fax,
    data.phone
  ];

  await pool.query(query, params);
}


module.exports = {
  getAllCustomerRuts,
  insertCustomer,
  getAllCustomers,
  getCustomerById,
  getCustomerByUUID
};
