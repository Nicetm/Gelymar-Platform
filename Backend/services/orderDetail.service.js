// services/orderDetail.service.js
const { getSqlPool, sql } = require('../config/sqlserver');
const { mapHdrRowToOrder } = require('../mappers/sqlsoftkey/hdr.mapper');
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


// Obtener order detail por order_id
async function getOrderDetailByOrderId(orderId) {
  const key = parseOrderKey(orderId);
  if (!key) return null;

  const sqlPool = await getSqlPool();
  const request = sqlPool.request();
  request.input('pc', sql.VarChar, key.pc);
  if (key.oc) {
    request.input('oc', sql.VarChar, normalizeOcForCompare(key.oc));
  }

  const query = `
    SELECT TOP 1 *
    FROM jor_imp_HDR_90_softkey
    WHERE Nro = @pc
    ${key.oc ? "AND REPLACE(REPLACE(UPPER(OC), ' ', ''), '-', '') = @oc" : ''}
    ORDER BY Fecha DESC
  `;

  const result = await request.query(query);
  const row = result.recordset?.[0];
  if (!row) return null;

  const mapped = mapHdrRowToOrder(row);

  return {
    id: `${mapped.pc}|${mapped.oc}`,
    order_id: `${mapped.pc}|${mapped.oc}`,
    pc: mapped.pc,
    oc: mapped.oc,
    fecha: mapped.fecha,
    tipo: row.Tipo ?? null,
    incoterm: mapped.incoterm,
    currency: mapped.currency,
    direccion_destino: row.Direccion ?? null,
    direccion_alterna: row.Direccion_Alterna ?? null,
    puerto_embarque: row.Puerto_Embarque ?? null,
    puerto_destino: mapped.puerto_destino,
    fecha_eta: mapped.fecha_eta,
    fecha_etd: mapped.fecha_etd,
    fecha_eta_factura: mapped.fecha_eta_factura,
    fecha_etd_factura: mapped.fecha_etd_factura,
    certificados: mapped.certificados,
    estado_ov: mapped.estado_ov,
    medio_envio_factura: mapped.medio_envio_factura,
    medio_envio_ov: mapped.medio_envio_ov,
    gasto_adicional_flete: row.GtoAdicFlete ?? null,
    gasto_adicional_flete_factura: row.GtoAdicFleteFactura ?? null,
    fecha_incoterm: row.FechaOriginalCompromisoCliente ?? null,
    localizacion: row.Localizacion ?? null,
    codigo_impuesto: row.Cod_Impto ?? null,
    vendedor: mapped.vendedor,
    nave: row.Nave ?? null,
    condicion_venta: row.Condicion_venta ?? null,
    linea: row.Linea ?? null
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
