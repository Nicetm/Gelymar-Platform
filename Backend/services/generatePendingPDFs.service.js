const { poolPromise } = require('../config/db');
const { logger } = require('../utils/logger');
const { logDocumentEvent } = require('./documentEvent.service');
const path = require('path');
const fs = require('fs').promises;
const {
  generateRecepcionOrden,
  generateAvisoEmbarque,
  generateAvisoEntrega,
  generateAvisoDisponibilidad,
  getWeekOfYear
} = require('../pdf-generator/generator');

// Mapeo de file_id a nombre de documento y función generadora
const FILE_ID_MAP = {
  9: { name: 'Order Receipt Notice', generator: generateRecepcionOrden },
  19: { name: 'Shipment Notice', generator: generateAvisoEmbarque },
  15: { name: 'Order Delivery Notice', generator: generateAvisoEntrega },
  6: { name: 'Availability Notice', generator: generateAvisoDisponibilidad }
};

/**
 * Genera PDFs físicos para registros pendientes en order_files con status_id = 1
 * @param {Object} filters - Filtros opcionales { pc, factura }
 * @returns {Promise<number>} Número de PDFs generados exitosamente
 */
async function generatePendingPDFs(filters = {}) {
  const startTime = new Date();
  const startTimeMs = Date.now();
  let pdfsGenerated = 0;
  
  try {
    const { pc, factura } = filters || {};
    const normalizedFilterPc = pc ? String(pc).trim() : null;
    const normalizedFilterFactura = factura ? String(factura).trim() : null;
    const parts = [];
    if (normalizedFilterPc) parts.push(`pc=${normalizedFilterPc}`);
    if (normalizedFilterFactura) parts.push(`factura=${normalizedFilterFactura}`);
    logger.info(`[generatePendingPDFs] Iniciando generación de PDFs pendientes - timestamp=${startTime.toISOString()}${parts.length ? ` ${parts.join(' ')}` : ''}`);
    
    const pool = await poolPromise;
    
    // Obtener configuración desde param_config para obtener sendFrom
    let sendFrom = null;
    try {
      const [configRows] = await pool.query(
        'SELECT params FROM param_config WHERE name = ?',
        ['generatePDFs']
      );
      if (configRows.length > 0 && configRows[0].params) {
        // Verificar si params ya es un objeto o es un string JSON
        let params;
        if (typeof configRows[0].params === 'string') {
          params = JSON.parse(configRows[0].params);
        } else if (typeof configRows[0].params === 'object') {
          params = configRows[0].params;
        } else {
          logger.warn(`[generatePendingPDFs] Tipo de params inesperado: ${typeof configRows[0].params}`);
          params = {};
        }
        sendFrom = params.sendFrom || null;
        if (sendFrom) {
          logger.info(`[generatePendingPDFs] Filtrando registros desde fecha: ${sendFrom}`);
        }
      }
    } catch (configError) {
      logger.warn(`[generatePendingPDFs] Error obteniendo configuración sendFrom: ${configError.message}`);
      logger.warn(`[generatePendingPDFs] Valor de params: ${JSON.stringify(configRows?.[0]?.params)}`);
    }
    
    // Consultar registros con status_id = 1, ordenados por created_at ascendente
    // Si sendFrom está configurado, hacer JOIN con SQL Server para filtrar por h.Fecha
    let query;
    const params = [];
    
    if (sendFrom) {
      // Necesitamos hacer JOIN con SQL Server para obtener h.Fecha
      const { getSqlPool, sql } = require('../config/sqlserver');
      const sqlPool = await getSqlPool();
      
      // Primero obtener los PC que cumplen con la fecha desde SQL Server
      let sqlQuery = `
        SELECT DISTINCT h.Nro AS pc
        FROM jor_imp_HDR_90_softkey h
        WHERE h.Fecha >= @sendFrom
          AND ISNULL(LTRIM(RTRIM(LOWER(h.EstadoOV))), '') <> 'cancelada'
      `;
      
      const sqlRequest = sqlPool.request();
      sqlRequest.input('sendFrom', sql.Date, sendFrom);
      
      const sqlResult = await sqlRequest.query(sqlQuery);
      const validPcs = sqlResult.recordset.map(row => row.pc);
      
      if (validPcs.length === 0) {
        const endTime = new Date();
        const duration = ((Date.now() - startTimeMs) / 1000).toFixed(2);
        logger.info(`[generatePendingPDFs] No hay órdenes que cumplan con sendFrom=${sendFrom} - timestamp=${endTime.toISOString()} duration=${duration}s`);
        return 0;
      }
      
      // Ahora filtrar order_files por los PC válidos
      query = `
        SELECT 
          id, pc, oc, factura, name, path, file_identifier, file_id, created_at
        FROM order_files
        WHERE status_id = 1
          AND pc IN (?)
      `;
      params.push(validPcs);
      
      if (normalizedFilterPc) {
        query += ` AND pc = ?`;
        params.push(normalizedFilterPc);
      }
      
      if (normalizedFilterFactura) {
        query += ` AND factura = ?`;
        params.push(normalizedFilterFactura);
      }
      
      query += ` ORDER BY created_at ASC`;
      
    } else {
      // Sin filtro de fecha, consulta normal
      query = `
        SELECT 
          id, pc, oc, factura, name, path, file_identifier, file_id, created_at
        FROM order_files
        WHERE status_id = 1
      `;
      
      if (normalizedFilterPc) {
        query += ` AND pc = ?`;
        params.push(normalizedFilterPc);
      }
      
      if (normalizedFilterFactura) {
        query += ` AND factura = ?`;
        params.push(normalizedFilterFactura);
      }
      
      query += ` ORDER BY created_at ASC`;
    }
    
    const [pendingRecords] = await pool.query(query, params);
    
    if (pendingRecords.length === 0) {
      const endTime = new Date();
      const duration = ((Date.now() - startTimeMs) / 1000).toFixed(2);
      logger.info(`[generatePendingPDFs] No hay registros pendientes para procesar - timestamp=${endTime.toISOString()} duration=${duration}s${parts.length ? ` (${parts.join(' ')})` : ''}`);
      return 0;
    }
    
    logger.info(`[generatePendingPDFs] Encontrados ${pendingRecords.length} registros pendientes`);
    
    // Procesar cada registro
    for (const record of pendingRecords) {
      try {
        // Obtener datos de la orden para generar el PDF
        const pdfData = await getPDFDataForRecord(record);
        
        if (!pdfData) {
          logger.warn(`[generatePendingPDFs] No se pudieron obtener datos para generar PDF id=${record.id} pc=${record.pc} oc=${record.oc || 'N/A'}`);
          continue;
        }
        
        // Generar el archivo PDF físico
        const pdfResult = await generatePhysicalPDF(record, pdfData);
        
        if (!pdfResult) {
          logger.error(`[generatePendingPDFs] Error generando PDF físico id=${record.id} pc=${record.pc} oc=${record.oc || 'N/A'}`);
          continue;
        }
        
        // Actualizar status_id = 2, name, path completo, fecha_generacion (sin cambiar is_visible_to_client)
        await pool.query(
          'UPDATE order_files SET status_id = 2, name = ?, path = ?, fecha_generacion = NOW(), updated_at = NOW() WHERE id = ?',
          [pdfResult.fileName, pdfResult.relativePath, record.id]
        );
        
        // Registrar evento exitoso
        await logDocumentEvent({
          source: 'cron',
          action: 'generate_pdf',
          process: 'generatePendingPDFs',
          fileId: record.id,
          docType: record.name,
          pc: record.pc,
          oc: record.oc,
          factura: record.factura,
          customerRut: pdfData.customerRut || null,
          userId: null,
          status: 'ok'
        });
        
        pdfsGenerated++;
        logger.info(`[generatePendingPDFs] PDF generado exitosamente id=${record.id} pc=${record.pc} oc=${record.oc || 'N/A'} name=${pdfResult.fileName}`);
        
      } catch (recordError) {
        logger.error(`[generatePendingPDFs] Error procesando registro id=${record.id} pc=${record.pc}: ${recordError.message}`);
        logger.error(`[generatePendingPDFs] Stack: ${recordError.stack}`);
        
        // Registrar evento de error
        await logDocumentEvent({
          source: 'cron',
          action: 'generate_pdf',
          process: 'generatePendingPDFs',
          fileId: record.id,
          docType: record.name,
          pc: record.pc,
          oc: record.oc,
          factura: record.factura,
          customerRut: null,
          userId: null,
          status: 'error',
          message: recordError.message
        });
        
        // Continuar con el siguiente registro
        continue;
      }
    }
    
    const endTime = new Date();
    const duration = ((Date.now() - startTimeMs) / 1000).toFixed(2);
    logger.info(`[generatePendingPDFs] Generación completada - timestamp=${endTime.toISOString()} duration=${duration}s pdfs=${pdfsGenerated}/${pendingRecords.length}`);
    
    return pdfsGenerated;
    
  } catch (error) {
    const errorTime = new Date();
    const duration = ((Date.now() - startTimeMs) / 1000).toFixed(2);
    logger.error(`[generatePendingPDFs] Error en generación de PDFs pendientes: ${error.message} - timestamp=${errorTime.toISOString()} duration=${duration}s`);
    logger.error(`[generatePendingPDFs] Stack: ${error.stack}`);
    throw error;
  }
}

