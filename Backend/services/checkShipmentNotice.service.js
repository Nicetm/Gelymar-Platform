const { poolPromise } = require('../config/db');
const { getSqlPool, sql } = require('../config/sqlserver');
const { logger } = require('../utils/logger');
const { getIncotermValidationConfig, isInList } = require('../utils/incotermValidation');

/**
 * Get orders ready for Shipment Notice
 * 
 * REFACTORING CHANGES:
 * - NEW: Queries order_files first (file_id=19, status_id=2, was_sent=NULL/0)
 * - Then validates in SQL Server (Incoterms, ETD/ETA)
 * - Uses rut from order_files (not from SQL Server)
 * 
 * @param {string} sendFromDate - Filter orders from this date
 * @param {string} filterPc - Optional PC filter
 * @param {string} filterFactura - Optional Factura filter
 * @returns {Promise<Array>} Orders ready for Shipment Notice
 */
async function getOrdersReadyForShipmentNotice(sendFromDate = null, filterPc = null, filterFactura = null) {
  try {
    const pool = await poolPromise;
    
    // 1. Buscar en order_files con file_id = 19, status_id = 2, was_sent = NULL/0
    let query = `
      SELECT id, pc, oc, factura, rut, path
      FROM order_files
      WHERE file_id = 19
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
      logger.info(`[getOrdersReadyForShipmentNotice] No se encontraron registros en order_files pc=${filterPc || 'N/A'} factura=${filterFactura || 'N/A'}`);
      return [];
    }
    
    // 2. Load incoterm validation config
    const incotermConfig = await getIncotermValidationConfig();

    // 3. Para cada registro, validar en SQL Server
    const sqlPool = await getSqlPool();
    const validOrders = [];
    
    for (const fileRow of fileRows) {
      try {
        const request = sqlPool.request();
        request.input('pc', sql.VarChar, String(fileRow.pc).trim());
        
        if (sendFromDate) {
          request.input('sendFrom', sql.Date, sendFromDate);
        }
        
        // Validar en SQL Server: ETD/ETA y h.Fecha (incoterm se valida en JS)
        const sqlResult = await request.query(`
          SELECT TOP 1
            f.Nro AS pc,
            h.OC AS oc,
            f.Factura AS factura,
            NULLIF(LTRIM(RTRIM(f.ETD_ENC_FA)), '') AS etd,
            NULLIF(LTRIM(RTRIM(f.ETA_ENC_FA)), '') AS eta,
            h.Clausula AS incoterm,
            h.Fecha AS fecha_orden
          FROM jor_imp_FACT_90_softkey f
          INNER JOIN jor_imp_HDR_90_softkey h ON h.Nro = f.Nro
          WHERE f.Nro = @pc
            AND ISDATE(NULLIF(LTRIM(RTRIM(f.ETD_ENC_FA)), '')) = 1
            AND ISDATE(NULLIF(LTRIM(RTRIM(f.ETA_ENC_FA)), '')) = 1
            ${sendFromDate ? 'AND CAST(h.Fecha AS date) >= @sendFrom' : ''}
        `);
        
        const sqlRow = sqlResult.recordset?.[0];
        
        if (sqlRow) {
          // Validate incoterm in JS if enabled
          if (incotermConfig.enable && !isInList(incotermConfig.shipmentIncoterms, sqlRow.incoterm)) {
            logger.info(`[getOrdersReadyForShipmentNotice] pc=${fileRow.pc} skipped: incoterm=${sqlRow.incoterm} not in allowed list`);
            continue;
          }
          // Cumple todas las condiciones
          validOrders.push({
            id: fileRow.id,
            pc: String(fileRow.pc).trim(),
            oc: String(fileRow.oc).trim(),
            factura: fileRow.factura ? String(fileRow.factura).trim() : null,
            rut: fileRow.rut,
            path: fileRow.path,
            etd: sqlRow.etd,
            eta: sqlRow.eta,
            incoterm: sqlRow.incoterm
          });
        } else {
          // Debug: por qué no cumple
          if (filterPc && fileRow.pc === filterPc) {
            const debugRequest = sqlPool.request();
            debugRequest.input('pc', sql.VarChar, String(fileRow.pc).trim());
            
            const debugResult = await debugRequest.query(`
              SELECT TOP 1
                f.Nro AS pc,
                h.OC AS oc,
                f.Factura AS factura,
                NULLIF(LTRIM(RTRIM(f.ETD_ENC_FA)), '') AS etd,
                NULLIF(LTRIM(RTRIM(f.ETA_ENC_FA)), '') AS eta,
                h.Clausula AS incoterm,
                h.Fecha AS fecha_orden,
                CASE
                  WHEN ISDATE(NULLIF(LTRIM(RTRIM(f.ETD_ENC_FA)), '')) = 1
                  THEN 'valid'
                  ELSE 'invalid'
                END AS etd_valid,
                CASE
                  WHEN ISDATE(NULLIF(LTRIM(RTRIM(f.ETA_ENC_FA)), '')) = 1
                  THEN 'valid'
                  ELSE 'invalid'
                END AS eta_valid
              FROM jor_imp_FACT_90_softkey f
              INNER JOIN jor_imp_HDR_90_softkey h ON h.Nro = f.Nro
              WHERE f.Nro = @pc
            `);
            
            const debugRow = debugResult.recordset?.[0];
            if (debugRow) {
              const hasValidIncoterm = incotermConfig.enable ? isInList(incotermConfig.shipmentIncoterms, String(debugRow.incoterm || '').trim()) : true;
              logger.info(`[getOrdersReadyForShipmentNotice] pc=${debugRow.pc} oc=${debugRow.oc || 'N/A'} factura=${debugRow.factura ?? 'N/A'} incoterm=${debugRow.incoterm ?? 'N/A'} valid_incoterm=${hasValidIncoterm} etd=${debugRow.etd ?? 'N/A'} etd_valid=${debugRow.etd_valid} eta=${debugRow.eta ?? 'N/A'} eta_valid=${debugRow.eta_valid} fecha_orden=${debugRow.fecha_orden ?? 'N/A'}`);
            }
          }
        }
      } catch (sqlError) {
        logger.error(`[getOrdersReadyForShipmentNotice] Error validando SQL pc=${fileRow.pc}: ${sqlError.message}`);
      }
    }
    
    return validOrders;
  } catch (error) {
    logger.error(`Error obteniendo ordenes para Shipment Notice: ${error.message}`);
    throw error;
  }
}

module.exports = {
  getOrdersReadyForShipmentNotice
};
