const { poolPromise } = require('../config/db');
const Customer = require('../models/customer.model');

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

async function getCustomerById(id) {
  const pool = await poolPromise;
  const [rows] = await pool.query('SELECT * FROM customers WHERE id = ?', [id]);

  if (rows.length === 0) return null;

  return new Customer(rows[0]);
}

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
