const { poolPromise } = require('../config/db');
const { getSqlPool, sql } = require('../config/sqlserver');
const { logger } = require('../utils/logger');

async function getOrdersReadyForOrderDeliveryNotice(
  sendFromDate = null,
  filterPc = null,
  filterFactura = null,
  filterId = null
) {
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
    if (filterId) {
      request.input('idNro', sql.VarChar, String(filterId).trim());
    }

    const sqlResult = await request.query(`
      SELECT
        h.Nro AS pc,
        h.OC AS oc,
        h.Rut AS customer_rut,
        c.Nombre AS customer_name,
        h.Fecha_factura AS fecha_factura,
        NULLIF(LTRIM(RTRIM(h.ETA_ENC_FA)), '') AS eta,
        h.Factura AS factura,
        h.IDNroOvMasFactura AS id_nro_ov_mas_factura
      FROM jor_imp_HDR_90_softkey h
      LEFT JOIN jor_imp_CLI_01_softkey c ON c.Rut = h.Rut
      WHERE h.Factura IS NOT NULL
        AND LTRIM(RTRIM(CONVERT(varchar(50), h.Factura))) <> ''
        AND h.Factura <> 0
        ${filterPc ? 'AND h.Nro = @pc' : ''}
        ${filterFactura ? 'AND h.Factura = @factura' : ''}
        ${filterId ? 'AND h.IDNroOvMasFactura = @idNro' : ''}
        AND CASE
              WHEN ISDATE(NULLIF(LTRIM(RTRIM(h.ETA_ENC_FA)), '')) = 1
              THEN CAST(NULLIF(LTRIM(RTRIM(h.ETA_ENC_FA)), '') AS date)
            END IS NOT NULL
        AND DATEADD(
              day,
              7,
              CASE
                WHEN ISDATE(NULLIF(LTRIM(RTRIM(h.ETA_ENC_FA)), '')) = 1
                THEN CAST(NULLIF(LTRIM(RTRIM(h.ETA_ENC_FA)), '') AS date)
              END
            ) <= CAST(GETDATE() AS date)
        ${sendFromDate ? `AND CASE
              WHEN ISDATE(h.Fecha_factura) = 1 THEN CAST(h.Fecha_factura AS date)
            END >= @sendFrom` : ''}
      ORDER BY h.Nro ASC
    `);

    const rows = sqlResult.recordset || [];
    if (!rows.length) {
      if (filterPc) {
        try {
          const debugRequest = sqlPool.request();
          debugRequest.input('pc', sql.VarChar, String(filterPc).trim());
          if (filterFactura) {
            debugRequest.input('factura', sql.VarChar, String(filterFactura).trim());
          }
          if (filterId) {
            debugRequest.input('idNro', sql.VarChar, String(filterId).trim());
          }
          const debugResult = await debugRequest.query(`
            SELECT TOP 1
              h.Nro AS pc,
              h.OC AS oc,
              h.Factura AS factura,
              NULLIF(LTRIM(RTRIM(h.ETA_ENC_FA)), '') AS eta,
              CASE
                WHEN ISDATE(NULLIF(LTRIM(RTRIM(h.ETA_ENC_FA)), '')) = 1
                THEN CAST(NULLIF(LTRIM(RTRIM(h.ETA_ENC_FA)), '') AS date)
              END AS eta_date,
              CASE
                WHEN ISDATE(NULLIF(LTRIM(RTRIM(h.ETA_ENC_FA)), '')) = 1
                THEN DATEADD(day, 7, CAST(NULLIF(LTRIM(RTRIM(h.ETA_ENC_FA)), '') AS date))
              END AS eta_plus_7,
              CAST(GETDATE() AS date) AS today
            FROM jor_imp_HDR_90_softkey h
            WHERE h.Nro = @pc
              ${filterFactura ? 'AND h.Factura = @factura' : ''}
              ${filterId ? 'AND h.IDNroOvMasFactura = @idNro' : ''}
            ORDER BY h.Nro ASC
          `);
          const debugRow = debugResult.recordset?.[0];
          if (debugRow) {
            const hasFactura = debugRow.factura !== null && String(debugRow.factura).trim() !== '' && Number(debugRow.factura) !== 0;
            const hasEta = !!debugRow.eta_date;
            let daysRemaining = 'N/A';
            if (debugRow.eta_plus_7 && debugRow.today) {
              const etaPlus7 = new Date(debugRow.eta_plus_7);
              const today = new Date(debugRow.today);
              const msDiff = etaPlus7.getTime() - today.getTime();
              daysRemaining = Math.ceil(msDiff / (1000 * 60 * 60 * 24));
            }
            const shouldSendToday = debugRow.eta_plus_7 && debugRow.today
              ? new Date(debugRow.eta_plus_7) <= new Date(debugRow.today)
              : false;
            logger.info(`[getOrdersReadyForOrderDeliveryNotice] pc=${debugRow.pc} factura=${debugRow.factura ?? 'N/A'} ETA_ENC_FA=${debugRow.eta ?? 'N/A'} ETA+7=${debugRow.eta_plus_7 ?? 'N/A'} hoy=${debugRow.today ?? 'N/A'} enviar_hoy=${shouldSendToday} faltan_dias=${daysRemaining} tiene_factura=${hasFactura} tiene_eta=${hasEta}`);
          } else {
            logger.info(`[getOrdersReadyForOrderDeliveryNotice] pc=${filterPc} no encontrado en jor_imp_HDR_90_softkey`);
          }
        } catch (debugError) {
          logger.error(`Error debuggeando Order Delivery Notice pc=${filterPc}: ${debugError.message}`);
        }
      }
      return [];
    }

    const pcs = rows.map((row) => row.pc).filter(Boolean);
    const pool = await poolPromise;
    const [fileRows] = pcs.length
      ? await pool.query(
          `
            SELECT pc, oc, MAX(id) AS id, MAX(fecha_envio) AS fecha_envio
            FROM order_files
            WHERE file_id = 15 AND pc IN (?)
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
          eta: row.eta,
          delivery_file_id: fileRow?.id || null,
          delivery_fecha_envio: fileRow?.fecha_envio || null
        };
      })
      .filter((row) => !row.delivery_file_id || !row.delivery_fecha_envio);
  } catch (error) {
    logger.error(`Error obteniendo ordenes para Order Delivery Notice: ${error.message}`);
    throw error;
  }
}

async function getOrderDeliveryFile(pc, oc) {
  const pool = await poolPromise;
  try {
    const [rows] = await pool.query(
      `SELECT id, path, fecha_envio FROM order_files WHERE pc = ? AND oc = ? AND file_id = ? ORDER BY id DESC LIMIT 1`,
      [pc, oc, 15]
    );
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    logger.error(`Error obteniendo Order Delivery Notice para PC/OC ${pc}/${oc}: ${error.message}`);
    throw error;
  }
}

module.exports = {
  getOrdersReadyForOrderDeliveryNotice,
  getOrderDeliveryFile
};
