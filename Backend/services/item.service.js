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
       WHERE Nro = @pc
       ${key.oc ? "AND REPLACE(REPLACE(UPPER(OC), ' ', ''), '-', '') = @oc" : ''}`
    );
    const headerRow = headerResult.recordset?.[0];
    if (!headerRow) return null;

    const mappedHeader = mapHdrRowToOrder(headerRow);
    if (user?.role === 'client' && mappedHeader.rut !== (user.rut || user.email)) {
      return null;
    }

    const itemsRequest = sqlPool.request();
    itemsRequest.input('pc', sql.VarChar, key.pc);
    const itemsResult = await itemsRequest.query(
      `SELECT *
       FROM jor_imp_item_90_softkey
       WHERE Nro = @pc`
    );
    return (itemsResult.recordset || []).map((row) => mapItemRowToOrderItem(row));
  } catch (error) {
    logger.error(`[ItemService] Error en getItemsByOrder: ${error.message}`);
    throw error;
  }
}



module.exports = {
  getAllItems,
  getItemByCode,
  getAllItemCodes,
  getItemsByOrder
}; 
