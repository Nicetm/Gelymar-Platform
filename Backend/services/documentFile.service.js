const { poolPromise } = require('../config/db');
const { getSqlPool, sql } = require('../config/sqlserver');
const { normalizeValue, normalizeDate, normalizeDecimal } = require('../mappers/sqlsoftkey/utils');
const { normalizeRut } = require('../utils/rut.util');
const { normalizeOcForCompare } = require('../utils/oc.util');

/**
 * REFACTORING: Updated to use LEFT JOIN between Vista_HDR and Vista_FACT
 * - Invoice fields (factura, fecha_factura) now come from Vista_FACT
 * - Removed id_nro_ov_mas_factura parameter (no longer needed)
 * - Maintains same public interface (pc, oc, factura)
 */
async function getOrderWithCustomerForPdf(pc, oc, factura = null) {
  if (!pc) return null;
  const sqlPool = await getSqlPool();
  const request = sqlPool.request();
  request.input('pc', sql.VarChar, pc);
  const normalizedFactura = factura !== null && factura !== undefined && factura !== '' && factura !== 0 && factura !== '0'
    ? String(factura).trim()
    : null;
  if (normalizedFactura) {
    request.input('factura', sql.VarChar, normalizedFactura);
  }
  if (oc) {
    request.input('oc', sql.VarChar, normalizeOcForCompare(oc));
  }
  const result = await request.query(`
    SELECT TOP 1
      h.Nro AS pc,
      h.OC AS oc,
      h.Rut AS customer_rut,
      f.Factura AS factura,
      f.Fecha_factura AS fecha_factura,
      h.Job AS currency,
      c.Nombre AS customer_name,
      c.Correo AS customer_email
    FROM jor_imp_HDR_90_softkey h
    LEFT JOIN jor_imp_FACT_90_softkey f ON f.Nro = h.Nro
      ${normalizedFactura ? 'AND f.Factura = @factura' : ''}
    LEFT JOIN jor_imp_CLI_01_softkey c ON c.Rut = h.Rut
    WHERE h.Nro = @pc
      AND ISNULL(LTRIM(RTRIM(LOWER(h.EstadoOV))), '') <> 'cancelada'
      AND LTRIM(RTRIM(c.EstadoCliente)) = 'Activo'
      ${oc ? "AND REPLACE(REPLACE(REPLACE(REPLACE(LOWER(h.OC), ' ', ''), '(', ''), ')', ''), '-', '') = @oc" : ''}
    ORDER BY h.Nro
  `);
  const row = result.recordset?.[0];
  if (!row) return null;
  return {
    pc: normalizeValue(row.pc),
    oc: normalizeValue(row.oc),
    customer_rut: normalizeValue(row.customer_rut),
    factura: normalizeValue(row.factura),
    fecha_factura: normalizeDate(row.fecha_factura),
    currency: normalizeValue(row.currency),
    customer_name: normalizeValue(row.customer_name),
    customer_email: normalizeValue(row.customer_email)
  };
}

/**
 * REFACTORING: Updated to use LEFT JOIN between Vista_HDR and Vista_FACT
 * - Invoice fields (fecha_eta_factura, fecha_etd_factura, medio_envio_factura, gasto_adicional_flete_factura) now come from Vista_FACT
 * - Removed id_nro_ov_mas_factura parameter (no longer needed)
 * - Maintains same public interface (pc, oc, factura)
 */
