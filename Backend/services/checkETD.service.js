const { poolPromise } = require('../config/db');

/**
 * Verifica si existen órdenes cuya fecha ETD sea igual a la fecha actual.
 */
async function checkOrdersWithETD() {
  const today = new Date().toISOString().split('T')[0]; // 'YYYY-MM-DD'

  const pool = await poolPromise;
  const [rows] = await pool.query(`
    SELECT o.id, o.oc, oi.fecha_etd
    FROM orders o
    INNER JOIN order_items oi ON o.id = oi.order_id
    WHERE DATE(oi.fecha_etd) = ?
  `, [today]);
}

module.exports = { checkOrdersWithETD };
