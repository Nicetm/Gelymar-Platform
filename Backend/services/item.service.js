const { getSqlPool, sql } = require('../config/sqlserver');
const { mapProRowToItem } = require('../mappers/sqlsoftkey/pro.mapper');
const { mapItemRowToOrderItem } = require('../mappers/sqlsoftkey/item.mapper');
const { logger } = require('../utils/logger');
const { mapHdrRowToOrder } = require('../mappers/sqlsoftkey/hdr.mapper');
const { normalizeOcForCompare } = require('../utils/oc.util');

const parseOrderKey = (orderId) => {
  if (!orderId) return null;
  if (typeof orderId !== 'string') return null;
  const trimmed = orderId.trim();
  if (!trimmed) return null;
  if (trimmed.includes('|')) {
    const [pc, ...ocParts] = trimmed.split('|');
    return { pc: pc.trim(), oc: ocParts.join('|').trim() };
  }
  return { pc: trimmed, oc: null };
};


/**
 * Obtiene todos los items
 * @returns {Promise<Array>}
 */
const getAllItems = async () => {
  const sqlPool = await getSqlPool();
  const result = await sqlPool
    .request()
    .query('SELECT * FROM jor_imp_PRO_01_softkey ORDER BY Item ASC');
  return (result.recordset || []).map((row) => mapProRowToItem(row));
};

/**
 * Obtiene un item por su código
 * @param {string} itemCode - Código del item
 * @returns {Promise<Object|null>}
 */
const getItemByCode = async (itemCode) => {
  const sqlPool = await getSqlPool();
  const request = sqlPool.request();
  request.input('item', sql.VarChar, itemCode);
  const result = await request.query(
    'SELECT TOP 1 * FROM jor_imp_PRO_01_softkey WHERE Item = @item'
  );
  const row = result.recordset?.[0];
  return row ? mapProRowToItem(row) : null;
};

/**
 * Obtiene todos los códigos de items existentes
 * @returns {Promise<Array<string>>}
 */
const getAllItemCodes = async () => {
  const sqlPool = await getSqlPool();
  const result = await sqlPool.request().query(
    'SELECT DISTINCT Item FROM jor_imp_PRO_01_softkey WHERE Item IS NOT NULL'
  );
  return (result.recordset || []).map((row) => row.Item);
};

/**
 * Obtener items por orden con validación de permisos
 * REFACTORING: Now uses LEFT JOIN with Vista_FACT to enrich items with invoice dates
 * @param {number} orderId - ID de la orden
 * @param {object} user - Usuario autenticado
 * @returns {Promise<array|null>} Items de la orden o null
 */
async function getItemsByOrder(orderId, user) {
  try {
    const key = parseOrderKey(orderId);
    if (!key) return null;

    const sqlPool = await getSqlPool();
    const headerRequest = sqlPool.request();
    headerRequest.input('pc', sql.VarChar, key.pc);
    if (key.oc) {
      headerRequest.input('oc', sql.VarChar, normalizeOcForCompare(key.oc));
    }

    const headerResult = await headerRequest.query(
      `SELECT TOP 1 *
       FROM jor_imp_HDR_90_softkey
       WHERE Nro = @pc`
    );
    const headerRow = headerResult.recordset?.[0];
    if (!headerRow) return null;

    const mappedHeader = mapHdrRowToOrder(headerRow);
    if (user?.role === 'client' && mappedHeader.rut !== (user.rut || user.email)) {
      return null;
    }

    // REFACTORING: LEFT JOIN with Vista_FACT to enrich items with invoice dates
    // This allows items without invoices to be included (LEFT JOIN)
    const itemsRequest = sqlPool.request();
    itemsRequest.input('pc', sql.VarChar, key.pc);
    const itemsResult = await itemsRequest.query(
      `SELECT 
         i.*,
         f.Fecha_factura,
         f.ETD_ENC_FA,
         f.ETA_ENC_FA
       FROM jor_imp_item_90_softkey i
       LEFT JOIN jor_imp_FACT_90_softkey f 
         ON f.Nro = i.Nro 
         AND f.Factura = i.Factura
       WHERE i.Nro = @pc
       ORDER BY i.Linea ASC`
    );
    return (itemsResult.recordset || []).map((row) => mapItemRowToOrderItem(row));
  } catch (error) {
    logger.error(`[ItemService] Error en getItemsByOrder: ${error.message}`);
    throw error;
  }
}

/**
 * Obtener items por factura específica con validación de permisos
 * REFACTORING: New function to get items for a specific invoice
 * Uses INNER JOIN with Vista_FACT to validate invoice exists
 * @param {string} pc - Número de orden (PC)
 * @param {string} factura - Número de factura
 * @param {object} user - Usuario autenticado
 * @returns {Promise<array|null>} Items de la factura o null
 */
async function getItemsByInvoice(pc, factura, user) {
  try {
    if (!pc || !factura) return null;

    const sqlPool = await getSqlPool();
    
    // Validate access permissions
    const headerRequest = sqlPool.request();
    headerRequest.input('pc', sql.VarChar, pc);
    const headerResult = await headerRequest.query(
      `SELECT TOP 1 *
       FROM jor_imp_HDR_90_softkey
       WHERE Nro = @pc`
    );
    const headerRow = headerResult.recordset?.[0];
    if (!headerRow) return null;

    const mappedHeader = mapHdrRowToOrder(headerRow);
    if (user?.role === 'client' && mappedHeader.rut !== (user.rut || user.email)) {
      return null;
    }

    // REFACTORING: INNER JOIN with Vista_FACT to validate invoice exists
    // This ensures only items from valid invoices are returned
    const itemsRequest = sqlPool.request();
    itemsRequest.input('pc', sql.VarChar, pc);
    itemsRequest.input('factura', sql.VarChar, factura);
    const itemsResult = await itemsRequest.query(
      `SELECT 
         i.*,
         f.Fecha_factura,
         f.ETD_ENC_FA,
         f.ETA_ENC_FA
       FROM jor_imp_item_90_softkey i
       INNER JOIN jor_imp_FACT_90_softkey f 
         ON f.Nro = i.Nro 
         AND f.Factura = i.Factura
       WHERE i.Nro = @pc 
         AND i.Factura = @factura
       ORDER BY i.Linea ASC`
    );
    return (itemsResult.recordset || []).map((row) => mapItemRowToOrderItem(row));
  } catch (error) {
    logger.error(`[ItemService] Error en getItemsByInvoice: ${error.message}`);
    throw error;
  }
}



module.exports = {
  getAllItems,
  getItemByCode,
  getAllItemCodes,
  getItemsByOrder,
  getItemsByInvoice
}; 