async function getOrderDetailForPdf(pc, oc, factura = null) {
  if (!pc) return null;
  const sqlPool = await getSqlPool();
  const request = sqlPool.request();
  request.input('pc', sql.VarChar, pc);
  const normalizedFactura = factura !== null && factura !== undefined && factura !== '' && factura !== 0 && factura !== '0'
    ? String(factura).trim()
    : null;
  if (normalizedFactura) {
    request.input('factura', sql.VarChar, normalizedFactura);
  }
  if (oc) {
    request.input('oc', sql.VarChar, normalizeOcForCompare(oc));
  }
  const query = `
    SELECT TOP 1
      h.Nro AS pc,
      h.OC AS oc,
      h.Tipo AS tipo,
      h.Clausula AS incoterm,
      h.Job AS currency,
      h.Direccion AS direccion_destino,
      h.Direccion_Alterna AS direccion_alterna,
      h.Puerto_Destino AS puerto_destino,
      h.Puerto_Embarque AS puerto_embarque,
      h.ETA_OV AS fecha_eta,
      h.ETD_OV AS fecha_etd,
      f.ETA_ENC_FA AS fecha_eta_factura,
      f.ETD_ENC_FA AS fecha_etd_factura,
      h.Certificados AS certificados,
      h.EstadoOV AS estado_ov,
      f.MedioDeEnvioFact AS medio_envio_factura,
      h.MedioDeEnvioOV AS medio_envio_ov,
      h.GtoAdicFlete AS gasto_adicional_flete,
      f.GtoAdicFleteFactura AS gasto_adicional_flete_factura,
      h.FechaOriginalCompromisoCliente AS fecha_incoterm,
      h.Condicion_venta AS condicion_venta,
      h.Nave AS nave
    FROM jor_imp_HDR_90_softkey h
    LEFT JOIN jor_imp_FACT_90_softkey f ON f.Nro = h.Nro
      ${normalizedFactura ? 'AND f.Factura = @factura' : ''}
    WHERE h.Nro = @pc
      AND ISNULL(LTRIM(RTRIM(LOWER(h.EstadoOV))), '') <> 'cancelada'
      ${oc ? "AND REPLACE(REPLACE(REPLACE(REPLACE(LOWER(h.OC), ' ', ''), '(', ''), ')', ''), '-', '') = @oc" : ''}
    ORDER BY h.Nro
  `;
  const result = await request.query(query);
  const row = result.recordset?.[0];
  if (!row) return null;
  return {
    pc: normalizeValue(row.pc),
    oc: normalizeValue(row.oc),
    tipo: normalizeValue(row.tipo),
    incoterm: normalizeValue(row.incoterm),
    currency: normalizeValue(row.currency),
    direccion_destino: normalizeValue(row.direccion_destino),
    direccion_alterna: normalizeValue(row.direccion_alterna),
    puerto_destino: normalizeValue(row.puerto_destino),
    puerto_embarque: normalizeValue(row.puerto_embarque),
    fecha_eta: normalizeDate(row.fecha_eta),
    fecha_etd: normalizeDate(row.fecha_etd),
    fecha_eta_factura: normalizeDate(row.fecha_eta_factura),
    fecha_etd_factura: normalizeDate(row.fecha_etd_factura),
    certificados: normalizeValue(row.certificados),
    estado_ov: normalizeValue(row.estado_ov),
    medio_envio_factura: normalizeValue(row.medio_envio_factura),
    medio_envio_ov: normalizeValue(row.medio_envio_ov),
    gasto_adicional_flete: normalizeDecimal(row.gasto_adicional_flete, 4),
    gasto_adicional_flete_factura: normalizeDecimal(row.gasto_adicional_flete_factura, 4),
    fecha_incoterm: normalizeDate(row.fecha_incoterm),
    condicion_venta: normalizeValue(row.condicion_venta),
    nave: normalizeValue(row.nave)
  };
}

/**
 * REFACTORING: Updated to remove id_nro_ov_mas_factura parameter
 * - Vista_ITEM query remains unchanged (no JOIN needed)
 * - Maintains same filtering logic for items with/without invoices
 */
async function getOrderItemsByPcOcFactura(pc, oc, factura) {
  if (!pc) return [];
  const sqlPool = await getSqlPool();
  const request = sqlPool.request();
  request.input('pc', sql.VarChar, pc);
  if (factura && factura !== 'null') {
    request.input('factura', sql.VarChar, factura);
  }
  const withFactura = factura && factura !== 'null';
  const query = `
    SELECT
      i.Nro AS pc,
      i.Linea AS linea,
      i.Item AS item_code,
      COALESCE(NULLIF(i.Descripcion, ''), i.Item, 'Producto') AS item_name,
      i.Descripcion AS descripcion,
      i.Tipo AS tipo,
      i.Mercado AS mercado,
      i.Cant_ordenada AS kg_solicitados,
      i.Cant_enviada AS kg_despachados,
      i.KilosFacturados AS kg_facturados,
      i.Precio_Unit AS unit_price,
      i.ETD_Item_OV AS fecha_etd,
      i.ETA_Item_OV AS fecha_eta,
      i.Factura AS factura
    FROM jor_imp_item_90_softkey i
    WHERE i.Nro = @pc
      ${withFactura ? 'AND i.Factura = @factura' : "AND (i.Factura IS NULL OR i.Factura = '' OR i.Factura = 0 OR i.Factura = '0')"}
    ORDER BY i.Linea
  `;
  const result = await request.query(query);
  return (result.recordset || []).map((row) => ({
    pc: normalizeValue(row.pc),
    linea: row.linea,
    item_code: normalizeValue(row.item_code),
    item_name: normalizeValue(row.item_name),
    descripcion: normalizeValue(row.descripcion),
    tipo: normalizeValue(row.tipo),
    mercado: normalizeValue(row.mercado),
    kg_solicitados: normalizeDecimal(row.kg_solicitados, 4),
    kg_despachados: normalizeDecimal(row.kg_despachados, 4),
    kg_facturados: normalizeDecimal(row.kg_facturados, 4),
    unit_price: normalizeDecimal(row.unit_price, 4),
    fecha_etd: normalizeDate(row.fecha_etd),
    fecha_eta: normalizeDate(row.fecha_eta),
    factura: normalizeValue(row.factura)
  }));
}

