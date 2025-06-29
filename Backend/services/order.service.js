const { poolPromise } = require('../config/db');
const Order = require('../models/order.model');

/**
 * Busca órdenes por filtros opcionales
 * @param {object} filters
 * @returns {Promise<Order[]>}
 */
const getOrdersByFilters = async (filters = {}) => {
  const pool = await poolPromise;

  let query = `
    SELECT 
      o.id,
      o.customer_id,
      o.name,
      o.path,
      o.created_at,
      o.updated_at,
      o.date_etd,
      o.date_eta,
      c.name AS customer_name,
      c.uuid AS customer_uuid,
      COUNT(f.id) AS files_count
    FROM orders o
    JOIN customers c ON o.customer_id = c.id
    LEFT JOIN files f ON f.folder_id = o.id
    WHERE 1 = 1
  `;

  const params = [];

  if (filters.orderName) {
    query += ` AND o.name LIKE ?`;
    params.push(`%${filters.orderName.trim()}%`);
  }

  if (filters.customerName) {
    query += ` AND c.name LIKE ?`;
    params.push(`%${filters.customerName.trim()}%`);
  }

  if (filters.customerUUID) {
    query += ` AND c.uuid = ?`;
    params.push(filters.customerUUID);
  }

  if (filters.fechaIngreso && /^\d{4}-\d{2}-\d{2}$/.test(filters.fechaIngreso)) {
    query += ` AND DATE(o.created_at) = ?`;
    params.push(filters.fechaIngreso);
  }

  if (filters.fechaETD && /^\d{4}-\d{2}-\d{2}$/.test(filters.fechaETD)) {
    query += ` AND DATE(f.etd) = ?`;
    params.push(filters.fechaETD);
  }

  if (filters.fechaETA && /^\d{4}-\d{2}-\d{2}$/.test(filters.fechaETA)) {
    query += ` AND DATE(f.eta) = ?`;
    params.push(filters.fechaETA);
  }

  if (filters.estado && filters.estado !== 'Todos') {
    if (!/^\d+$/.test(filters.estado)) throw new Error('Estado inválido');
    query += ` AND f.status_id = ?`;
    params.push(filters.estado);
  }

  query += ` GROUP BY o.id`;

  const [rows] = await pool.query(query, params);

  return rows.map(r => {
    const order = new Order({
      id: r.id,
      customer_id: r.customer_id,
      name: r.name,
      path: r.path,
      created_at: r.created_at,
      updated_at: r.updated_at,
      date_etd: r.date_etd,
      date_eta: r.date_eta
    });

    order.customer_name = r.customer_name;
    order.customer_uuid = r.customer_uuid;
    order.files_count = r.files_count;

    return order;
  });
};

module.exports = {
  getOrdersByFilters,
};
