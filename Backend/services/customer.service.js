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

/**
 * Obtiene un cliente por su RUT
 * @param {string} rut - RUT del cliente
 * @returns {Customer|null} Objeto Customer si existe, null si no encontrado
 */
async function getCustomerByRut(rut) {
  try {
    const pool = await poolPromise;
    const query = 'SELECT * FROM customers WHERE rut = ?';
    const params = [rut];
    
    console.log(`Buscando cliente en MySQL:`);
    console.log(`   Query: ${query}`);
    console.log(`   RUT buscado: "${rut}"`);
    
    const [rows] = await pool.query(query, params);
    
    if (rows.length === 0) {
      console.log(`No se encontró cliente con RUT: "${rut}"`);
      return null;
    }
    
    const customer = new Customer(rows[0]);
    console.log(`Cliente encontrado en BD: ID=${customer.id}, RUT=${customer.rut}, Nombre=${customer.name}`);
    
    return customer;
    
  } catch (error) {
    console.error(`Error buscando cliente por RUT "${rut}":`);
    console.error(`   Error: ${error.message}`);
    console.error(`   SQL State: ${error.sqlState}`);
    console.error(`   Error Code: ${error.errno}`);
    throw error;
  }
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

async function createCustomerContacts(customer_uuid, contacts) {
  const pool = await poolPromise;
  // Buscar el ID numérico a partir del UUID
  const [customer] = await pool.query('SELECT id FROM customers WHERE uuid = ?', [customer_uuid]);
  if (!customer[0]) throw new Error('Cliente no encontrado');
  const customer_id = customer[0].id;
  const query = `INSERT INTO customer_contacts (customer_id, name, email) VALUES ?`;
  const values = contacts.map(c => [customer_id, c.name, c.email]);
  await pool.query(query, [values]);
}

async function getContactsByCustomerUUID(uuid) {
  const pool = await poolPromise;
  // Suponiendo que tienes una relación entre customers y customer_contacts por customer_id
  const [customer] = await pool.query('SELECT id FROM customers WHERE uuid = ?', [uuid]);
  if (!customer[0]) return [];
  const customerId = customer[0].id;
  const [contacts] = await pool.query('SELECT id, name, email FROM customer_contacts WHERE customer_id = ?', [customerId]);
  return contacts;
}

module.exports = {
  getAllCustomerRuts,
  insertCustomer,
  getAllCustomers,
  getCustomerById,  
  getCustomerByUUID,
  getCustomerByRut,
  createCustomerContacts,
  getContactsByCustomerUUID
};