/**
 * Obtiene datos de la orden para generar el PDF
 * @param {Object} record - Registro de order_files
 * @returns {Promise<Object|null>} Datos formateados para el PDF
 */
async function getPDFDataForRecord(record) {
  try {
    const { getSqlPool, sql } = require('../config/sqlserver');
    const sqlPool = await getSqlPool();
    
    // Consultar datos de la orden desde SQL Server
    const request = sqlPool.request();
    request.input('pc', sql.VarChar, String(record.pc).trim());
    
    let query = `
      SELECT TOP 1
        h.Nro AS pc,
        h.OC AS oc,
        h.Rut AS customer_rut,
        c.Nombre AS customer_name,
        c.Pais AS country,
        h.Clausula AS incoterm,
        h.Tipo AS tipo,
        h.Condicion_venta AS condicion_venta,
        h.Job AS currency,
        h.MedioDeEnvioOV AS medio_envio_ov,
        h.Puerto_Destino AS puerto_destino,
        h.FechaOriginalCompromisoCliente AS fecha_incoterm,
        h.GtoAdicFlete AS gasto_adicional_flete
      FROM jor_imp_HDR_90_softkey h
      LEFT JOIN jor_imp_CLI_01_softkey c ON c.Rut = h.Rut
      WHERE h.Nro = @pc
    `;
    
    if (record.oc) {
      request.input('oc', sql.VarChar, String(record.oc).trim());
      query += ` AND h.OC = @oc`;
    }
    
    const headerResult = await request.query(query);
    
    if (!headerResult.recordset || headerResult.recordset.length === 0) {
      logger.warn(`[generatePendingPDFs] No se encontró orden en SQL Server pc=${record.pc} oc=${record.oc || 'N/A'}`);
      return null;
    }
    
    const orderHeader = headerResult.recordset[0];
    
    // Consultar datos de factura si existe
    let facturaData = null;
    if (record.factura) {
      const facturaRequest = sqlPool.request();
      facturaRequest.input('pc', sql.VarChar, String(record.pc).trim());
      facturaRequest.input('factura', sql.VarChar, String(record.factura).trim());
      
      const facturaResult = await facturaRequest.query(`
        SELECT TOP 1
          Factura AS factura,
          Fecha_factura AS fecha_factura,
          ETD_ENC_FA AS fecha_etd_factura,
          ETA_ENC_FA AS fecha_eta_factura,
          MedioDeEnvioFact AS medio_envio_factura,
          GtoAdicFleteFactura AS gasto_adicional_flete_factura
        FROM jor_imp_FACT_90_softkey
        WHERE Nro = @pc AND Factura = @factura
      `);
      
      if (facturaResult.recordset && facturaResult.recordset.length > 0) {
        facturaData = facturaResult.recordset[0];
      }
    }
    
    // Consultar items de la orden
    const itemsRequest = sqlPool.request();
    itemsRequest.input('pc', sql.VarChar, String(record.pc).trim());
    
    let itemsQuery = `
      SELECT
        COALESCE(NULLIF(i.Descripcion, ''), i.Item, 'Producto') AS item_name,
        i.Descripcion AS descripcion,
        i.Cant_ordenada AS kg_solicitados,
        i.KilosFacturados AS kg_facturados,
        i.Precio_Unit AS unit_price,
        i.Factura AS factura
      FROM jor_imp_item_90_softkey i
      WHERE i.Nro = @pc
    `;
    
    if (record.factura) {
      itemsRequest.input('factura', sql.VarChar, String(record.factura).trim());
      itemsQuery += ` AND i.Factura = @factura`;
    }
    
    const itemsResult = await itemsRequest.query(itemsQuery);
    const items = itemsResult.recordset || [];
    
    // Determinar idioma según país del cliente
    const pool = await poolPromise;
    let lang = 'en';
    if (orderHeader.country) {
      const [langRows] = await pool.query(
        'SELECT lang FROM country_lang WHERE country = ?',
        [orderHeader.country]
      );
      if (langRows.length > 0) {
        lang = langRows[0].lang || 'en';
      }
    }
    
    // Determinar si tiene factura
    const hasFactura =
      record.factura !== null &&
      record.factura !== undefined &&
      record.factura !== '' &&
      record.factura !== 0 &&
      record.factura !== '0';
    
    // Mapear file_id a translation key
    const { getDocumentTranslations } = require('../pdf-generator/i18n');
    let translationKey = 'aviso_recepcion'; // Default
    
    if (record.file_id === 19) {
      translationKey = 'aviso_embarque'; // Shipment Notice
    } else if (record.file_id === 15) {
      translationKey = 'aviso_entrega'; // Order Delivery Notice
    } else if (record.file_id === 6) {
      translationKey = 'aviso_disponibilidad'; // Availability Notice
    }
    
    const translations = getDocumentTranslations(translationKey, lang);
    
    // Ruta de firma
    const fs = require('fs');
    const signaturePath = path.join(__dirname, '../pdf-generator/assets/firma_carla.png');
    
    // Construir datos para el PDF
    const pdfData = {
      title: record.name,
      customerName: orderHeader.customer_name || 'Cliente',
      customerRut: orderHeader.customer_rut,
      internalOrderNumber: record.pc,
      orderNumber: orderHeader.oc ? orderHeader.oc.replace(/^GEL\s*/i, '') : '-',
      tipo: orderHeader.tipo || '-',
      destinationPort: orderHeader.puerto_destino || '-',
      incoterm: orderHeader.incoterm || '-',
      shippingMethod: hasFactura
        ? (facturaData?.medio_envio_factura || orderHeader.medio_envio_ov)
        : (orderHeader.medio_envio_ov || facturaData?.medio_envio_factura),
      etd: facturaData?.fecha_etd_factura || null,
      eta: facturaData?.fecha_eta_factura || null,
      currency: orderHeader.currency || 'USD',
      paymentCondition: orderHeader.condicion_venta || '-',
      additionalCharge: hasFactura
        ? facturaData?.gasto_adicional_flete_factura
        : orderHeader.gasto_adicional_flete,
      hasFactura,
      incotermDeliveryDate: getWeekOfYear(orderHeader.fecha_incoterm, lang),
      signImagePath: fs.existsSync(signaturePath) ? signaturePath : null,
      lang,
      translations,
      items: items.map(item => ({
        descripcion: item.descripcion || item.item_name || 'Producto',
        item_name: item.item_name,
        kg_solicitados: item.kg_solicitados || 0,
        kg_facturados: item.kg_facturados || 0,
        unit_price: item.unit_price || 0,
        factura: item.factura || '-'
      }))
    };
    
    return pdfData;
    
  } catch (error) {
    logger.error(`[generatePendingPDFs] Error obteniendo datos para PDF pc=${record.pc}: ${error.message}`);
    logger.error(`[generatePendingPDFs] Stack: ${error.stack}`);
    return null;
  }
}

