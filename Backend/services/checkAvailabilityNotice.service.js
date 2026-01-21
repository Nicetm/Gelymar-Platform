const { poolPromise } = require('../config/db');
const { logger } = require('../utils/logger');

async function getOrdersReadyForAvailabilityNotice(sendFromDate = null) {
  const pool = await poolPromise;
  try {
    const params = [];
    let sendFromFilter = '';
    if (sendFromDate) {
      sendFromFilter = ' AND DATE(o.fecha_factura) >= ?';
      params.push(sendFromDate);
    }
    const [rows] = await pool.query(
      `
        SELECT
          o.id,
          o.customer_id,
          o.pc,
          o.oc,
          c.name AS customer_name,
          o.fecha_factura,
          f.id AS availability_file_id,
          f.fecha_envio AS availability_fecha_envio
        FROM orders o
        JOIN customers c ON o.customer_id = c.id
        LEFT JOIN order_files f ON f.order_id = o.id AND f.file_id = 6
        WHERE o.factura IS NOT NULL
          AND o.factura <> ''
          AND o.factura <> 0
          AND o.factura <> '0'
          AND EXISTS (
            SELECT 1
            FROM order_items oi
            WHERE oi.order_id = o.id
              AND oi.pc = o.pc
              AND UPPER(TRIM(oi.despacho_stgo)) = 'SI'
          )
          AND EXISTS (
            SELECT 1
            FROM order_detail od
            WHERE od.order_id = o.id
              AND TRIM(od.incoterm) IN (
                'EWX',
                'FCA',
                'FOB',
                'FCA Port',
                'FCA Warehouse Santiago',
                'FCA Airport',
                'FCAWSTGO'
              )
          )
          AND (f.id IS NULL OR f.fecha_envio IS NULL)
          ${sendFromFilter}
        ORDER BY o.id ASC
      `,
      params
    );
    return rows;
  } catch (error) {
    logger.error(`Error obteniendo ordenes para Availability Notice: ${error.message}`);
    throw error;
  }
}

async function getAvailabilityFile(orderId) {
  const pool = await poolPromise;
  try {
    const [rows] = await pool.query(
      `SELECT id, path, fecha_envio FROM order_files WHERE order_id = ? AND file_id = ? ORDER BY id DESC LIMIT 1`,
      [orderId, 6]
    );
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    logger.error(`Error obteniendo Availability Notice para orden ${orderId}: ${error.message}`);
    throw error;
  }
}

module.exports = {
  getOrdersReadyForAvailabilityNotice,
  getAvailabilityFile
};
