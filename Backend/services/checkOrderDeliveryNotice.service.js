const { poolPromise } = require('../config/db');
const { logger } = require('../utils/logger');

async function getOrdersReadyForOrderDeliveryNotice() {
  const pool = await poolPromise;
  try {
    const [rows] = await pool.query(
      `
        SELECT
          o.id,
          o.customer_id,
          o.pc,
          o.oc,
          c.name AS customer_name,
          COALESCE(
            STR_TO_DATE(LEFT(TRIM(od.fecha_eta_factura), 10), '%Y-%m-%d'),
            STR_TO_DATE(LEFT(TRIM(od.fecha_eta), 10), '%Y-%m-%d')
          ) AS eta,
          f.id AS delivery_file_id,
          f.fecha_envio AS delivery_fecha_envio
        FROM orders o
        JOIN customers c ON o.customer_id = c.id
        LEFT JOIN (
          SELECT
            order_id,
            MAX(fecha_eta_factura) AS fecha_eta_factura,
            MAX(fecha_eta) AS fecha_eta
          FROM order_detail
          GROUP BY order_id
        ) od ON od.order_id = o.id
        LEFT JOIN order_files f ON f.order_id = o.id AND f.name = 'Order Delivery Notice'
        WHERE o.factura IS NOT NULL
          AND o.factura <> ''
          AND o.factura <> 0
          AND o.factura <> '0'
          AND EXISTS (
            SELECT 1
            FROM order_detail od2
            WHERE od2.order_id = o.id
              AND od2.incoterm IN ('CFR', 'CIF', 'CIP', 'DAP', 'DDP')
          )
          AND COALESCE(
            STR_TO_DATE(LEFT(TRIM(od.fecha_eta_factura), 10), '%Y-%m-%d'),
            STR_TO_DATE(LEFT(TRIM(od.fecha_eta), 10), '%Y-%m-%d')
          ) IS NOT NULL
          AND DATE_ADD(
            COALESCE(
              STR_TO_DATE(LEFT(TRIM(od.fecha_eta_factura), 10), '%Y-%m-%d'),
              STR_TO_DATE(LEFT(TRIM(od.fecha_eta), 10), '%Y-%m-%d')
            ),
            INTERVAL 7 DAY
          ) = CURDATE()
          AND (f.id IS NULL OR f.fecha_envio IS NULL)
        ORDER BY o.id ASC
      `
    );
    return rows;
  } catch (error) {
    logger.error(`Error obteniendo ordenes para Order Delivery Notice: ${error.message}`);
    throw error;
  }
}

async function getOrderDeliveryFile(orderId) {
  const pool = await poolPromise;
  try {
    const [rows] = await pool.query(
      `SELECT id, path, fecha_envio FROM order_files WHERE order_id = ? AND name = ? ORDER BY id DESC LIMIT 1`,
      [orderId, 'Order Delivery Notice']
    );
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    logger.error(`Error obteniendo Order Delivery Notice para orden ${orderId}: ${error.message}`);
    throw error;
  }
}

module.exports = {
  getOrdersReadyForOrderDeliveryNotice,
  getOrderDeliveryFile
};
