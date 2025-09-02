const { poolPromise } = require('../config/db');

/**
 * Verifica si existen órdenes cuya fecha ETD sea igual a la fecha actual.
 * Si encuentra coincidencias, ejecuta una acción (por ahora, console.log).
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

  if (rows.length > 0) {
    console.log(`[${new Date().toLocaleString()}] Se encontraron órdenes con ETD = hoy:`);

    for (const order of rows) {
      console.log(`- Orden ID: ${order.id}, Nombre: ${order.oc}, ETD: ${order.fecha_etd}`);
      // await enviarCorreo(order);
      // await actualizarEstado(order.id);
    }
  } else {
    console.log(`[${new Date().toLocaleString()}] No hay órdenes con ETD = hoy.`);
  }
}

module.exports = { checkOrdersWithETD };
