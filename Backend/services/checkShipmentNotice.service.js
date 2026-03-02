const { poolPromise } = require('../config/db');
const { getSqlPool, sql } = require('../config/sqlserver');
const { logger } = require('../utils/logger');

/**
 * Get orders ready for Shipment Notice
 * 
 * REFACTORING CHANGES:
 * - OLD: Queried Vista_HDR (had duplicity, one row per invoice)
 * - NEW: Queries Vista_FACT directly (one row per invoice, no duplicity)
 * - REASON: Vista_HDR now has one row per order, invoice data moved to Vista_FACT
 * 
 * @param {string} sendFromDate - Filter orders from this date
 * @param {string} filterPc - Optional PC filter
 * @param {string} filterFactura - Optional Factura filter
 * @returns {Promise<Array>} Invoices ready for Shipment Notice
 */
async function getOrdersReadyForShipmentNotice(sendFromDate = null, filterPc = null, filterFactura = null) {
  try {
    const sqlPool = await getSqlPool();
    const request = sqlPool.request();
    if (sendFromDate) {
      request.input('sendFrom', sql.Date, sendFromDate);
    }
    if (filterPc) {
      request.input('pc', sql.VarChar, String(filterPc).trim());
    }
    if (filterFactura) {
      request.input('factura', sql.VarChar, String(filterFactura).trim());
    }

    // REFACTORING NOTE: Query Vista_FACT as primary table (not Vista_HDR)
    // Vista_FACT contains invoice data, INNER JOIN with Vista_HDR to get OC field
    // One Shipment document is generated per invoice that meets criteria
    // NOTE: Clausula (Incoterm) field does NOT exist in Vista_FACT, only in Vista_HDR
    // Incoterm is an order-level attribute, so we use h.Clausula
    const sqlResult = await request.query(`
      SELECT
        f.Nro AS pc,
        h.OC AS oc,
        h.Rut AS customer_rut,
        c.Nombre AS customer_name,
        f.Factura AS factura,
        f.Fecha_factura AS fecha_factura,
        NULLIF(LTRIM(RTRIM(f.ETD_ENC_FA)), '') AS etd,
        NULLIF(LTRIM(RTRIM(f.ETA_ENC_FA)), '') AS eta,
        h.Clausula AS incoterm
      FROM jor_imp_FACT_90_softkey f
      INNER JOIN jor_imp_HDR_90_softkey h ON h.Nro = f.Nro
      LEFT JOIN jor_imp_CLI_01_softkey c ON c.Rut = h.Rut
      WHERE ISNULL(LTRIM(RTRIM(LOWER(h.EstadoOV))), '') <> 'cancelada'
        AND LTRIM(RTRIM(c.EstadoCliente)) = 'Activo'
        AND f.Factura IS NOT NULL
        AND LTRIM(RTRIM(f.Factura)) <> ''
        AND f.Factura <> 0
        ${filterPc ? 'AND f.Nro = @pc' : ''}
        ${filterFactura ? 'AND f.Factura = @factura' : ''}
        AND h.Clausula IN ('CFR', 'CIF', 'CIP', 'DAP', 'DDP')
        AND ISDATE(NULLIF(LTRIM(RTRIM(f.ETD_ENC_FA)), '')) = 1
        AND ISDATE(NULLIF(RTRIM(RTRIM(f.ETA_ENC_FA)), '')) = 1
        ${sendFromDate ? `AND CASE
              WHEN ISDATE(f.Fecha_factura) = 1 THEN CAST(f.Fecha_factura AS date)
            END >= @sendFrom` : ''}
      ORDER BY f.Nro ASC, f.Factura ASC
    `);

    const rows = sqlResult.recordset || [];
    if (!rows.length) return [];

    const pcs = rows.map((row) => row.pc).filter(Boolean);
    const pool = await poolPromise;
    const [fileRows] = pcs.length
      ? await pool.query(
          `
            SELECT pc, oc, MAX(id) AS id, MAX(fecha_envio) AS fecha_envio
            FROM order_files
            WHERE file_id = 19 AND pc IN (?)
            GROUP BY pc, oc
          `,
          [pcs]
        )
      : [[]];

    const fileMap = new Map();
    for (const fileRow of fileRows) {
      const key = `${String(fileRow.pc).trim()}|${String(fileRow.oc).trim()}`;
      fileMap.set(key, fileRow);
    }

    // REFACTORING NOTE: Now includes factura field since we're querying Vista_FACT
    // File lookup now uses (pc, oc, factura) pattern for invoice-level documents
    return rows
      .map((row) => {
        const key = `${String(row.pc).trim()}|${String(row.oc).trim()}`;
        const fileRow = fileMap.get(key);
        return {
          id: `${row.pc}|${row.oc}|${row.factura}`,
          pc: String(row.pc).trim(),
          oc: String(row.oc).trim(),
          factura: String(row.factura).trim(),
          customer_name: row.customer_name,
          customer_rut: row.customer_rut,
          fecha_factura: row.fecha_factura,
          etd: row.etd,
          eta: row.eta,
          shipment_file_id: fileRow?.id || null,
          shipment_fecha_envio: fileRow?.fecha_envio || null
        };
      })
      .filter((row) => !row.shipment_file_id || !row.shipment_fecha_envio);
  } catch (error) {
    logger.error(`Error obteniendo ordenes para Shipment Notice: ${error.message}`);
    throw error;
  }
}

async function getShipmentFile(pc, oc) {
  const pool = await poolPromise;
  try {
    const [rows] = await pool.query(
      `SELECT id, path, fecha_envio FROM order_files WHERE pc = ? AND oc = ? AND file_id = ? ORDER BY id DESC LIMIT 1`,
      [pc, oc, 19]
    );
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    logger.error(`Error obteniendo Shipment Notice para PC/OC ${pc}/${oc}: ${error.message}`);
    throw error;
  }
}

module.exports = {
  getOrdersReadyForShipmentNotice,
  getShipmentFile
};
