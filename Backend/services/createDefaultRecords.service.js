/**
 * Servicio de Creación de Registros por Defecto
 * 
 * Centraliza toda la lógica de creación de registros en order_files.
 * Ambos flujos (cron y manual) usan este servicio para garantizar consistencia.
 * 
 * Exports:
 * - createDefaultRecordsForOrder(orderData, options) — crea registros para una orden
 * - createDefaultRecords(filters) — orquestador cron que itera órdenes del ERP
 */
const { poolPromise } = require('../config/db');
const { getSqlPool, sql } = require('../config/sqlserver');
const { getNextFileIdentifier, getAllOrdersGroupedByRut } = require('./file.service');
const { getCustomerByRut } = require('./customer.service');
const { cleanDirectoryName } = require('../utils/directoryUtils');
const { getIncotermValidators, hasFacturaValue } = require('../utils/incotermValidation');
const { logDocumentEvent } = require('./documentEvent.service');
const { logger } = require('../utils/logger');
const fs = require('fs').promises;
const path = require('path');

const FILE_ID_MAP = {
  'Order Receipt Notice': 9,
  'Shipment Notice': 19,
  'Order Delivery Notice': 15,
  'Availability Notice': 6
};

// ===== Funciones internas =====

function normalizeFactura(factura) {
  if (factura === null || factura === undefined || factura === '' || factura === 0 || factura === '0') {
    return null;
  }
  return String(factura).trim();
}

function normalizeOc(oc) {
  if (oc === null || oc === undefined) return null;
  return String(oc).trim() || null;
}

async function syncFacturaForPc(pc, factura) {
  if (!factura) return false;
  const pool = await poolPromise;
  try {
    const normalizedPc = String(pc).trim();
    const [rows] = await pool.query(
      `SELECT id FROM order_files 
       WHERE TRIM(COALESCE(pc, '')) = ? 
         AND file_id = 9 
         AND (factura IS NULL OR factura = '' OR factura = 0 OR factura = '0')`,
      [normalizedPc]
    );
    if (rows.length === 0) return false;

    const ids = rows.map(r => r.id);
    await pool.query(
      `UPDATE order_files SET factura = ?, updated_at = NOW() WHERE id IN (${ids.map(() => '?').join(',')})`,
      [factura, ...ids]
    );
    logger.info(`[createDefaultRecords] Factura sincronizada: pc=${normalizedPc} factura=${factura} ids=[${ids.join(',')}]`);
    return true;
  } catch (error) {
    logger.error(`[createDefaultRecords] Error sincronizando factura pc=${pc}: ${error.message}`);
    return false;
  }
}

async function findExistingRecords(pc, factura) {
  const pool = await poolPromise;
  try {
    const normalizedPc = String(pc).trim();
    let query, params;
    if (factura) {
      query = `SELECT * FROM order_files WHERE TRIM(COALESCE(pc, '')) = ? AND (factura = ? OR factura IS NULL OR factura = '' OR factura = '0')`;
      params = [normalizedPc, factura];
    } else {
      query = `SELECT * FROM order_files WHERE TRIM(COALESCE(pc, '')) = ? AND (factura IS NULL OR factura = '' OR factura = '0')`;
      params = [normalizedPc];
    }
    const [rows] = await pool.query(query, params);
    return rows;
  } catch (error) {
    logger.error(`[createDefaultRecords] Error buscando registros existentes pc=${pc}: ${error.message}`);
    return [];
  }
}

async function checkPartialStatus(pc) {
  try {
    const sqlPool = await getSqlPool();
    const request = sqlPool.request();
    request.input('pc', sql.VarChar, String(pc).trim());
    const result = await request.query(`
      SELECT COUNT(DISTINCT f.Factura) AS invoice_count
      FROM jor_imp_FACT_90_softkey f
      WHERE f.Nro = @pc
        AND f.Factura IS NOT NULL
        AND LTRIM(RTRIM(f.Factura)) <> ''
        AND f.Factura <> 0
    `);
    const invoiceCount = Number(result.recordset?.[0]?.invoice_count || 0);
    return { isPartial: invoiceCount > 1, invoiceCount };
  } catch (error) {
    logger.error(`[createDefaultRecords] Error verificando parcialidad pc=${pc}: ${error.message}`);
    return { isPartial: false, invoiceCount: 0 };
  }
}

