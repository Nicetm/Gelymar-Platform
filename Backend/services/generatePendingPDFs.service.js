/**
 * Orquestador Cron — Generación de PDFs Pendientes
 * 
 * Consulta registros con status_id=1 en order_files y delega la generación
 * al servicio unificado (pdfGeneration.service.js).
 */
const { poolPromise } = require('../config/db');
const { logger } = require('../utils/logger');
const { logDocumentEvent } = require('./documentEvent.service');
const pdfGenerationService = require('./pdfGeneration.service');

/**
 * Genera PDFs físicos para registros pendientes en order_files con status_id = 1
 * @param {Object} filters - Filtros opcionales { pc, factura }
 * @returns {Promise<number>} Número de PDFs generados exitosamente
 */
async function generatePendingPDFs(filters = {}) {
  const startTimeMs = Date.now();
  let pdfsGenerated = 0;

  try {
    const { pc, factura } = filters || {};
    const normalizedFilterPc = pc ? String(pc).trim() : null;
    const normalizedFilterFactura = factura ? String(factura).trim() : null;
    const parts = [];
    if (normalizedFilterPc) parts.push(`pc=${normalizedFilterPc}`);
    if (normalizedFilterFactura) parts.push(`factura=${normalizedFilterFactura}`);
    logger.info(`[generatePendingPDFs] Iniciando${parts.length ? ` ${parts.join(' ')}` : ''}`);

    const pool = await poolPromise;

    // Leer sendFrom de param_config
    let sendFrom = null;
    try {
      const [configRows] = await pool.query('SELECT params FROM param_config WHERE name = ?', ['generatePDFs']);
      if (configRows.length > 0 && configRows[0].params) {
        let params = configRows[0].params;
        if (typeof params === 'string') params = JSON.parse(params);
        else if (typeof params !== 'object') params = {};
        sendFrom = params.sendFrom || null;
        if (sendFrom) logger.info(`[generatePendingPDFs] Filtrando desde fecha: ${sendFrom}`);
      }
    } catch (configError) {
      logger.warn(`[generatePendingPDFs] Error obteniendo sendFrom: ${configError.message}`);
    }

    // Consultar registros pendientes
    let query;
    const queryParams = [];

    if (sendFrom) {
      const { getSqlPool, sql } = require('../config/sqlserver');
      const sqlPool = await getSqlPool();
      const sqlRequest = sqlPool.request();
      sqlRequest.input('sendFrom', sql.Date, sendFrom);
      const sqlResult = await sqlRequest.query(`
        SELECT DISTINCT h.Nro AS pc FROM jor_imp_HDR_90_softkey h WHERE h.Fecha >= @sendFrom
      `);
      const validPcs = sqlResult.recordset.map(row => row.pc);

      if (validPcs.length === 0) {
        const duration = ((Date.now() - startTimeMs) / 1000).toFixed(2);
        logger.info(`[generatePendingPDFs] No hay órdenes con sendFrom=${sendFrom} - duration=${duration}s`);
        return { pdfsGenerated: 0, totalPending: 0, skipped: 0, duration: `${duration}s` };
      }

      query = `SELECT id, pc, oc, factura, name, path, file_identifier, file_id, document_type, created_at
               FROM order_files WHERE status_id = 1 AND pc IN (?)`;
      queryParams.push(validPcs);
    } else {
      query = `SELECT id, pc, oc, factura, name, path, file_identifier, file_id, document_type, created_at
               FROM order_files WHERE status_id = 1`;
    }

    if (normalizedFilterPc) { query += ` AND pc = ?`; queryParams.push(normalizedFilterPc); }
    if (normalizedFilterFactura) { query += ` AND factura = ?`; queryParams.push(normalizedFilterFactura); }
    query += ` ORDER BY created_at ASC`;

    const [pendingRecords] = await pool.query(query, queryParams);

    if (pendingRecords.length === 0) {
      const duration = ((Date.now() - startTimeMs) / 1000).toFixed(2);
      logger.info(`[generatePendingPDFs] No hay registros pendientes - duration=${duration}s`);
      return { pdfsGenerated: 0, totalPending: 0, skipped: 0, duration: `${duration}s` };
    }

    logger.info(`[generatePendingPDFs] Encontrados ${pendingRecords.length} registros pendientes`);

    // Procesar cada registro usando el servicio unificado
    for (const record of pendingRecords) {
      try {
        const pdfData = await pdfGenerationService.getPDFDataForRecord(record);
        if (!pdfData) {
          logger.warn(`[generatePendingPDFs] Sin datos para PDF id=${record.id} pc=${record.pc}`);
          continue;
        }

        const pdfResult = await pdfGenerationService.generatePDF(record, pdfData);
        if (!pdfResult) {
          logger.error(`[generatePendingPDFs] Error generando PDF id=${record.id} pc=${record.pc}`);
          continue;
        }

        await pdfGenerationService.updateRecordAfterGeneration(record.id, pdfResult.fileName, pdfResult.relativePath);

        await logDocumentEvent({
          source: 'cron', action: 'generate_pdf', process: 'generatePendingPDFs',
          fileId: record.id, docType: record.name, pc: record.pc, oc: record.oc,
          factura: record.factura, customerRut: pdfData.customerRut || null,
          userId: null, status: 'ok'
        });

        pdfsGenerated++;
        logger.info(`[generatePendingPDFs] PDF generado id=${record.id} pc=${record.pc} name=${pdfResult.fileName}`);
      } catch (recordError) {
        logger.error(`[generatePendingPDFs] Error procesando id=${record.id} pc=${record.pc}: ${recordError.message}`);
        await logDocumentEvent({
          source: 'cron', action: 'generate_pdf', process: 'generatePendingPDFs',
          fileId: record.id, docType: record.name, pc: record.pc, oc: record.oc,
          factura: record.factura, customerRut: null, userId: null,
          status: 'error', message: recordError.message
        });
        continue;
      }
    }

    const duration = ((Date.now() - startTimeMs) / 1000).toFixed(2);
    logger.info(`[generatePendingPDFs] Completado - duration=${duration}s pdfs=${pdfsGenerated}/${pendingRecords.length}`);
    return { pdfsGenerated, totalPending: pendingRecords.length, skipped: pendingRecords.length - pdfsGenerated, duration: `${duration}s` };
  } catch (error) {
    logger.error(`[generatePendingPDFs] Error: ${error.message} - duration=${((Date.now() - startTimeMs) / 1000).toFixed(2)}s`);
    throw error;
  }
}

module.exports = { generatePendingPDFs };
