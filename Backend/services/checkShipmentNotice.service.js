const { poolPromise } = require('../config/db');
const { logger } = require('../utils/logger');

async function getOrdersReadyForShipmentNotice(sendFromDate = null) {
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
          COALESCE(NULLIF(TRIM(od.fecha_etd_factura), ''), NULLIF(TRIM(od.fecha_etd), '')) AS etd,
          COALESCE(NULLIF(TRIM(od.fecha_eta_factura), ''), NULLIF(TRIM(od.fecha_eta), '')) AS eta,
          f.id AS shipment_file_id,
          f.fecha_envio AS shipment_fecha_envio
        FROM orders o
        JOIN customers c ON o.customer_id = c.id
        LEFT JOIN (
          SELECT
            order_id,
            MAX(fecha_etd_factura) AS fecha_etd_factura,
            MAX(fecha_eta_factura) AS fecha_eta_factura,
            MAX(fecha_etd) AS fecha_etd,
            MAX(fecha_eta) AS fecha_eta
          FROM order_detail
          GROUP BY order_id
        ) od ON od.order_id = o.id
        LEFT JOIN order_files f ON f.order_id = o.id AND f.file_id = 19
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
          AND COALESCE(NULLIF(TRIM(od.fecha_etd_factura), ''), NULLIF(TRIM(od.fecha_etd), '')) IS NOT NULL
          AND COALESCE(NULLIF(TRIM(od.fecha_eta_factura), ''), NULLIF(TRIM(od.fecha_eta), '')) IS NOT NULL
          AND (f.id IS NULL OR f.fecha_envio IS NULL)
          ${sendFromFilter}
        ORDER BY o.id ASC
      `,
      params
    );
    return rows;
  } catch (error) {
    logger.error(`Error obteniendo ordenes para Shipment Notice: ${error.message}`);
    throw error;
  }
}

async function getShipmentFile(orderId) {
  const pool = await poolPromise;
  try {
    const [rows] = await pool.query(
      `SELECT id, path, fecha_envio FROM order_files WHERE order_id = ? AND file_id = ? ORDER BY id DESC LIMIT 1`,
      [orderId, 19]
    );
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    logger.error(`Error obteniendo Shipment Notice para orden ${orderId}: ${error.message}`);
    throw error;
  }
}

module.exports = {
  getOrdersReadyForShipmentNotice,
  getShipmentFile
};
