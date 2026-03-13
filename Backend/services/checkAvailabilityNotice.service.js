const { poolPromise } = require('../config/db');
const { getSqlPool, sql } = require('../config/sqlserver');
const { logger } = require('../utils/logger');

/**
 * Get orders ready for Availability Notice
 * 
 * REFACTORING CHANGES:
 * - NEW: Queries order_files first (file_id=6, status_id=2, was_sent=NULL/0)
 * - Then validates in SQL Server (Incoterms, Factura)
 * - Uses rut from order_files (not from SQL Server)
 * 
 * @param {string} sendFromDate - Filter orders from this date
 * @param {string} filterPc - Optional PC filter
 * @param {string} filterFactura - Optional Factura filter
 * @returns {Promise<Array>} Orders ready for Availability Notice
 */
async function getOrdersReadyForAvailabilityNotice(sendFromDate = null, filterPc = null, filterFactura = null) {
  try {
    const pool = await poolPromise;
    
    // 1. Buscar en order_files con file_id = 6, status_id = 2, was_sent = NULL/0
    let query = `
      SELECT id, pc, oc, factura, rut, path
      FROM order_files
      WHERE file_id = 6
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
      logger.info(`[getOrdersReadyForAvailabilityNotice] No se encontraron registros en order_files pc=${filterPc || 'N/A'} factura=${filterFactura || 'N/A'}`);
      return [];
    }
    
    // 2. Para cada registro, validar en SQL Server
    const sqlPool = await getSqlPool();
    const validOrders = [];
    
    for (const fileRow of fileRows) {
      try {
        const request = sqlPool.request();
        request.input('pc', sql.VarChar, String(fileRow.pc).trim());
        request.input('factura', sql.VarChar, String(fileRow.factura).trim());
        
        if (sendFromDate) {
          request.input('sendFrom', sql.Date, sendFromDate);
        }
        
        // Validar en SQL Server: Incoterms de disponibilidad y factura válida
        const sqlResult = await request.query(`
          SELECT TOP 1
            f.Nro AS pc,
            h.OC AS oc,
            f.Factura AS factura,
            h.Clausula AS incoterm,
            h.Fecha AS fecha_orden
          FROM jor_imp_FACT_90_softkey f
          INNER JOIN jor_imp_HDR_90_softkey h ON h.Nro = f.Nro
          WHERE f.Nro = @pc
            AND f.Factura = @factura
            AND f.Factura IS NOT NULL
            AND LTRIM(RTRIM(f.Factura)) <> ''
            AND f.Factura <> 0
            AND h.Clausula IN ('EWX', 'FCA', 'FOB', 'FCA Port', 'FCA Warehouse Santiago', 'FCA Airport', 'FCAWSTGO')
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
            incoterm: sqlRow.incoterm,
            fecha_factura: sqlRow.fecha_factura
          });
        } else {
          // Debug: por qué no cumple
          if (filterPc && fileRow.pc === filterPc) {
            const debugRequest = sqlPool.request();
            debugRequest.input('pc', sql.VarChar, String(fileRow.pc).trim());
            debugRequest.input('factura', sql.VarChar, String(fileRow.factura).trim());
            
            const debugResult = await debugRequest.query(`
              SELECT TOP 1
                f.Nro AS pc,
                h.OC AS oc,
                f.Factura AS factura,
                h.Clausula AS incoterm,
                f.Fecha_factura AS fecha_factura
              FROM jor_imp_FACT_90_softkey f
              INNER JOIN jor_imp_HDR_90_softkey h ON h.Nro = f.Nro
              WHERE f.Nro = @pc AND f.Factura = @factura
            `);
            
            const debugRow = debugResult.recordset?.[0];
            if (debugRow) {
              const hasValidIncoterm = ['EWX', 'FCA', 'FOB', 'FCA Port', 'FCA Warehouse Santiago', 'FCA Airport', 'FCAWSTGO'].includes(String(debugRow.incoterm || '').trim());
              const hasValidFactura = debugRow.factura && String(debugRow.factura).trim() !== '' && debugRow.factura !== 0;
              logger.info(`[getOrdersReadyForAvailabilityNotice] pc=${debugRow.pc} oc=${debugRow.oc || 'N/A'} factura=${debugRow.factura ?? 'N/A'} incoterm=${debugRow.incoterm ?? 'N/A'} valid_incoterm=${hasValidIncoterm} valid_factura=${hasValidFactura} fecha_factura=${debugRow.fecha_factura ?? 'N/A'}`);
            }
          }
        }
      } catch (sqlError) {
        logger.error(`[getOrdersReadyForAvailabilityNotice] Error validando SQL pc=${fileRow.pc} factura=${fileRow.factura}: ${sqlError.message}`);
      }
    }
    
    return validOrders;
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