async function determineRequiredDocs({ isPartial, isParent, hasFactura, order, allowedDocs }) {
  const { canCreateShipment, canCreateAvailability, canCreateDelivery } = await getIncotermValidators();

  let requiredDocs = [];

  if (isPartial) {
    if (isParent) {
      requiredDocs.push('Order Receipt Notice');
    }
    if (hasFactura) {
      if (canCreateShipment(order)) requiredDocs.push('Shipment Notice');
      if (canCreateDelivery(order)) requiredDocs.push('Order Delivery Notice');
      if (canCreateAvailability(order)) requiredDocs.push('Availability Notice');
    }
  } else {
    requiredDocs.push('Order Receipt Notice');
    if (hasFactura) {
      if (canCreateShipment(order)) requiredDocs.push('Shipment Notice');
      if (canCreateDelivery(order)) requiredDocs.push('Order Delivery Notice');
      if (canCreateAvailability(order)) requiredDocs.push('Availability Notice');
    }
  }

  if (Array.isArray(allowedDocs)) {
    const allowedSet = new Set(allowedDocs);
    requiredDocs = requiredDocs.filter(doc => allowedSet.has(doc));
  }

  return requiredDocs;
}

async function ensureDirectory(customerName, pc, fileIdentifier) {
  try {
    const fileServerRoot = process.env.FILE_SERVER_ROOT || '/var/www/html';
    const cleanName = cleanDirectoryName(customerName);
    const relativePath = path.join('uploads', cleanName, `${pc}_${fileIdentifier}`);
    const fullPath = path.join(fileServerRoot, relativePath);

    try {
      await fs.access(fullPath);
      return relativePath;
    } catch {
      // No existe, crearlo
    }

    await fs.mkdir(fullPath, { recursive: true });
    return relativePath;
  } catch (error) {
    logger.error(`[createDefaultRecords] Error creando directorio customer=${customerName} pc=${pc}: ${error.message}`);
    return null;
  }
}

async function insertRecord(fileData, eventMeta) {
  const pool = await poolPromise;
  try {
    const query = `
      INSERT INTO order_files (
        pc, oc, factura, rut, name, path, file_identifier, file_id, was_sent,
        document_type, file_type, status_id, is_visible_to_client,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 0, 'PDF', 1, 0, NOW(), NOW())
    `;
    const params = [
      fileData.pc, fileData.oc, fileData.factura, fileData.rut,
      fileData.name, fileData.path, fileData.file_identifier, fileData.file_id
    ];

    const [result] = await pool.query(query, params);
    logger.info(`[createDefaultRecords] Registro insertado pc=${fileData.pc} oc=${fileData.oc || 'N/A'} factura=${fileData.factura || 'N/A'} rut=${fileData.rut || 'N/A'} doc=${fileData.name}`);

    await logDocumentEvent({
      source: eventMeta.source || 'cron', action: 'create_record', process: 'createDefaultRecords',
      fileId: result.insertId, docType: fileData.name, pc: fileData.pc, oc: fileData.oc,
      factura: fileData.factura, customerRut: fileData.rut, userId: eventMeta.userId || null, status: 'ok'
    });

    return result;
  } catch (error) {
    logger.error(`[createDefaultRecords] Error insertando registro ${fileData.name} pc=${fileData.pc}: ${error.message}`);

    await logDocumentEvent({
      source: eventMeta.source || 'cron', action: 'create_record', process: 'createDefaultRecords',
      fileId: null, docType: fileData.name, pc: fileData.pc, oc: fileData.oc,
      factura: fileData.factura, customerRut: fileData.rut, userId: eventMeta.userId || null,
      status: 'error', message: error.message
    });

    throw error;
  }
}

// ===== Función principal — una orden =====

/**
 * Crea registros por defecto en order_files para una orden específica.
 * Usada tanto por el flujo cron como por el flujo manual.
 *
 * @param {Object} orderData - { pc, oc, factura, rut, customerName, incoterm, fecha_etd_factura, fecha_eta_factura, isParent }
 * @param {Object} [options] - { source: 'cron'|'manual', allowedDocs: string[]|null, userId: number|null }
 * @returns {Promise<Object>} { success, filesCreated, directoryPath, files, skipped }
 */
