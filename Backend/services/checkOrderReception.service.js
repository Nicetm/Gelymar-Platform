const { poolPromise } = require('../config/db');
const { sendFileToClient } = require('./email.service');
const configService = require('./config.service');
const { logger } = require('../utils/logger');

function parseConfigParams(rawParams) {
  if (rawParams == null) {
    return {};
  }

  let params = rawParams;

  if (Buffer.isBuffer(params)) {
    params = params.toString('utf8');
  }

  if (typeof params === 'string') {
    const trimmed = params.trim();
    if (!trimmed) {
      return {};
    }
    try {
      params = JSON.parse(trimmed);
    } catch (error) {
      logger.error(`Error parseando parametros de configuracion sendAutomaticOrderReception: ${error.message}`);
      return {};
    }
  }

  if (typeof params !== 'object' || params === null) {
    return {};
  }

  return params;
}

async function isSendOrderReceptionEnabled() {
  try {
    const config = await configService.getConfigByName('sendAutomaticOrderReception');
    if (!config) {
      return false;
    }

    const params = parseConfigParams(config.params);
    const { enable } = params;

    if (enable === undefined || enable === null) {
      return false;
    }

    const numericEnable = Number(enable);
    if (!Number.isNaN(numericEnable)) {
      return numericEnable === 1;
    }

    return String(enable).toLowerCase() === 'true';
  } catch (error) {
    logger.error(`Error obteniendo configuracion sendAutomaticOrderReception: ${error.message}`);
    return false;
  }
}

/**
 * Obtiene todos los order_id de la tabla new_orders que no han sido enviadas
 * @returns {Promise<Array>} Array de order_ids
 */
async function getNewOrders() {
  const pool = await poolPromise;
  try {
    const [rows] = await pool.query('SELECT order_id FROM new_orders WHERE has_sent = 0 ORDER BY id ASC');
    return rows.map(row => row.order_id);
  } catch (error) {
    logger.error(`Error obteniendo nuevas órdenes: ${error.message}`);
    throw error;
  }
}

/**
 * Obtiene datos de una orden específica
 * @param {number} orderId - ID de la orden
 * @returns {Promise<Object|null>} Datos de la orden (rut, customer_id)
 */
async function getOrderData(orderId) {
  const pool = await poolPromise;
  try {
    const [rows] = await pool.query(
      'SELECT rut, customer_id FROM orders WHERE id = ?',
      [orderId]
    );
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    logger.error(`Error obteniendo datos de orden ${orderId}: ${error.message}`);
    throw error;
  }
}

/**
 * Obtiene el archivo de recepción de orden
 * @param {number} orderId - ID de la orden
 * @returns {Promise<Object|null>} Datos del archivo de recepción
 */
async function getReceptionFile(orderId) {
  const pool = await poolPromise;
  try {
    const [rows] = await pool.query(
      'SELECT id, path FROM order_files WHERE order_id = ? AND name = ?',
      [orderId, 'Order Receipt Notice']
    );
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    logger.error(`Error obteniendo archivo de recepción para orden ${orderId}: ${error.message}`);
    throw error;
  }
}

/**
 * Obtiene el email del cliente
 * @param {number} customerId - ID del cliente
 * @param {string} rut - RUT del cliente
 * @returns {Promise<Object|null>} Datos del cliente (email, country, lang)
 */
async function getCustomerEmail(customerId, rut) {
  const pool = await poolPromise;
  try {
    const [rows] = await pool.query(
      'SELECT c.contact_secondary, c.country, cl.lang FROM customers c INNER JOIN country_lang cl ON c.country = cl.country WHERE c.id = ? AND c.rut = ?',
      [customerId, rut]
    );
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    logger.error(`Error obteniendo email del cliente ${customerId}: ${error.message}`);
    throw error;
  }
}

/**
 * Marca una orden como enviada en new_orders
 * @param {number} orderId - ID de la orden
 * @returns {Promise<boolean>} True si se marcó correctamente
 */
async function markOrderAsSent(orderId) {
  const pool = await poolPromise;
  try {
    const [result] = await pool.query(
      'UPDATE new_orders SET has_sent = 1 WHERE order_id = ?',
      [orderId]
    );
    return result.affectedRows > 0;
  } catch (error) {
    logger.error(`Error marcando orden ${orderId} como enviada: ${error.message}`);
    throw error;
  }
}

module.exports = {
  getNewOrders,
  getOrderData,
  getReceptionFile,
  getCustomerEmail,
  markOrderAsSent,
  isSendOrderReceptionEnabled
};
