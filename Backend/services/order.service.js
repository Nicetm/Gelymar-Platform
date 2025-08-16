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
      o.rut,
      o.name AS oc,
      o.pc,
      o.path,
      o.created_at,
      o.updated_at,
      c.name AS customer_name,
      c.uuid AS customer_uuid,
      COUNT(f.id) AS files_count
    FROM orders o
    JOIN customers c ON o.rut = c.rut
    LEFT JOIN files f ON f.pc = o.pc
    WHERE 1 = 1
  `;

  const params = [];

  if (filters.orderName) {
    query += ` AND o.name LIKE ?`;
    params.push(`%${filters.orderName.trim()}%`);
  }

  if (filters.customerName) {
    query += ` AND c.customer_name LIKE ?`;
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

  query += ` GROUP BY o.id, o.pc, o.rut, o.name, o.path, o.created_at, o.updated_at, c.name, c.uuid`;

  const [rows] = await pool.query(query, params);

  return rows.map(r => {
    const order = new Order({
      id: r.id,
      rut: r.rut,
      pc: r.pc,
      oc: r.oc,
      path: r.path,
      created_at: r.created_at,
      updated_at: r.updated_at,
      customer_name: r.customer_name,
      customer_uuid: r.customer_uuid,
      files_count: r.files_count
    });

    return order;
  });
};

/**
 * Inserta una nueva orden en la base de datos
 * @param {object} data - Datos de la orden
 * @returns {Promise<void>}
 */
const insertOrder = async (data) => {
  try {
    const pool = await poolPromise;
    
    const query = `
      INSERT INTO orders (
        customer_id, rut, pc, oc, factura, fec_factura, name, path, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `;

    const params = [
      data.customer_id,
      data.rut,
      data.pc,
      data.oc,
      data.factura,
      data.fec_factura,
      data.name,
      data.path || ''
    ];

    console.log(`Ejecutando INSERT en MySQL:`);
    console.log(`   Query: ${query}`);
    console.log(`   Params: [${params.map(p => `"${p}"`).join(', ')}]`);

    const [result] = await pool.query(query, params);
    
    console.log(`INSERT exitoso - ID insertado: ${result.insertId}`);
    
  } catch (error) {
    console.error(`Error en INSERT MySQL:`);
    console.error(`   Error: ${error.message}`);
    console.error(`   SQL State: ${error.sqlState}`);
    console.error(`   Error Code: ${error.errno}`);
    throw error; // Re-lanzar el error para que se maneje en el nivel superior
  }
};

/**
 * Obtiene todas las órdenes existentes por PC y OC
 * @returns {Promise<Array<string>>}
 */
const getAllExistingOrders = async () => {
  const pool = await poolPromise;
  const [rows] = await pool.query('SELECT pc, oc FROM orders WHERE pc IS NOT NULL AND oc IS NOT NULL');
  return rows.map(row => `${row.pc}-${row.oc}`);
};

/**
 * Obtiene el order_id por el campo pc
 * @param {string} pc - Número de PC
 * @returns {Promise<number|null>}
 */
const getOrderIdByPc = async (pc) => {
  const pool = await poolPromise;
  const [rows] = await pool.query('SELECT id FROM orders WHERE pc = ?', [pc]);
  return rows.length > 0 ? rows[0].id : null;
};

module.exports = {
  getOrdersByFilters,
  insertOrder,
  getAllExistingOrders,
  getOrderIdByPc
};
