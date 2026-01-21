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
      try {
        params = JSON.parse(trimmed.replace(/'/g, '"'));
      } catch (fallbackError) {
        logger.error(`Error parseando parametros de configuracion sendAutomaticOrderReception: ${fallbackError.message}`);
        return {};
      }
    }
  }

  if (typeof params !== 'object' || params === null) {
    return {};
  }

  return params;
}

async function getSendFromDate(configName) {
  try {
    const config = await configService.getConfigByName(configName);
    if (!config) {
      return null;
    }

    const params = parseConfigParams(config.params);
    const sendFrom = params.sendFrom;
    if (!sendFrom) {
      return null;
    }

    const parsed = new Date(String(sendFrom).trim());
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    return parsed.toISOString().slice(0, 10);
  } catch (error) {
    logger.error(`Error obteniendo sendFrom para ${configName}: ${error.message}`);
    return null;
  }
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

async function getOrdersReadyForOrderReceiptNotice(sendFromDate = null) {
  const pool = await poolPromise;
  try {
    const params = [];
    let sendFromFilter = '';
    if (sendFromDate) {
      sendFromFilter = ' AND DATE(o.fecha_ingreso) >= ?';
      params.push(sendFromDate);
    }

    const [rows] = await pool.query(
      `
        SELECT
          o.id,
          o.customer_id,
          o.pc,
          o.oc,
          o.fecha_ingreso,
          c.name AS customer_name,
          f.id AS receipt_file_id,
          f.fecha_envio AS receipt_fecha_envio
        FROM orders o
        JOIN customers c ON o.customer_id = c.id
        LEFT JOIN order_files f ON f.order_id = o.id AND f.file_id = 9
        WHERE (o.factura IS NULL OR o.factura = '' OR o.factura = 0 OR o.factura = '0')
          AND (f.id IS NULL OR f.fecha_envio IS NULL)
          ${sendFromFilter}
        ORDER BY o.id ASC
      `,
      params
    );
    return rows;
  } catch (error) {
    logger.error(`Error obteniendo ordenes para Order Receipt Notice: ${error.message}`);
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

async function isSendOrderDeliveryEnabled() {
  try {
    const config = await configService.getConfigByName('sendAutomaticOrderDelivery');
    logger.info(`[sendAutomaticOrderDelivery] config: ${JSON.stringify(config)}`);
    if (!config) {
      return false;
    }

    const params = parseConfigParams(config.params);
    logger.info(`[sendAutomaticOrderDelivery] params: ${JSON.stringify(params)}`);
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
    logger.error(`Error obteniendo configuracion sendAutomaticOrderDelivery: ${error.message}`);
    return false;
  }
}

async function isSendOrderShipmentEnabled() {
  try {
    const config = await configService.getConfigByName('sendAutomaticOrderShipment');
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
    logger.error(`Error obteniendo configuracion sendAutomaticOrderShipment: ${error.message}`);
    return false;
  }
}

async function isSendOrderAvailabilityEnabled() {
  try {
    const config = await configService.getConfigByName('sendAutomaticOrderAvailability');
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
    logger.error(`Error obteniendo configuracion sendAutomaticOrderAvailability: ${error.message}`);
    return false;
  }
}

/**
 * Obtiene datos completos de la orden junto al nombre del cliente
 * @param {number} orderId - ID de la orden
 * @returns {Promise<Object|null>} Datos completos de la orden
 */
async function getOrderWithCustomer(orderId) {
  const pool = await poolPromise;
  try {
    const [rows] = await pool.query(
      `SELECT o.*, c.name as customer_name 
       FROM orders o
       JOIN customers c ON o.customer_id = c.id
       WHERE o.id = ?`,
      [orderId]
    );
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    logger.error(`Error obteniendo datos completos de orden ${orderId}: ${error.message}`);
    throw error;
  }
}

/**
 * Obtiene emails con reports=true y el idioma del cliente
 * @param {number} customerId - ID del cliente
 * @returns {Promise<{reportEmails: string[], customerLang: string}>}
 */
async function getReportEmailsAndLang(customerId) {
  const pool = await poolPromise;
  try {
    const [contactRows] = await pool.query(
      'SELECT contact_email FROM customer_contacts WHERE customer_id = ?',
      [customerId]
    );

    let reportEmails = [];
    let customerLang = 'en';

    if (contactRows.length > 0 && contactRows[0].contact_email) {
      try {
        const contacts = typeof contactRows[0].contact_email === 'string'
          ? JSON.parse(contactRows[0].contact_email)
          : contactRows[0].contact_email;

        if (Array.isArray(contacts)) {
          const reportContacts = contacts.filter(contact => contact.reports === true);
          reportEmails = reportContacts
            .map(contact => contact.email)
            .filter(email => email && email.trim());
        }
      } catch (error) {
        logger.error(`Error parseando contact_email para cliente ${customerId}: ${error.message}`);
      }
    }

    if (reportEmails.length > 0) {
      const [customerRows] = await pool.query(
        'SELECT c.country, cl.lang FROM customers c INNER JOIN country_lang cl ON c.country = cl.country WHERE c.id = ?',
        [customerId]
      );
      if (customerRows.length > 0) {
        customerLang = customerRows[0].lang || 'en';
      }
    }

    return { reportEmails, customerLang };
  } catch (error) {
    logger.error(`Error obteniendo emails/lang para cliente ${customerId}: ${error.message}`);
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
      'SELECT id, path FROM order_files WHERE order_id = ? AND file_id = ?',
      [orderId, 9]
    );
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    logger.error(`Error obteniendo archivo de recepción para orden ${orderId}: ${error.message}`);
    throw error;
  }
}

/**
 * Obtiene órdenes con factura y documentos faltantes (Shipment/Delivery/Availability)
 * @returns {Promise<Array>} Array de órdenes
 */
async function getOrdersWithFacturaAndMissingFiles() {
  const pool = await poolPromise;
  try {
    const [rows] = await pool.query(
      `
        SELECT o.id, o.pc, o.oc, c.name as customer_name
        FROM orders o
        JOIN customers c ON o.customer_id = c.id
        WHERE o.factura IS NOT NULL
          AND o.factura <> ''
          AND o.factura <> 0
          AND o.factura <> '0'
          AND (
            NOT EXISTS (
              SELECT 1 FROM order_files f
              WHERE f.order_id = o.id AND f.file_id = 19
            )
            OR NOT EXISTS (
              SELECT 1 FROM order_files f
              WHERE f.order_id = o.id AND f.file_id = 15
            )
            OR NOT EXISTS (
              SELECT 1 FROM order_files f
              WHERE f.order_id = o.id AND f.file_id = 6
            )
          )
      `
    );
    return rows;
  } catch (error) {
    logger.error(`Error obteniendo ordenes con factura y archivos faltantes: ${error.message}`);
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


module.exports = {
  getOrderData,
  getOrderWithCustomer,
  getOrdersWithFacturaAndMissingFiles,
  getReportEmailsAndLang,
  getReceptionFile,
  getCustomerEmail,
  isSendOrderReceptionEnabled,
  isSendOrderDeliveryEnabled,
  isSendOrderShipmentEnabled,
  isSendOrderAvailabilityEnabled,
  getOrdersReadyForOrderReceiptNotice,
  getSendFromDate
};
