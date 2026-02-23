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
      SELECT
        h.Nro AS pc,
        h.OC AS oc,
        h.Rut AS customer_rut,
        c.Nombre AS customer_name,
        h.Fecha_factura AS fecha_factura,
        h.Clausula AS incoterm
      FROM jor_imp_HDR_90_softkey h
      LEFT JOIN jor_imp_CLI_01_softkey c ON c.Rut = h.Rut
      WHERE ISNULL(LTRIM(RTRIM(UPPER(h.EstadoOV))), '') <> 'CANCELADO'
        AND h.Factura IS NOT NULL
        AND LTRIM(RTRIM(CONVERT(varchar(50), h.Factura))) <> ''
        AND h.Factura <> 0
        ${filterPc ? 'AND h.Nro = @pc' : ''}
        ${filterFactura ? 'AND h.Factura = @factura' : ''}
        AND h.Clausula IN (
          'EWX',
          'FCA',
          'FOB',
          'FCA Port',
          'FCA Warehouse Santiago',
          'FCA Airport',
          'FCAWSTGO'
        )
        -- regla Despacho_Stgo removida (columna no disponible)
        ${sendFromDate ? `AND CASE
              WHEN ISDATE(h.Fecha_factura) = 1 THEN CAST(h.Fecha_factura AS date)
            END >= @sendFrom` : ''}
      ORDER BY h.Nro ASC
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
            WHERE file_id = 6 AND pc IN (?)
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

    return rows
      .map((row) => {
        const key = `${String(row.pc).trim()}|${String(row.oc).trim()}`;
        const fileRow = fileMap.get(key);
        return {
          id: `${row.pc}|${row.oc}`,
          pc: String(row.pc).trim(),
          oc: String(row.oc).trim(),
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

async function getAvailabilityFile(pc, oc) {
  const pool = await poolPromise;
  try {
    const [rows] = await pool.query(
      `SELECT id, path, fecha_envio FROM order_files WHERE pc = ? AND oc = ? AND file_id = ? ORDER BY id DESC LIMIT 1`,
      [pc, oc, 6]
    );
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    logger.error(`Error obteniendo Availability Notice para PC/OC ${pc}/${oc}: ${error.message}`);
    throw error;
  }
}

module.exports = {
  getOrdersReadyForAvailabilityNotice,
  getAvailabilityFile
};
