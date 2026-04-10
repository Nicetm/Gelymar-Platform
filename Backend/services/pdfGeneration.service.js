/**
 * Servicio Unificado de Generación de PDFs
 * 
 * Centraliza la obtención de datos, construcción de nombres, generación física
 * y actualización de estado para documentos PDF de órdenes.
 * Ambos flujos (cron y manual) usan este servicio.
 */
const { poolPromise } = require('../config/db');
const { logger } = require('../utils/logger');
const { cleanDirectoryName } = require('../utils/directoryUtils');
const {
  generateRecepcionOrden,
  generateAvisoEmbarque,
  generateAvisoEntrega,
  generateAvisoDisponibilidad,
  getWeekOfYear
} = require('../pdf-generator/generator');
const { getDocumentTranslations } = require('../pdf-generator/i18n');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');

// ===== Constantes =====

const FILE_ID_NAME_MAP = {
  9: 'Order Receipt Notice',
  19: 'Shipment Notice',
  15: 'Order Delivery Notice',
  6: 'Availability Notice'
};

const DOC_NAME_MAP_ES = {
  'Order Receipt Notice': 'Aviso de Recepcion de Orden',
  'Shipment Notice': 'Aviso de Embarque',
  'Order Delivery Notice': 'Aviso de Entrega',
  'Availability Notice': 'Aviso de Disponibilidad de Orden'
};

const DOC_NAME_MAP_ES_TO_EN = Object.entries(DOC_NAME_MAP_ES).reduce((acc, [en, es]) => {
  acc[String(es).trim().toLowerCase()] = en;
  return acc;
}, {});

const DOC_TRANSLATION_KEY_MAP = {
  'Order Receipt Notice': 'aviso_recepcion',
  'Shipment Notice': 'aviso_embarque',
  'Order Delivery Notice': 'aviso_entrega',
  'Availability Notice': 'aviso_disponibilidad'
};

// ===== Helpers =====