async function createDefaultRecordsForOrder(orderData, options = {}) {
  const { source = 'cron', allowedDocs = null, userId = null } = options;
  const isManual = source === 'manual';

  if (!orderData.pc) {
    const err = new Error('PC es requerido');
    err.code = 'INVALID_ORDER_DATA';
    err.status = 400;
    throw err;
  }

  const pc = String(orderData.pc).trim();
  const oc = normalizeOc(orderData.oc);
  const factura = normalizeFactura(orderData.factura);
  const rut = orderData.rut ? String(orderData.rut).trim() : null;
  const customerName = orderData.customerName || 'Cliente';
  const isParent = orderData.isParent !== undefined ? orderData.isParent : true;

  const orderForValidation = {
    factura,
    incoterm: orderData.incoterm || null,
    fecha_etd_factura: orderData.fecha_etd_factura || null,
    fecha_eta_factura: orderData.fecha_eta_factura || null
  };

  if (factura) await syncFacturaForPc(pc, factura);

  const existingFiles = await findExistingRecords(pc, factura);
  const { isPartial } = await checkPartialStatus(pc);
  const hasFactura = hasFacturaValue(factura);

  const requiredDocs = await determineRequiredDocs({
    isPartial, isParent, hasFactura, order: orderForValidation, allowedDocs
  });

  if (isManual && Array.isArray(allowedDocs) && allowedDocs.length === 0) {
    const err = new Error('NO_DOCUMENTS_ALLOWED');
    err.code = 'NO_DOCUMENTS_ALLOWED';
    err.status = 400;
    err.details = { pc, oc, factura };
    throw err;
  }

  const existingFileIds = new Set(existingFiles.map(f => f.file_id).filter(Boolean));
  const missingDocs = requiredDocs.filter(name => !existingFileIds.has(FILE_ID_MAP[name]));

  if (missingDocs.length === 0) {
    if (isManual) {
      // Si no hay factura, informar qué documentos faltan por factura
      const pendingDocs = [];
      if (!hasFactura) {
        pendingDocs.push('Shipment Notice', 'Order Delivery Notice', 'Availability Notice');
      }
      if (pendingDocs.length > 0) {
        const err = new Error('FILES_NEED_FACTURA');
        err.code = 'FILES_NEED_FACTURA';
        err.status = 200;
        err.pendingDocs = pendingDocs;
        throw err;
      }
      const err = new Error('FILES_ALREADY_EXIST');
      err.code = 'FILES_ALREADY_EXIST';
      err.status = 409;
      throw err;
    }
    return { success: true, filesCreated: 0, directoryPath: null, files: [], skipped: true };
  }

  let directoryPath, fileIdentifier;
  if (existingFiles.length > 0) {
    // Extraer solo el directorio del path (puede incluir nombre de archivo)
    let existingPath = existingFiles[0].path;
    if (existingPath && existingPath.match(/\.\w+$/)) {
      // El path termina en extensión de archivo, extraer solo el directorio
      existingPath = require('path').dirname(existingPath);
    }
    directoryPath = existingPath;
    fileIdentifier = existingFiles[0].file_identifier || await getNextFileIdentifier(pc);
  } else {
    fileIdentifier = await getNextFileIdentifier(pc);
    directoryPath = await ensureDirectory(customerName, pc, fileIdentifier);
    if (!directoryPath) {
      logger.warn(`[createDefaultRecords] Error creando directorio para pc=${pc}, omitiendo`);
      return { success: false, filesCreated: 0, directoryPath: null, files: [], skipped: true };
    }
  }

  const createdFiles = [];
  for (const docName of missingDocs) {
    try {
      const result = await insertRecord(
        { pc, oc, factura, rut, name: docName, path: directoryPath, file_identifier: fileIdentifier, file_id: FILE_ID_MAP[docName] },
        { source, userId }
      );
      createdFiles.push({ id: result.insertId, name: docName, path: directoryPath });
    } catch (insertError) {
      logger.error(`[createDefaultRecords] Error insertando ${docName} pc=${pc}: ${insertError.message}`);
    }
  }

  // Determinar documentos que requieren factura pero no se pudieron crear
  const pendingDocs = [];
  if (!hasFactura) {
    pendingDocs.push('Shipment Notice', 'Order Delivery Notice', 'Availability Notice');
  }

  return { success: true, filesCreated: createdFiles.length, directoryPath, files: createdFiles, skipped: false, pendingDocs, needsFactura: pendingDocs.length > 0 };
}

// ===== Orquestador cron — todas las órdenes =====

/**
 * Procesa todas las órdenes del ERP y crea registros por defecto.
 * Invocado por el cron de PM2 vía POST /api/cron/create-default-records.
 * @param {Object} filters - { pc, factura }
 */