/**
 * REFACTORING: Query Vista_HDR only (no invoice data needed)
 * - Removed duplicate EstadoOV check
 * - Simplified ORDER BY clause
 */
async function getOrderPcOcById(orderId) {
  if (!orderId) return null;
  const sqlPool = await getSqlPool();
  const request = sqlPool.request();
  request.input('pc', sql.VarChar, String(orderId).trim());
  const result = await request.query(`
    SELECT TOP 1
      Nro AS pc,
      OC AS oc
    FROM jor_imp_HDR_90_softkey
    WHERE Nro = @pc
      AND ISNULL(LTRIM(RTRIM(LOWER(EstadoOV))), '') <> 'cancelada'
    ORDER BY Fecha DESC
  `);
  const row = result.recordset?.[0];
  return row ? { pc: row.pc?.trim(), oc: row.oc?.trim() } : null;
}

async function getOrderByPcOc(pc, oc) {
  const pool = await getSqlPool();
  const normalizedOc = normalizeOcForCompare(oc);
  const result = await pool
    .request()
    .input('pc', sql.VarChar, pc)
    .input('oc', sql.VarChar, normalizedOc)
    .query(`
      SELECT TOP 1
        Nro AS pc,
        OC AS oc
      FROM jor_imp_HDR_90_softkey
      WHERE Nro = @pc
        AND ISNULL(LTRIM(RTRIM(LOWER(EstadoOV))), '') <> 'cancelada'
        AND REPLACE(REPLACE(LOWER(OC), ' ', ''), '-', '') = @oc
    `);

  const row = result.recordset?.[0];
  return row ? { pc: row.pc?.trim(), oc: row.oc?.trim() } : null;
}

async function getOrderByPc(pc) {
  const pool = await getSqlPool();
  const result = await pool
    .request()
    .input('pc', sql.VarChar, pc)
    .query(`
      SELECT TOP 1
        Nro AS pc,
        OC AS oc
      FROM jor_imp_HDR_90_softkey
      WHERE Nro = @pc
        AND ISNULL(LTRIM(RTRIM(LOWER(EstadoOV))), '') <> 'cancelada'
    `);

  const row = result.recordset?.[0];
  return row ? { pc: row.pc?.trim(), oc: row.oc?.trim() } : null;
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
  const [[fileRow]] = await pool.query(
    `SELECT pc, oc FROM order_files WHERE id = ?`,
    [fileId]
  );
  if (!fileRow) return null;

  const [[userRow]] = await pool.query(
    `SELECT rut FROM users WHERE id = ?`,
    [userId]
  );
  if (!userRow?.rut) return null;

  const sqlPool = await getSqlPool();
  const sqlRequest = sqlPool.request();
  sqlRequest.input('pc', sql.VarChar, String(fileRow.pc).trim());
  sqlRequest.input('oc', sql.VarChar, normalizeOcForCompare(fileRow.oc));
  const sqlResult = await sqlRequest.query(`
    SELECT TOP 1 Rut
    FROM jor_imp_HDR_90_softkey
    WHERE Nro = @pc
      AND ISNULL(LTRIM(RTRIM(LOWER(EstadoOV))), '') <> 'cancelada'
      AND REPLACE(REPLACE(LOWER(OC), ' ', ''), '-', '') = @oc
  `);
  const row = sqlResult.recordset?.[0];
  if (!row?.Rut) return null;
  const sqlRut = normalizeRut(row.Rut);
  const userRut = normalizeRut(userRow.rut);
  return sqlRut && userRut && sqlRut === userRut ? { rut: row.Rut } : null;
}

async function getUserCustomerByUserId(userId) {
  const pool = await poolPromise;
  const [[row]] = await pool.query(
    `SELECT rut FROM users WHERE id = ?`,
    [userId]
  );
  return row ? { rut: row.rut } : null;
}