function sanitizeFileNamePart(value) {
  if (!value || typeof value !== 'string') return '';
  return value
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/[\x00-\x1f\x7f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizePONumber(value) {
  if (!value) return '-';
  const normalized = String(value).replace(/^GEL\s*/i, '').trim();
  return normalized || '-';
}

function getDocumentDisplayName(documentName, lang) {
  if (lang === 'es') return DOC_NAME_MAP_ES[documentName] || documentName;
  return documentName;
}

function resolveDocumentName(file) {
  if (file && file.file_id && FILE_ID_NAME_MAP[file.file_id]) {
    return FILE_ID_NAME_MAP[file.file_id];
  }
  if (file?.name) {
    const normalized = String(file.name).trim().toLowerCase();
    if (DOC_NAME_MAP_ES_TO_EN[normalized]) return DOC_NAME_MAP_ES_TO_EN[normalized];
    return file.name;
  }
  return '';
}

function getDocumentGenerator(documentName) {
  const generators = {
    'Order Receipt Notice': generateRecepcionOrden,
    'Shipment Notice': generateAvisoEmbarque,
    'Order Delivery Notice': generateAvisoEntrega,
    'Availability Notice': generateAvisoDisponibilidad
  };
  return generators[documentName] || null;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function resolveLang(countryLang, recordLang, fallbackLang = 'en') {
  if (countryLang && typeof countryLang === 'string' && countryLang.trim()) return countryLang.trim();
  if (recordLang && typeof recordLang === 'string' && recordLang.trim()) return recordLang.trim();
  return fallbackLang;
}

// ===== Funciones principales =====

/**
 * Obtiene todos los datos necesarios para generar un PDF.
 * Usa documentFileService como fuente principal, con fallback a orderService.
 * @param {Object} record - Registro de order_files (pc, oc, factura, file_id, etc.)
 * @param {Object} [options={}] - { lang: string|null }
 * @returns {Promise<Object|null>} Objeto PDF_Data o null
 */
async function getPDFDataForRecord(record, options = {}) {
  try {
    const { container } = require('../config/container');
    const documentFileService = container.resolve('documentFileService');
    const orderService = container.resolve('orderService');

    const documentName = resolveDocumentName(record);

    // Obtener datos de orden, detalle y items
    let order = await documentFileService.getOrderWithCustomerForPdf(record.pc, record.oc, record.factura);
    const orderDetail = await documentFileService.getOrderDetailForPdf(record.pc, record.oc, record.factura);

    // Fallback a orderService si no hay datos
    if (!order || !order.pc || !order.customer_name) {
      try {
        const sqlHeader = record.oc
          ? await orderService.getOrderByPcOc(String(record.pc), String(record.oc))
          : await orderService.getOrderByPc(String(record.pc));
        if (sqlHeader) {
          order = {
            ...(order || {}),
            pc: sqlHeader.pc || order?.pc,
            oc: sqlHeader.oc || order?.oc,
            customer_name: sqlHeader.customer_name || order?.customer_name,
            factura: sqlHeader.factura ?? order?.factura,
          };
        }
      } catch (err) {
        logger.warn(`[pdfGeneration] Fallback orderService falló pc=${record.pc}: ${err.message}`);
      }
    }

    if (!order) {
      logger.warn(`[pdfGeneration] No se encontraron datos para pc=${record.pc} oc=${record.oc || 'N/A'}`);
      return null;
    }

    const orderItems = order.pc
      ? await documentFileService.getOrderItemsByPcOcFactura(order.pc, order.oc, order.factura)
      : [];

    // Resolver idioma
    const pool = await poolPromise;
    let countryLang = null;
    // Obtener país del cliente desde SQL Server si no viene en los datos
    let country = null;
    if (order.customer_rut) {
      try {
        const { getSqlPool, sql: sqlTypes } = require('../config/sqlserver');
        const sqlPool = await getSqlPool();
        const countryReq = sqlPool.request();
        countryReq.input('rut', sqlTypes.VarChar, order.customer_rut);
        const countryResult = await countryReq.query('SELECT TOP 1 Pais FROM jor_imp_CLI_01_softkey WHERE Rut = @rut');
        country = countryResult.recordset?.[0]?.Pais?.trim() || null;
      } catch (err) {
        logger.warn(`[pdfGeneration] Error obteniendo país del cliente rut=${order.customer_rut}: ${err.message}`);
      }
    }
    if (country) {
      const [langRows] = await pool.query('SELECT lang FROM country_lang WHERE country = ? LIMIT 1', [country]);
      countryLang = langRows?.[0]?.lang || null;
    }
    const lang = resolveLang(countryLang, record.lang, options.lang || 'en');

    // Resolver fechas
    const resolvePdfDate = (...values) => {
      for (const value of values) {
        if (!value) continue;
        const normalized = value instanceof Date ? value.toISOString().slice(0, 10) : String(value).trim();
        if (!normalized || normalized === '0' || normalized.toLowerCase() === 'null') continue;
        const parsed = new Date(normalized);
        if (!Number.isNaN(parsed.getTime())) return normalized;
      }
      return null;
    };

    const etd = resolvePdfDate(orderDetail?.fecha_etd_factura, orderDetail?.fecha_etd);
    const eta = resolvePdfDate(orderDetail?.fecha_eta_factura, orderDetail?.fecha_eta);

    const hasFactura = record.factura !== null && record.factura !== undefined &&
      record.factura !== '' && record.factura !== 0 && record.factura !== '0';

    const shippingMethod = hasFactura
      ? (orderDetail?.medio_envio_factura || orderDetail?.medio_envio_ov)
      : (orderDetail?.medio_envio_ov || orderDetail?.medio_envio_factura);

    const additionalCharge = hasFactura
      ? orderDetail?.gasto_adicional_flete_factura
      : orderDetail?.gasto_adicional_flete;

    const signaturePath = path.join(__dirname, '../pdf-generator/assets/firma_carla.png');
    const translationKey = DOC_TRANSLATION_KEY_MAP[documentName] || 'aviso_recepcion';
    const translations = getDocumentTranslations(translationKey, lang);

    const baseData = {
      title: documentName,
      subtitle: `Documento generado para ${order.customer_name || record.customer_name}`,
      customerName: order.customer_name || record.customer_name || 'Cliente',
      customerRut: order.customer_rut || record.customer_rut || record.rut || null,
      internalOrderNumber: order.pc || record.pc || '-',
      orderNumber: order.oc ? order.oc.replace(/^GEL\s*/i, '') : '-',
      tipo: orderDetail?.tipo || '-',
      destinationPort: orderDetail?.puerto_destino || '-',
      incoterm: orderDetail?.incoterm || '-',
      shippingMethod: shippingMethod || '-',
      etd, eta,
      currency: orderDetail?.currency || 'USD',
      paymentCondition: orderDetail?.condicion_venta || '-',
      additionalCharge,
      hasFactura,
      incotermDeliveryDate: getWeekOfYear(orderDetail?.fecha_incoterm, lang),
      signImagePath: fs.existsSync(signaturePath) ? signaturePath : null,
      lang, translations,
      items: orderItems.map(item => ({
        descripcion: item.descripcion || item.item_name || 'Producto',
        kg_solicitados: item.kg_solicitados || 0,
        kg_facturados: item.kg_facturados || 0,
        unit_price: item.unit_price || 0,
        factura: item.factura || '-'
      }))
    };

    // Datos específicos por tipo de documento
    const specificData = {
      'Order Receipt Notice': { processingStatus: 'En Proceso', serviceType: 'Logística Integral', origin: 'Chile', destination: 'Internacional', priority: 'Normal' },
      'Shipment Notice': {
        portOfShipment: 'Puerto de Valparaíso', vesselName: 'M/V Gelymar Express',
        containerNumber: `GEL-${Math.floor(Math.random() * 900000) + 100000}`,
        portOfDestination: 'Puerto de Destino', cargoType: 'Mercancía General',
        totalWeight: orderItems.reduce((sum, item) => sum + (item.kg_solicitados || 0), 0),
        totalVolume: orderItems.reduce((sum, item) => sum + (item.volumen || 0), 0),
        specialInstructions: 'Manejar con cuidado. Mercancía frágil.'
      },
      'Order Delivery Notice': { factura: orderDetail?.factura || '-' },
      'Availability Notice': { processingStatus: 'Disponible', serviceType: 'Servicio Logístico Completo', origin: 'Chile', destination: 'Internacional', priority: 'Normal' }
    };

    return { ...baseData, ...(specificData[documentName] || {}) };
  } catch (error) {
    logger.error(`[pdfGeneration] Error obteniendo datos PDF pc=${record.pc}: ${error.message}`);
    return null;
  }
}

/**
 * Construye el nombre base del archivo PDF (sin extensión).
 */
function buildFileName(record, pdfData, lang) {
  const documentName = resolveDocumentName(record);
  const rawDocName = documentName || getDocumentDisplayName(documentName, lang) || 'Documento';
  const docName = sanitizeFileNamePart(rawDocName) || 'Documento';
  const customerName = sanitizeFileNamePart(pdfData?.customerName || record.customer_name) || '';
  const pc = sanitizeFileNamePart(record.pc) || '';
  const poNumber = normalizePONumber(pdfData?.orderNumber || record.oc);
  const poLabel = poNumber && poNumber !== '-' ? sanitizeFileNamePart(`PO ${poNumber}`) : '';
  const docType = record.document_type != null ? Number(record.document_type) : 0;
  const parts = [docName];
  if (docType === 0 && customerName) parts.push(customerName);
  if (pc) parts.push(pc);
  if (poLabel) parts.push(poLabel);
  return parts.join(' - ');
}

/**
 * Construye un nombre de archivo versionado (_vN).
 */
function buildVersionedFileName(baseName, directoryPath) {
  const versionPrefix = `${baseName}_v`;
  const versionRegex = new RegExp(`^${escapeRegExp(baseName)}_v(\\d+)\\.pdf$`);

  let version = 1;
  try {
    if (fs.existsSync(directoryPath)) {
      const existingFiles = fs.readdirSync(directoryPath).filter(f =>
        f.startsWith(versionPrefix) && f.endsWith('.pdf')
      );
      if (existingFiles.length > 0) {
        const versions = existingFiles.map(f => {
          const match = f.match(versionRegex);
          return match ? parseInt(match[1], 10) : 0;
        }).filter(v => v > 0);
        if (versions.length > 0) version = Math.max(...versions) + 1;
      }
    }
  } catch (err) {
    logger.warn(`[pdfGeneration] Error leyendo directorio para versionado: ${err.message}`);
  }
  return `${versionPrefix}${version}`;
}

/**
 * Genera el archivo PDF físico en el servidor.
 * @returns {Promise<{fullPath, relativePath, fileName}|null>}
 */
async function generatePDF(record, pdfData) {
  try {
    const FILE_SERVER_ROOT = process.env.FILE_SERVER_ROOT || '/var/www/html';
    const cleanCustomerName = cleanDirectoryName(pdfData.customerName || record.customer_name || 'Cliente');
    const cleanFolderName = cleanDirectoryName(record.pc);
    const folderName = record.file_identifier ? `${cleanFolderName}_${record.file_identifier}` : cleanFolderName;
    const customerFolder = path.join(FILE_SERVER_ROOT, 'uploads', cleanCustomerName, folderName);

    if (!fs.existsSync(customerFolder)) {
      fs.mkdirSync(customerFolder, { recursive: true });
    }

    const documentName = resolveDocumentName(record);
    const generator = getDocumentGenerator(documentName);
    if (!generator) {
      logger.error(`[pdfGeneration] file_id desconocido: ${record.file_id}`);
      return null;
    }

    const lang = pdfData.lang || 'en';
    const baseName = buildFileName(record, pdfData, lang);
    const fileName = `${baseName}.pdf`;
    const fullPath = path.join(customerFolder, fileName);
    const relativePath = path.join('uploads', cleanCustomerName, folderName, fileName);

    await generator(fullPath, pdfData);

    // Verificar creación
    try {
      await fsPromises.access(fullPath);
      return { fullPath, relativePath, fileName: baseName };
    } catch {
      logger.error(`[pdfGeneration] PDF no se creó: ${fullPath}`);
      return null;
    }
  } catch (error) {
    logger.error(`[pdfGeneration] Error generando PDF id=${record.id} pc=${record.pc}: ${error.message}`);
    return null;
  }
}

/**
 * Actualiza el registro después de generar el PDF.
 */
async function updateRecordAfterGeneration(recordId, fileName, relativePath) {
  const pool = await poolPromise;
  await pool.query(
    'UPDATE order_files SET status_id = 2, name = ?, path = ?, fecha_generacion = NOW(), updated_at = NOW() WHERE id = ?',
    [fileName, relativePath, recordId]
  );
}

module.exports = {
  getPDFDataForRecord,
  buildFileName,
  buildVersionedFileName,
  generatePDF,
  updateRecordAfterGeneration,
  sanitizeFileNamePart,
  normalizePONumber,
  resolveDocumentName,
  getDocumentGenerator,
  getDocumentDisplayName,
  resolveLang,
  escapeRegExp,
  FILE_ID_NAME_MAP,
  DOC_NAME_MAP_ES,
  DOC_TRANSLATION_KEY_MAP
};
