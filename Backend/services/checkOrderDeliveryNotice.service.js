const { poolPromise } = require('../config/db');
const { getSqlPool, sql } = require('../config/sqlserver');
const { logger } = require('../utils/logger');

async function getOrdersReadyForOrderDeliveryNotice(
  sendFromDate = null,
  filterPc = null,
  filterFactura = null
) {
  try {
    const pool = await poolPromise;
    
    // 1. Buscar en order_files con file_id = 15, status_id = 2, was_sent = NULL/0
    let query = `
      SELECT id, pc, oc, factura, rut, path
      FROM order_files
      WHERE file_id = 15
        AND status_id = 2
        AND (was_sent IS NULL OR was_sent = 0)
    `;
    const params = [];
    
    if (filterPc) {
      query += ` AND pc = ?`;
      params.push(String(filterPc).trim());
    }
    
    if (filterFactura) {
      query += ` AND factura = ?`;
      params.push(String(filterFactura).trim());
    }
    
    query += ` ORDER BY pc ASC`;
    
    const [fileRows] = await pool.query(query, params);
    
    if (!fileRows.length) {
      logger.info(`[getOrdersReadyForOrderDeliveryNotice] No se encontraron registros en order_files pc=${filterPc || 'N/A'} factura=${filterFactura || 'N/A'}`);
      return [];
    }
    
    // 2. Para cada registro, validar en SQL Server
    const sqlPool = await getSqlPool();
    const validOrders = [];
    
    for (const fileRow of fileRows) {
      try {
        const request = sqlPool.request();
        request.input('factura', sql.VarChar, String(fileRow.factura).trim());
        request.input('pc', sql.VarChar, String(fileRow.pc).trim());
        
        if (sendFromDate) {
          request.input('sendFrom', sql.Date, sendFromDate);
        }
        
        // Debug: verificar datos del fileRow
        if (filterPc && fileRow.pc === filterPc) {
          logger.info(`[getOrdersReadyForOrderDeliveryNotice] fileRow pc=${fileRow.pc} factura=${fileRow.factura} rut=${fileRow.rut ?? 'NULL'} id=${fileRow.id}`);
        }
        
        // Validar en SQL Server: ETA_ENC_FA + 7 días y h.Fecha
        const sqlResult = await request.query(`
          SELECT TOP 1
            f.Nro AS pc,
            h.OC AS oc,
            f.Factura AS factura,
            NULLIF(LTRIM(RTRIM(f.ETA_ENC_FA)), '') AS eta,
            h.Fecha AS fecha_orden
          FROM jor_imp_FACT_90_softkey f
          INNER JOIN jor_imp_HDR_90_softkey h ON h.Nro = f.Nro
          WHERE f.Factura = @factura
            AND f.Nro = @pc
            AND ISNULL(LTRIM(RTRIM(LOWER(h.EstadoOV))), '') <> 'cancelada'
            AND ISDATE(NULLIF(LTRIM(RTRIM(f.ETA_ENC_FA)), '')) = 1
            AND DATEADD(day, 7, CAST(f.ETA_ENC_FA AS date)) <= CAST(GETDATE() AS date)
            ${sendFromDate ? 'AND CAST(h.Fecha AS date) >= @sendFrom' : ''}
        `);
        
        const sqlRow = sqlResult.recordset?.[0];
        
        if (sqlRow) {
          // Cumple todas las condiciones
          validOrders.push({
            id: fileRow.id,
            pc: String(fileRow.pc).trim(),
            oc: String(fileRow.oc).trim(),
            factura: String(fileRow.factura).trim(),
            rut: fileRow.rut,
            path: fileRow.path,
            eta: sqlRow.eta
          });
        } else {
          // Debug: por qué no cumple
          if (filterPc && fileRow.pc === filterPc) {
            const debugRequest = sqlPool.request();
            debugRequest.input('factura', sql.VarChar, String(fileRow.factura).trim());
            debugRequest.input('pc', sql.VarChar, String(fileRow.pc).trim());
            
            const debugResult = await debugRequest.query(`
              SELECT TOP 1
                f.Nro AS pc,
                f.Factura AS factura,
                NULLIF(LTRIM(RTRIM(f.ETA_ENC_FA)), '') AS eta,
                CASE
                  WHEN ISDATE(NULLIF(LTRIM(RTRIM(f.ETA_ENC_FA)), '')) = 1
                  THEN CAST(NULLIF(LTRIM(RTRIM(f.ETA_ENC_FA)), '') AS date)
                END AS eta_date,
                CASE
                  WHEN ISDATE(NULLIF(LTRIM(RTRIM(f.ETA_ENC_FA)), '')) = 1
                  THEN DATEADD(day, 7, CAST(NULLIF(LTRIM(RTRIM(f.ETA_ENC_FA)), '') AS date))
                END AS eta_plus_7,
                CAST(GETDATE() AS date) AS today,
                h.Fecha AS fecha_orden
              FROM jor_imp_FACT_90_softkey f
              INNER JOIN jor_imp_HDR_90_softkey h ON h.Nro = f.Nro
              WHERE f.Factura = @factura AND f.Nro = @pc
            `);
            
            const debugRow = debugResult.recordset?.[0];
            if (debugRow) {
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
              logger.info(`[getOrdersReadyForOrderDeliveryNotice] pc=${debugRow.pc} factura=${debugRow.factura ?? 'N/A'} ETA_ENC_FA=${debugRow.eta ?? 'N/A'} ETA+7=${debugRow.eta_plus_7 ?? 'N/A'} hoy=${debugRow.today ?? 'N/A'} enviar_hoy=${shouldSendToday} faltan_dias=${daysRemaining} tiene_eta=${hasEta} fecha_orden=${debugRow.fecha_orden ?? 'N/A'}`);
            }
          }
        }
      } catch (sqlError) {
        logger.error(`[getOrdersReadyForOrderDeliveryNotice] Error validando SQL pc=${fileRow.pc} factura=${fileRow.factura}: ${sqlError.message}`);
      }
    }
    
    return validOrders;
  } catch (error) {
    logger.error(`Error obteniendo ordenes para Order Delivery Notice: ${error.message}`);
    throw error;
  }
}

module.exports = {
  getOrdersReadyForOrderDeliveryNotice
};
