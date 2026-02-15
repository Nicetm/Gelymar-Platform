const { getSqlPool, sql } = require('../config/sqlserver');
const { mapItemRowToOrderItem } = require('../mappers/sqlsoftkey/item.mapper');
const { logger } = require('../utils/logger');


/**
 * Obtiene todas las líneas de orden existentes
 * @returns {Promise<Array<string>>}
 */
const getAllExistingOrderLines = async () => {
  const sqlPool = await getSqlPool();
  const result = await sqlPool
    .request()
    .query(
      `SELECT Nro, Linea, Factura
       FROM jor_imp_item_90_softkey
       WHERE Nro IS NOT NULL AND Linea IS NOT NULL AND Factura IS NOT NULL`
    );

  return (result.recordset || []).map((row) => `${row.Nro}-${row.Linea}-${row.Factura}`);
};

/**
 * Obtiene todas las líneas de orden
 * @returns {Promise<Array>}
 */
const getAllOrderLines = async () => {
  const sqlPool = await getSqlPool();
  const result = await sqlPool
    .request()
    .query('SELECT * FROM jor_imp_item_90_softkey ORDER BY Nro ASC, Linea ASC');

  return (result.recordset || []).map((row) => mapItemRowToOrderItem(row));
};

/**
 * Obtiene una línea de orden por PC
 * @param {string} pc - Número de PC
 * @returns {Promise<object|null>} Línea de orden encontrada o null
 */
const getOrderLineByPc = async (pc) => {
  try {
    if (!pc) return null;
    const sqlPool = await getSqlPool();
    const request = sqlPool.request();
    request.input('pc', sql.VarChar, pc);

    const result = await request.query(
      `SELECT TOP 1 *
       FROM jor_imp_item_90_softkey
       WHERE Nro = @pc
       ORDER BY Linea ASC`
    );

    const row = result.recordset?.[0];
    return row ? mapItemRowToOrderItem(row) : null;
  } catch (error) {
    logger.error(`Error getting order line by PC: ${error.message}`);
    throw error;
  }
};






module.exports = {
  getAllExistingOrderLines,
  getAllOrderLines,
  getOrderLineByPc
}; 
