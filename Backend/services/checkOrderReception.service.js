const { poolPromise } = require('../config/db');
const { sendFileToClient } = require('./email.service');
const { logger } = require('../utils/logger');

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
      [orderId, 'Recepcion de orden']
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
      'SELECT c.email, c.country, cl.lang FROM customers c INNER JOIN country_lang cl ON c.country = cl.country WHERE c.id = ? AND c.rut = ?',
      [customerId, rut]
    );
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    logger.error(`Error obteniendo email del cliente ${customerId}: ${error.message}`);
    throw error;
  }
}

/**
 * Servicio para enviar documentos de recepción de orden por email
 * Se ejecuta diariamente a las 8 AM para enviar documentos de órdenes del día anterior
 */
async function sendOrderReceptionDocuments() {
  const pool = await poolPromise;
  
  try {
    logger.info('Iniciando envío de documentos de recepción de orden...');
    
    // Obtener fecha de ayer
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0]; // YYYY-MM-DD
    
    logger.info(`Buscando órdenes con fecha: ${yesterdayStr}`);
    
    // Consultar órdenes del día anterior
    const [orders] = await pool.query(`
      SELECT 
        o.id,
        o.customer_id,
        o.rut,
        o.pc,
        o.oc,
        c.name as customer_name,
        c.uuid as customer_uuid
      FROM orders o
      INNER JOIN customers c ON c.id = o.customer_id
      WHERE DATE(o.fecha_ingreso) = ?
    `, [yesterdayStr]);
    
    if (orders.length === 0) {
      logger.info('No se encontraron órdenes para el día anterior');
      return;
    }
    
    logger.info(`Se encontraron ${orders.length} órdenes para procesar`);
    
    // Procesar cada orden
    for (const order of orders) {
      try {
        await processOrderReception(order);
      } catch (error) {
        logger.error(`Error procesando orden ${order.id}: ${error.message}`);
        // Continuar con la siguiente orden
      }
    }
    
    logger.info('Envío de documentos de recepción completado');
    
  } catch (error) {
    logger.error(`Error en sendOrderReceptionDocuments: ${error.message}`);
    throw error;
  }
}

/**
 * Procesa una orden individual para enviar documentos de recepción
 * @param {Object} order - Datos de la orden
 */
async function processOrderReception(order) {
  const pool = await poolPromise;
  
  try {
    logger.info(`Procesando orden ${order.id} - PC: ${order.pc}, OC: ${order.oc}`);
    
    // Buscar archivos de recepción de orden para esta orden (solo los no enviados)
    const [receptionFiles] = await pool.query(`
      SELECT 
        f.id,
        f.name,
        f.path,
        f.customer_id,
        f.pc,
        f.oc,
        c.name AS customer_name,
        cc.primary_email AS customer_email,
        GROUP_CONCAT(cc2.contact_email SEPARATOR ',') AS contact_emails
      FROM order_files f
      JOIN customers c ON f.customer_id = c.id
      LEFT JOIN customer_contacts cc ON c.id = cc.customer_id
      LEFT JOIN customer_contacts cc2 ON c.id = cc2.customer_id AND cc2.contact_email IS NOT NULL
      WHERE f.customer_id = ? 
        AND f.pc = ? 
        AND f.oc = ?
        AND f.name LIKE '%recepcion%orden%'
        AND (f.was_sent IS NULL OR f.was_sent = 0)
      GROUP BY f.id
    `, [order.customer_id, order.pc, order.oc]);
    
    if (receptionFiles.length === 0) {
      logger.info(`No se encontraron archivos de recepción para orden ${order.id}`);
      return;
    }
    
    logger.info(`Se encontraron ${receptionFiles.length} archivos de recepción para orden ${order.id}`);
    
    // Enviar cada archivo de recepción
    for (const file of receptionFiles) {
      try {
        // Verificar que tenga email principal
        if (!file.customer_email) {
          logger.warn(`No se encontró email principal para archivo ${file.name} (orden ${order.id})`);
          continue;
        }
        
        logger.info(`Enviando archivo ${file.name} a ${file.customer_email}`);
        await sendFileToClient(file);
        
        // Marcar archivo como enviado
        await pool.query(
          'UPDATE order_files SET was_sent = 1 WHERE id = ?',
          [file.id]
        );
        
        logger.info(`Archivo ${file.name} enviado exitosamente`);
        
      } catch (error) {
        logger.error(`Error enviando archivo ${file.name}: ${error.message}`);
        // Continuar con el siguiente archivo
      }
    }
    
  } catch (error) {
    logger.error(`Error en processOrderReception para orden ${order.id}: ${error.message}`);
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
  sendOrderReceptionDocuments,
  getNewOrders,
  getOrderData,
  getReceptionFile,
  getCustomerEmail,
  markOrderAsSent
};
