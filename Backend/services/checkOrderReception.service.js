const { poolPromise } = require('../config/db');
const { getSqlPool, sql } = require('../config/sqlserver');
const { sendFileToClient } = require('./email.service');
const configService = require('./config.service');
const { logger } = require('../utils/logger');
const { normalizeOc } = require('../utils/oc.util');

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

async function getOrdersReadyForOrderReceiptNotice(sendFromDate = null, filterPc = null, filterFactura = null) {
  try {
    const pool = await poolPromise;
    
    // Construir query para buscar registros en order_files con file_id = 9 y was_sent IS NULL o 0
    let query = `
      SELECT 
        id,
        pc,
        oc,
        factura,
        rut,
        path,
        created_at
      FROM order_files
      WHERE file_id = 9
        AND (was_sent IS NULL OR was_sent = 0)
        AND status_id = 2
    `;
    
    const params = [];
    
    // Aplicar filtros opcionales
    if (filterPc) {
      query += ' AND pc = ?';
      params.push(String(filterPc).trim());
    }
    
    if (filterFactura) {
      query += ' AND factura = ?';
      params.push(String(filterFactura).trim());
    }
    
    query += ' ORDER BY created_at ASC';
    
    const [fileRows] = await pool.query(query, params);
    
    if (!fileRows.length) return [];
    
    // Si hay sendFromDate, filtrar por fecha de la orden en SQL Server
    if (sendFromDate) {
      const sqlPool = await getSqlPool();
      const request = sqlPool.request();
      request.input('sendFrom', sql.Date, sendFromDate);
      
      const pcs = Array.from(new Set(fileRows.map(f => String(f.pc)).filter(Boolean)));
      const pcPlaceholders = pcs.map((_, idx) => `@pc${idx}`);
      pcs.forEach((pc, idx) => {
        request.input(`pc${idx}`, sql.VarChar, pc);
      });
      
      const result = await request.query(`
        SELECT DISTINCT h.Nro AS pc
        FROM jor_imp_HDR_90_softkey h
        WHERE h.Nro IN (${pcPlaceholders.join(', ')})
          AND CONVERT(date, h.Fecha) >= @sendFrom
      `);
      
      const validPcs = new Set(result.recordset.map(row => row.pc));
      
      // Filtrar solo los archivos cuyo PC cumple con sendFrom
      return fileRows
        .filter(file => validPcs.has(file.pc))
        .map(file => ({
          receipt_file_id: file.id,
          pc: file.pc,
          oc: normalizeOc(file.oc),
          factura: file.factura,
          customer_rut: file.rut,
          path: file.path,
          created_at: file.created_at
        }));
    }
    
    // Sin filtro de fecha, retornar todos los archivos encontrados
    return fileRows.map(file => ({
      receipt_file_id: file.id,
      pc: file.pc,
      oc: normalizeOc(file.oc),
      factura: file.factura,
      customer_rut: file.rut,
      path: file.path,
      created_at: file.created_at
    }));
    
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
async function isSendOrderDeliveryEnabled() {
  try {
    const config = await configService.getConfigByName('sendAutomaticOrderDelivery');
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
/**
 * Obtiene emails con reports=true y el idioma del cliente
 * @param {string} customerRut - RUT del cliente
 * @returns {Promise<{reportEmails: string[], customerLang: string}>}
 */
async function getReportEmailsAndLang(customerRut) {
  const pool = await poolPromise;
  try {
    const [contactRows] = await pool.query(
      'SELECT contact_email FROM customer_contacts WHERE rut = ?',
      [customerRut]
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
      const sqlPool = await getSqlPool();
      const request = sqlPool.request();
      request.input('rut', sql.VarChar, customerRut);
      const customerResult = await request.query(`
        SELECT TOP 1 Pais
        FROM jor_imp_CLI_01_softkey
        WHERE Rut = @rut
          AND LTRIM(RTRIM(EstadoCliente)) = 'Activo'
      `);
      const country = customerResult.recordset?.[0]?.Pais || null;
      if (country) {
        const [langRows] = await pool.query(
          'SELECT lang FROM country_lang WHERE country = ?',
          [country]
        );
        if (langRows.length > 0) {
          customerLang = langRows[0].lang || 'en';
        }
      }
    }

    return { reportEmails, customerLang };
  } catch (error) {
    logger.error(`Error obteniendo emails/lang para cliente ${customerRut}: ${error.message}`);
    throw error;
  }
}

/**
 * Obtiene el archivo de recepción de orden
 * @param {number} pc - Número PC
 * @param {string} oc - Número OC (opcional, no se usa para Order Receipt Notice)
 * @returns {Promise<Object|null>} Datos del archivo de recepción
 */
async function getReceptionFile(pc, oc) {
  const pool = await poolPromise;
  try {
    // Order Receipt Notice es a nivel de orden (PC), no requiere OC
    // Si el registro existe, significa que ya pasó las validaciones
    const [rows] = await pool.query(
      `SELECT id, path
       FROM order_files
       WHERE pc = ? AND file_id = ?
       ORDER BY id DESC LIMIT 1`,
      [pc, 9]
    );
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    logger.error(`Error obteniendo archivo de recepción para orden pc=${pc} oc=${oc || 'N/A'}: ${error.message}`);
    throw error;
  }
}


/**
 * Obtiene órdenes con factura y documentos faltantes (Shipment/Delivery/Availability)
 * @returns {Promise<Array>} Array de órdenes
 */
async function getOrdersWithFacturaAndMissingFiles() {
  try {
    const sqlPool = await getSqlPool();
    const result = await sqlPool.request().query(`
      SELECT
        h.Nro AS pc,
        h.OC AS oc,
        c.Nombre AS customer_name,
        c.Rut AS customer_rut
      FROM jor_imp_HDR_90_softkey h
      INNER JOIN jor_imp_FACT_90_softkey f ON f.Nro = h.Nro
      JOIN jor_imp_CLI_01_softkey c ON h.Rut = c.Rut
      WHERE ISNULL(LTRIM(RTRIM(LOWER(h.EstadoOV))), '') <> 'cancelada'
        AND LTRIM(RTRIM(c.EstadoCliente)) = 'Activo'
        AND f.Factura IS NOT NULL
        AND LTRIM(RTRIM(CAST(f.Factura AS NVARCHAR(50)))) <> ''
        AND f.Factura <> 0
        AND f.Factura <> '0'
    `);
    const orders = result.recordset || [];
    if (!orders.length) return [];

    const pool = await poolPromise;
    const pcs = Array.from(new Set(orders.map((o) => String(o.pc)).filter(Boolean)));
    if (!pcs.length) return orders;

    const [fileRows] = await pool.query(
      `SELECT pc, oc, file_id FROM order_files WHERE file_id IN (19, 15, 6) AND pc IN (${pcs.map(() => '?').join(',')})`,
      pcs
    );

    const fileKeySet = new Set(fileRows.map((row) => `${row.pc}||${row.oc || ''}||${row.file_id}`));

    return orders.filter((order) => {
      const keyBase = `${order.pc}||${order.oc || ''}`;
      const hasShipment = fileKeySet.has(`${keyBase}||19`);
      const hasDelivery = fileKeySet.has(`${keyBase}||15`);
      const hasAvailability = fileKeySet.has(`${keyBase}||6`);
      return !hasShipment || !hasDelivery || !hasAvailability;
    });
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
module.exports = {
  getOrdersWithFacturaAndMissingFiles,
  getReportEmailsAndLang,
  getReceptionFile,
  isSendOrderReceptionEnabled,
  isSendOrderDeliveryEnabled,
  isSendOrderShipmentEnabled,
  isSendOrderAvailabilityEnabled,
  getOrdersReadyForOrderReceiptNotice,
  getSendFromDate
};