/**
 * Genera el archivo PDF físico en el servidor de archivos
 * @param {Object} record - Registro de order_files
 * @param {Object} pdfData - Datos para generar el PDF
 * @returns {Promise<string|null>} Ruta del archivo generado o null si hay error
 */
async function generatePhysicalPDF(record, pdfData) {
  try {
    const basePath = process.env.FILE_SERVER_ROOT || '/var/www/html';
    const fullDirPath = path.join(basePath, record.path);
    
    // Verificar que el directorio existe
    try {
      await fs.access(fullDirPath);
    } catch (accessError) {
      logger.warn(`[generatePendingPDFs] Directorio no existe, creándolo: ${fullDirPath}`);
      await fs.mkdir(fullDirPath, { recursive: true });
    }
    
    // Funciones de sanitización (copiadas del controller)
    const sanitizeFileNamePart = (value) => {
      if (!value || typeof value !== 'string') return '';
      return value
        .replace(/[<>:"/\\|?*]/g, '')
        .replace(/[\x00-\x1f\x7f]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    };
    
    const normalizePONumber = (value) => {
      if (!value) return '-';
      const normalized = String(value).replace(/^GEL\s*/i, '').trim();
      return normalized || '-';
    };
    
    // Construir nombre del archivo igual que el proceso manual
    const docName = sanitizeFileNamePart(record.name) || 'Documento';
    const customerName = sanitizeFileNamePart(pdfData.customerName) || '';
    const poNumber = normalizePONumber(pdfData.orderNumber);
    const poLabel = poNumber && poNumber !== '-' ? sanitizeFileNamePart(`PO ${poNumber}`) : '';
    
    const parts = [docName];
    if (customerName) parts.push(customerName);
    if (poLabel) parts.push(poLabel);
    const baseName = parts.join(' - ');
    const fileName = `${baseName}.pdf`;
    
    const fullFilePath = path.join(fullDirPath, fileName);
    const relativeFilePath = path.join(record.path, fileName);
    
    // Obtener el generador de PDF según file_id
    const fileIdInfo = FILE_ID_MAP[record.file_id];
    if (!fileIdInfo) {
      logger.error(`[generatePendingPDFs] file_id desconocido: ${record.file_id}`);
      return null;
    }
    
    const generator = fileIdInfo.generator;
    
    // Generar el PDF
    logger.info(`[generatePendingPDFs] Generando PDF id=${record.id} pc=${record.pc} file_id=${record.file_id}`);
    logger.info(`[generatePendingPDFs] Nombre del archivo: ${fileName}`);
    
    try {
      await generator(fullFilePath, pdfData);
    } catch (genError) {
      logger.error(`[generatePendingPDFs] Error en generador de PDF: ${genError.message}`);
      logger.error(`[generatePendingPDFs] Stack del generador: ${genError.stack}`);
      return null;
    }
    
    // Verificar que el archivo se creó
    try {
      await fs.access(fullFilePath);
      const stats = await fs.stat(fullFilePath);
      logger.info(`[generatePendingPDFs] PDF creado exitosamente: ${fileName} size=${stats.size} bytes`);
      return { fullPath: fullFilePath, relativePath: relativeFilePath, fileName: baseName };
    } catch (verifyError) {
      logger.error(`[generatePendingPDFs] PDF no se creó correctamente: ${fullFilePath}`);
      return null;
    }
    
  } catch (error) {
    logger.error(`[generatePendingPDFs] Error generando PDF físico id=${record.id}: ${error.message}`);
    logger.error(`[generatePendingPDFs] Stack: ${error.stack}`);
    return null;
  }
}

module.exports = { generatePendingPDFs };
