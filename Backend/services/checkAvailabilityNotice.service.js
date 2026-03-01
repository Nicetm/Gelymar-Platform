const { poolPromise } = require('../config/db');
const { getSqlPool, sql } = require('../config/sqlserver');
const { logger } = require('../utils/logger');

async function getOrdersReadyForAvailabilityNotice(sendFromDate = null, filterPc = null, filterFactura = null) {
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

    const sqlResult = await request.query(`
      -- REFACTORING NOTE: Changed from Vista_HDR to Vista_FACT as primary table
      -- This generates one Availability document per invoice (not per order)
      -- NOTE: Clausula (Incoterm) field does NOT exist in Vista_FACT, only in Vista_HDR
      -- Incoterm is an order-level attribute, so we use h.Clausula
      SELECT
        f.Nro AS pc,
        h.OC AS oc,
        h.Rut AS customer_rut,
        c.Nombre AS customer_name,
        f.Factura AS factura,
        f.Fecha_factura AS fecha_factura,
        h.Clausula AS incoterm
      FROM jor_imp_FACT_90_softkey f
      INNER JOIN jor_imp_HDR_90_softkey h ON h.Nro = f.Nro
      LEFT JOIN jor_imp_CLI_01_softkey c ON c.Rut = h.Rut
      WHERE ISNULL(LTRIM(RTRIM(LOWER(h.EstadoOV))), '') <> 'cancelada'
        AND f.Factura IS NOT NULL
        AND LTRIM(RTRIM(f.Factura)) <> ''
        AND f.Factura <> 0
        ${filterPc ? 'AND f.Nro = @pc' : ''}
        ${filterFactura ? 'AND f.Factura = @factura' : ''}
        AND h.Clausula IN (
          'EWX',
          'FCA',
          'FOB',
          'FCA Port',
          'FCA Warehouse Santiago',
          'FCA Airport',
          'FCAWSTGO'
        )
        ${sendFromDate ? `AND CASE
              WHEN ISDATE(f.Fecha_factura) = 1 THEN CAST(f.Fecha_factura AS date)
            END >= @sendFrom` : ''}
      ORDER BY f.Nro ASC
    `);

    const rows = sqlResult.recordset || [];
    if (!rows.length) return [];

    // Build list of (pc, oc, factura) tuples for file lookup
    const fileKeys = rows.map((row) => ({
      pc: row.pc,
      oc: row.oc,
      factura: row.factura
    })).filter(k => k.pc && k.oc && k.factura);

    const pool = await poolPromise;
    const [fileRows] = fileKeys.length
      ? await pool.query(
          `
            SELECT pc, oc, factura, MAX(id) AS id, MAX(fecha_envio) AS fecha_envio
            FROM order_files
            WHERE file_id = 6 AND (pc, oc, factura) IN (?)
            GROUP BY pc, oc, factura
          `,
          [fileKeys.map(k => [k.pc, k.oc, k.factura])]
        )
      : [[]];

    const fileMap = new Map();
    for (const fileRow of fileRows) {
      const key = `${String(fileRow.pc).trim()}|${String(fileRow.oc).trim()}|${String(fileRow.factura).trim()}`;
      fileMap.set(key, fileRow);
    }

    return rows
      .map((row) => {
        const key = `${String(row.pc).trim()}|${String(row.oc).trim()}|${String(row.factura).trim()}`;
        const fileRow = fileMap.get(key);
        return {
          id: `${row.pc}|${row.oc}|${row.factura}`,
          pc: String(row.pc).trim(),
          oc: String(row.oc).trim(),
          factura: String(row.factura).trim(),
          customer_name: row.customer_name,
          customer_rut: row.customer_rut,
          fecha_factura: row.fecha_factura,
          availability_file_id: fileRow?.id || null,
          availability_fecha_envio: fileRow?.fecha_envio || null
        };
      })
      .filter((row) => !row.availability_file_id || !row.availability_fecha_envio);
  } catch (error) {
    logger.error(`Error obteniendo ordenes para Availability Notice: ${error.message}`);
    throw error;
  }
}

async function getAvailabilityFile(pc, oc, factura = null) {
  const pool = await poolPromise;
  try {
    const query = factura
      ? `SELECT id, path, fecha_envio FROM order_files WHERE pc = ? AND oc = ? AND factura = ? AND file_id = ? ORDER BY id DESC LIMIT 1`
      : `SELECT id, path, fecha_envio FROM order_files WHERE pc = ? AND oc = ? AND file_id = ? ORDER BY id DESC LIMIT 1`;
    
    const params = factura ? [pc, oc, factura, 6] : [pc, oc, 6];
    
    const [rows] = await pool.query(query, params);
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    logger.error(`Error obteniendo Availability Notice para PC/OC${factura ? '/Factura' : ''} ${pc}/${oc}${factura ? `/${factura}` : ''}: ${error.message}`);
    throw error;
  }
}

module.exports = {
  getOrdersReadyForAvailabilityNotice,
  getAvailabilityFile
};