async function createDefaultRecords(filters = {}) {
  const startTimeMs = Date.now();

  try {
    const { pc, factura } = filters || {};
    const normalizedFilterPc = pc ? String(pc).trim() : null;
    const normalizedFilterFactura = factura ? String(factura).trim() : null;
    const parts = [];
    if (normalizedFilterPc) parts.push(`pc=${normalizedFilterPc}`);
    if (normalizedFilterFactura) parts.push(`factura=${normalizedFilterFactura}`);
    logger.info(`[createDefaultRecords] Iniciando${parts.length ? ` ${parts.join(' ')}` : ''}`);

    // Leer sendFrom de param_config
    const pool = await poolPromise;
    let sendFrom = null;
    try {
      const [configRows] = await pool.query('SELECT params FROM param_config WHERE name = ?', ['checkDefaultFiles']);
      if (configRows.length > 0 && configRows[0].params) {
        let params = configRows[0].params;
        if (typeof params === 'string') params = JSON.parse(params);
        else if (typeof params !== 'object') params = {};
        sendFrom = params.sendFrom || null;
        if (sendFrom) logger.info(`[createDefaultRecords] Filtrando desde fecha: ${sendFrom}`);
      }
    } catch (configError) {
      logger.warn(`[createDefaultRecords] Error obteniendo sendFrom: ${configError.message}`);
    }

    const ordersByRut = await getAllOrdersGroupedByRut(sendFrom, { pc: normalizedFilterPc, factura: normalizedFilterFactura });
    if (Object.keys(ordersByRut).length === 0) {
      const duration = ((Date.now() - startTimeMs) / 1000).toFixed(2);
      logger.info(`[createDefaultRecords] No hay órdenes - duration=${duration}s`);
      return { filesCreated: 0, ordersProcessed: 0, directoriesCreated: 0, skipped: 0, duration: `${duration}s` };
    }

    let totalFilesCreated = 0, totalOrdersProcessed = 0, totalDirectoriesCreated = 0, totalSkipped = 0;

    let clientEntries = Object.entries(ordersByRut);
    if (normalizedFilterPc || normalizedFilterFactura) {
      clientEntries = clientEntries
        .map(([rut, orders]) => [rut, orders.filter(o => {
          if (normalizedFilterPc && String(o.pc || '').trim() !== normalizedFilterPc) return false;
          if (normalizedFilterFactura && String(o.factura || '').trim() !== normalizedFilterFactura) return false;
          return true;
        })])
        .filter(([, orders]) => orders.length > 0);
    }

    if (clientEntries.length === 0) {
      const duration = ((Date.now() - startTimeMs) / 1000).toFixed(2);
      logger.info(`[createDefaultRecords] No hay órdenes tras filtrar - duration=${duration}s`);
      return { filesCreated: 0, ordersProcessed: 0, directoriesCreated: 0, skipped: 0, duration: `${duration}s` };
    }

    // Precalcular orden padre por PC (id más bajo)
    const pcMinId = new Map();
    clientEntries.forEach(([, orders]) => {
      orders.forEach(order => {
        const key = String(order.pc || '').trim();
        const orderId = order.id ? Number(order.id) : null;
        if (orderId && !Number.isNaN(orderId)) {
          const currentMin = pcMinId.get(key);
          if (!currentMin || orderId < currentMin) pcMinId.set(key, orderId);
        }
      });
    });

    const batchSize = 10;
    for (let i = 0; i < clientEntries.length; i += batchSize) {
      const batch = clientEntries.slice(i, i + batchSize);
      for (const [rut, orders] of batch) {
        for (const order of orders) {
          try {
            const customer = await getCustomerByRut(order.rut);
            if (!customer) continue;

            const pcKey = String(order.pc || '').trim();
            const minId = pcMinId.get(pcKey) || null;
            const orderId = order.id ? Number(order.id) : null;
            const isParent = !minId || (orderId && orderId === minId);

            const result = await createDefaultRecordsForOrder(
              { pc: order.pc, oc: order.oc, factura: order.factura, rut, customerName: customer.name,
                incoterm: order.incoterm, fecha_etd_factura: order.fecha_etd_factura,
                fecha_eta_factura: order.fecha_eta_factura, isParent },
              { source: 'cron' }
            );

            if (result.skipped) totalSkipped++;
            else {
              totalFilesCreated += result.filesCreated;
              if (result.filesCreated > 0 && result.directoryPath) totalDirectoriesCreated++;
            }
            totalOrdersProcessed++;
          } catch (orderError) {
            logger.error(`[createDefaultRecords] Error procesando orden ${order.id || order.pc}: ${orderError.message}`);
          }
        }
      }
    }

    const duration = ((Date.now() - startTimeMs) / 1000).toFixed(2);
    logger.info(`[createDefaultRecords] Completado - duration=${duration}s files=${totalFilesCreated} orders=${totalOrdersProcessed} dirs=${totalDirectoriesCreated} skipped=${totalSkipped}`);

    return { filesCreated: totalFilesCreated, ordersProcessed: totalOrdersProcessed, directoriesCreated: totalDirectoriesCreated, skipped: totalSkipped, duration: `${duration}s` };
  } catch (error) {
    logger.error(`[createDefaultRecords] Error: ${error.message} - duration=${((Date.now() - startTimeMs) / 1000).toFixed(2)}s`);
    throw error;
  }
}

module.exports = { createDefaultRecords, createDefaultRecordsForOrder };
