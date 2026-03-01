// services/orderDetail.service.js
const { getSqlPool, sql } = require('../config/sqlserver');
const { mapHdrRowToOrder } = require('../mappers/sqlsoftkey/hdr.mapper');
const { mapFactRowToInvoice } = require('../mappers/sqlsoftkey/fact.mapper');
const { mapItemRowToOrderItem } = require('../mappers/sqlsoftkey/item.mapper');
const { logger } = require('../utils/logger');
const { normalizeOcForCompare } = require('../utils/oc.util');

const parseOrderKey = (orderId) => {
  if (!orderId) return null;
  if (typeof orderId !== 'string') return null;
  const trimmed = orderId.trim();
  if (!trimmed) return null;
  if (trimmed.includes('|')) {
    const [pc, ...ocParts] = trimmed.split('|');
    return { pc: pc.trim(), oc: ocParts.join('|').trim() };
  }
  return { pc: trimmed, oc: null };
};


/**
 * REFACTORING CHANGES:
 * OLD: Single query to Vista_HDR with invoice fields duplicated per invoice
 * NEW: Separate queries for order (Vista_HDR), invoices (Vista_FACT), and items (Vista_ITEM)
 * 
 * Obtener order detail por order_id
 * Returns structure: { order, invoices: [{ ...invoice, items: [...] }] }
 * 
 * @param {string} orderId - Order identifier in format "PC|OC" or just "PC"
 * @returns {Object|null} Order detail with invoices and items, or null if not found
 */
async function getOrderDetailByOrderId(orderId) {
  const key = parseOrderKey(orderId);
  if (!key) return null;

  const sqlPool = await getSqlPool();

  // STEP 1: Query Vista_HDR for order data (single row)
  const orderRequest = sqlPool.request();
  orderRequest.input('pc', sql.VarChar, key.pc);
  if (key.oc) {
    orderRequest.input('oc', sql.VarChar, normalizeOcForCompare(key.oc));
  }

  const orderQuery = `
    SELECT TOP 1 *
    FROM jor_imp_HDR_90_softkey
    WHERE Nro = @pc
    ${key.oc ? "AND REPLACE(REPLACE(UPPER(OC), ' ', ''), '-', '') = @oc" : ''}
    ORDER BY Fecha DESC
  `;

  const orderResult = await orderRequest.query(orderQuery);
  const orderRow = orderResult.recordset?.[0];
  if (!orderRow) return null;

  const mappedOrder = mapHdrRowToOrder(orderRow);

  // Build order object with additional fields from Vista_HDR
  const order = {
    id: `${mappedOrder.pc}|${mappedOrder.oc}`,
    order_id: `${mappedOrder.pc}|${mappedOrder.oc}`,
    pc: mappedOrder.pc,
    oc: mappedOrder.oc,
    fecha: mappedOrder.fecha,
    tipo: orderRow.Tipo ?? null,
    incoterm: mappedOrder.incoterm,
    currency: mappedOrder.currency,
    direccion_destino: orderRow.Direccion ?? null,
    direccion_alterna: orderRow.Direccion_Alterna ?? null,
    puerto_embarque: orderRow.Puerto_Embarque ?? null,
    puerto_destino: mappedOrder.puerto_destino,
    fecha_eta: mappedOrder.fecha_eta,
    fecha_etd: mappedOrder.fecha_etd,
    certificados: mappedOrder.certificados,
    estado_ov: mappedOrder.estado_ov,
    medio_envio_ov: mappedOrder.medio_envio_ov,
    gasto_adicional_flete: orderRow.GtoAdicFlete ?? null,
    fecha_incoterm: orderRow.FechaOriginalCompromisoCliente ?? null,
    localizacion: orderRow.Localizacion ?? null,
    codigo_impuesto: orderRow.Cod_Impto ?? null,
    vendedor: mappedOrder.vendedor,
    nave: orderRow.Nave ?? null,
    condicion_venta: orderRow.Condicion_venta ?? null,
    linea: orderRow.Linea ?? null
  };

  // STEP 2: Query Vista_FACT for invoices filtering by PC (multiple rows)
  const invoiceRequest = sqlPool.request();
  invoiceRequest.input('pc', sql.VarChar, key.pc);

  const invoiceQuery = `
    SELECT *
    FROM jor_imp_FACT_90_softkey
    WHERE Nro = @pc
      AND Factura IS NOT NULL
      AND LTRIM(RTRIM(Factura)) <> ''
      AND Factura <> 0
    ORDER BY Factura
  `;

  const invoiceResult = await invoiceRequest.query(invoiceQuery);
  const invoiceRows = invoiceResult.recordset || [];

  // STEP 3: For each invoice, query Vista_ITEM for items
  const invoices = [];
  for (const invoiceRow of invoiceRows) {
    const mappedInvoice = mapFactRowToInvoice(invoiceRow);

    // Query items for this invoice
    const itemRequest = sqlPool.request();
    itemRequest.input('pc', sql.VarChar, key.pc);
    itemRequest.input('factura', sql.VarChar, mappedInvoice.factura);

    const itemQuery = `
      SELECT *
      FROM jor_imp_item_90_softkey
      WHERE Nro = @pc
        AND Factura = @factura
      ORDER BY Linea
    `;

    const itemResult = await itemRequest.query(itemQuery);
    const itemRows = itemResult.recordset || [];
    const items = itemRows.map(mapItemRowToOrderItem);

    // Add invoice with its items
    invoices.push({
      ...mappedInvoice,
      items
    });
  }

  // Return structure: { order, invoices: [{ ...invoice, items: [...] }] }
  return {
    order,
    invoices
  };
}

// Obtener todos los order details
async function getAllOrderDetails() {
  const sqlPool = await getSqlPool();
  const result = await sqlPool.request().query(
    'SELECT * FROM jor_imp_HDR_90_softkey ORDER BY Nro DESC'
  );
  return result.recordset || [];
}

module.exports = {
  getOrderDetailByOrderId,
  getAllOrderDetails
}; 
