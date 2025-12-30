const { poolPromise } = require('../config/db');

async function getOrderWithCustomerForPdf(orderId) {
  const pool = await poolPromise;
  const [[order]] = await pool.query(
    `
      SELECT o.*, c.name as customer_name, c.email as customer_email
      FROM orders o
      JOIN customers c ON o.customer_id = c.id
      WHERE o.id = ?
    `,
    [orderId]
  );
  return order || null;
}

async function getOrderDetailForPdf(orderId) {
  const pool = await poolPromise;
  const [[detail]] = await pool.query(
    'SELECT * FROM order_detail WHERE order_id = ?',
    [orderId]
  );
  return detail || null;
}

async function getOrderItemsByPcOcFactura(pc, oc, factura) {
  const pool = await poolPromise;
  const [rows] = await pool.query(
    `
      SELECT DISTINCT
        oi.id,
        oi.order_id,
        oi.item_id,
        oi.descripcion,
        oi.kg_solicitados,
        oi.unit_price,
        oi.volumen,
        oi.tipo,
        oi.mercado,
        oi.kg_despachados,
        oi.kg_facturados,
        oi.fecha_etd,
        oi.fecha_eta,
        i.item_code,
        i.item_name,
        i.unidad_medida,
        oi.factura
      FROM order_items oi
      JOIN items i ON oi.item_id = i.id
      JOIN orders o ON oi.order_id = o.id
      WHERE oi.pc = ? AND o.oc = ? AND (oi.factura = ? OR (oi.factura IS NULL AND ? IS NULL))
      ORDER BY oi.id
    `,
    [pc, oc, factura, factura]
  );
  return rows;
}

async function getOrderItemsByOrderId(orderId) {
  const pool = await poolPromise;
  const [rows] = await pool.query(
    `
      SELECT
        oi.id,
        oi.order_id,
        oi.item_id,
        oi.descripcion,
        oi.kg_solicitados,
        oi.unit_price,
        oi.volumen,
        oi.tipo,
        oi.mercado,
        oi.kg_despachados,
        oi.kg_facturados,
        oi.fecha_etd,
        oi.fecha_eta,
        i.item_code,
        i.item_name,
        i.unidad_medida,
        oi.factura
      FROM order_items oi
      JOIN items i ON oi.item_id = i.id
      WHERE oi.order_id = ?
      ORDER BY oi.id
    `,
    [orderId]
  );
  return rows;
}

async function getOrderPcOcById(orderId) {
  const pool = await poolPromise;
  const [[order]] = await pool.query(
    'SELECT pc, oc FROM orders WHERE id = ?',
    [orderId]
  );
  return order || null;
}

async function getLatestFileIdentifierByOrderId(orderId) {
  const pool = await poolPromise;
  const [[row]] = await pool.query(
    `
      SELECT file_identifier
      FROM order_files
      WHERE order_id = ? AND file_identifier IS NOT NULL
      ORDER BY file_identifier DESC
      LIMIT 1
    `,
    [orderId]
  );
  return row || null;
}

async function getLastFileIdentifierByPc(pc) {
  const pool = await poolPromise;
  const [[row]] = await pool.query(
    `
      SELECT file_identifier
      FROM order_files
      WHERE pc = ? AND file_identifier IS NOT NULL
      ORDER BY file_identifier DESC
      LIMIT 1
    `,
    [pc]
  );
  return row || null;
}

async function getCustomerCheckForViewFile(fileId, userId) {
  const pool = await poolPromise;
  const [[row]] = await pool.query(
    `
      SELECT c.id
      FROM customers c
      JOIN orders o ON c.id = o.customer_id
      JOIN files f ON o.id = f.order_id
      JOIN users u ON u.email = c.rut
      WHERE f.id = ? AND u.id = ?
    `,
    [fileId, userId]
  );
  return row || null;
}

async function getUserCustomerByUserId(userId) {
  const pool = await poolPromise;
  const [[row]] = await pool.query(
    `
      SELECT c.id, c.rut, c.name
      FROM customers c
      JOIN users u ON u.email = c.rut
      WHERE u.id = ?
    `,
    [userId]
  );
  return row || null;
}

async function getFileCustomerCheck(fileId, customerId) {
  const pool = await poolPromise;
  const query = `
    SELECT f.id, f.name, o.id as order_id, c.id as customer_id
    FROM order_files f
    JOIN orders o ON f.order_id = o.id
    JOIN customers c ON o.customer_id = c.id
    WHERE f.id = ? AND c.id = ?
  `;
  const [[row]] = await pool.query(query, [fileId, customerId]);
  return row || null;
}

async function getCustomerCheckForDownload(fileId, userId) {
  const pool = await poolPromise;
  const [[row]] = await pool.query(
    `
      SELECT c.id
      FROM customers c
      JOIN orders o ON c.id = o.customer_id
      JOIN order_files f ON o.id = f.order_id
      JOIN users u ON u.email = c.rut
      WHERE f.id = ? AND u.id = ?
    `,
    [fileId, userId]
  );
  return row || null;
}

async function getCustomerByUuid(customerUuid) {
  const pool = await poolPromise;
  const [[row]] = await pool.query(
    'SELECT id FROM customers WHERE uuid = ?',
    [customerUuid]
  );
  return row || null;
}

async function getOrderWithCustomerForDefaultFiles(orderId) {
  const pool = await poolPromise;
  const [[order]] = await pool.query(
    `
      SELECT o.*, c.name as customer_name
      FROM orders o
      JOIN customers c ON o.customer_id = c.id
      WHERE o.id = ?
    `,
    [orderId]
  );
  return order || null;
}

module.exports = {
  getOrderWithCustomerForPdf,
  getOrderDetailForPdf,
  getOrderItemsByPcOcFactura,
  getOrderItemsByOrderId,
  getOrderPcOcById,
  getLatestFileIdentifierByOrderId,
  getLastFileIdentifierByPc,
  getCustomerCheckForViewFile,
  getUserCustomerByUserId,
  getFileCustomerCheck,
  getCustomerCheckForDownload,
  getCustomerByUuid,
  getOrderWithCustomerForDefaultFiles
};