async function getFileCustomerCheck(fileId, customerRut) {
  const pool = await poolPromise;
  const [[fileRow]] = await pool.query(
    `SELECT pc, oc FROM order_files WHERE id = ?`,
    [fileId]
  );
  if (!fileRow) return null;

  const sqlPool = await getSqlPool();
  const sqlRequest = sqlPool.request();
  sqlRequest.input('pc', sql.VarChar, String(fileRow.pc).trim());
  sqlRequest.input('oc', sql.VarChar, normalizeOcForCompare(fileRow.oc));
  const sqlResult = await sqlRequest.query(`
    SELECT TOP 1 Rut
    FROM jor_imp_HDR_90_softkey
    WHERE Nro = @pc
      AND ISNULL(LTRIM(RTRIM(LOWER(EstadoOV))), '') <> 'cancelada'
      AND REPLACE(REPLACE(LOWER(OC), ' ', ''), '-', '') = @oc
  `);
  const row = sqlResult.recordset?.[0];
  if (!row?.Rut) return null;
  const sqlRut = normalizeRut(row.Rut);
  const userRut = normalizeRut(customerRut);
  return sqlRut && userRut && sqlRut === userRut
    ? { pc: fileRow.pc, oc: fileRow.oc }
    : null;
}

async function getCustomerCheckForDownload(fileId, userId) {
  const pool = await poolPromise;
  const [[fileRow]] = await pool.query(
    `SELECT pc, oc FROM order_files WHERE id = ?`,
    [fileId]
  );
  if (!fileRow) return null;

  const [[userRow]] = await pool.query(
    `SELECT rut FROM users WHERE id = ?`,
    [userId]
  );
  if (!userRow?.rut) return null;

  const sqlPool = await getSqlPool();
  const sqlRequest = sqlPool.request();
  sqlRequest.input('pc', sql.VarChar, String(fileRow.pc).trim());
  sqlRequest.input('oc', sql.VarChar, normalizeOcForCompare(fileRow.oc));
  const sqlResult = await sqlRequest.query(`
    SELECT TOP 1 Rut
    FROM jor_imp_HDR_90_softkey
    WHERE Nro = @pc
      AND REPLACE(REPLACE(LOWER(OC), ' ', ''), '-', '') = @oc
  `);
  const row = sqlResult.recordset?.[0];
  if (!row?.Rut) return null;
  const sqlRut = normalizeRut(row.Rut);
  const userRut = normalizeRut(userRow.rut);
  return sqlRut && userRut && sqlRut === userRut ? { rut: row.Rut } : null;
}

async function getCustomerByRut(customerRut) {
  const sqlPool = await getSqlPool();
  const sqlRequest = sqlPool.request();
  sqlRequest.input('rut', sql.VarChar, customerRut);
  const sqlResult = await sqlRequest.query(`
    SELECT TOP 1 Rut
    FROM jor_imp_CLI_01_softkey
    WHERE Rut = @rut
      AND LTRIM(RTRIM(EstadoCliente)) = 'Activo'
  `);
  if (sqlResult.recordset && sqlResult.recordset.length) {
    return { id: null, rut: customerRut };
  }
  return null;
}

/**
 * REFACTORING: Updated to use LEFT JOIN between Vista_HDR and Vista_FACT
 * - Invoice field (factura) now comes from Vista_FACT
 * - Removed id_nro_ov_mas_factura parameter and field (no longer needed)
 * - Maintains same public interface (orderId)
 */
async function getOrderWithCustomerForDefaultFiles(orderId) {
  if (!orderId) return null;
  const sqlPool = await getSqlPool();
  const request = sqlPool.request();
  request.input('pc', sql.VarChar, String(orderId).trim());
  const result = await request.query(`
    SELECT TOP 1
      h.Nro AS pc,
      h.OC AS oc,
      h.Rut AS customer_rut,
      f.Factura AS factura,
      c.Nombre AS customer_name
    FROM jor_imp_HDR_90_softkey h
    LEFT JOIN jor_imp_FACT_90_softkey f ON f.Nro = h.Nro
    LEFT JOIN jor_imp_CLI_01_softkey c ON c.Rut = h.Rut
    WHERE h.Nro = @pc
      AND ISNULL(LTRIM(RTRIM(LOWER(h.EstadoOV))), '') <> 'cancelada'
      AND LTRIM(RTRIM(c.EstadoCliente)) = 'Activo'
    ORDER BY h.Fecha DESC
  `);
  const row = result.recordset?.[0];
  return row ? {
    pc: row.pc?.trim(),
    oc: row.oc?.trim(),
    customer_rut: row.customer_rut?.trim(),
    customer_name: row.customer_name,
    factura: row.factura
  } : null;
}

module.exports = {
  getOrderWithCustomerForPdf,
  getOrderDetailForPdf,
  getOrderItemsByPcOcFactura,
  getOrderPcOcById,
  getOrderByPcOc,
  getOrderByPc,
  getLastFileIdentifierByPc,
  getCustomerCheckForViewFile,
  getUserCustomerByUserId,
  getFileCustomerCheck,
  getCustomerCheckForDownload,
  getCustomerByRut,
  getOrderWithCustomerForDefaultFiles
};
