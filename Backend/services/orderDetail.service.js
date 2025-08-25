const { poolPromise } = require('../config/db');
const OrderDetail = require('../models/orderDetail.model');

/**
 * Obtiene los detalles de una orden específica con información de ambas tablas
 * @param {number} orderId - ID de la orden
 * @returns {Promise<Object|null>} Objeto con datos combinados o null si no existe
 */
const getOrderDetailByOrderId = async (orderId) => {
  try {
    const pool = await poolPromise;
    
    const query = `
      SELECT 
        od.*,
        o.pc,
        o.oc,
        o.fecha_etd as order_fecha_etd,
        o.fecha_eta as order_fecha_eta
      FROM order_detail od
      LEFT JOIN orders o ON od.order_id = o.id
      WHERE od.order_id = ?
      LIMIT 1
    `;
    
    const [rows] = await pool.query(query, [orderId]);
    
    if (rows.length === 0) {
      return null;
    }
    
    const row = rows[0];
    
    // Crear objeto combinado con datos de ambas tablas
    const orderDetail = new OrderDetail({
      id: row.id,
      order_id: row.order_id,
      incoterm: row.incoterm,
      direccion_destino: row.direccion_destino,
      puerto_destino: row.puerto_destino,
      u_observaciones: row.u_observaciones,
      fecha_eta: row.fecha_eta || row.order_fecha_eta,
      fecha_etd: row.fecha_etd || row.order_fecha_etd,
      certificados: row.certificados,
      pymnt_group: row.pymnt_group,
      fec_deseada_dep_planta: row.fec_deseada_dep_planta,
      fec_deseada_cliente: row.fec_deseada_cliente,
      fec_real_dep_planta: row.fec_real_dep_planta,
      fec_original_cliente: row.fec_original_cliente,
      u_reserva: row.u_reserva,
      folio_gd: row.folio_gd,
      motivo_retraso: row.motivo_retraso,
      created_at: row.created_at,
      updated_at: row.updated_at
    });
    
    // Agregar campos de la tabla orders
    orderDetail.pc = row.pc;
    orderDetail.oc = row.oc;
    
    return orderDetail;
    
  } catch (error) {
    console.error('Error getting order detail:', error);
    throw error;
  }
};

/**
 * Crea o actualiza los detalles de una orden
 * @param {number} orderId - ID de la orden
 * @param {Object} data - Datos a insertar/actualizar
 * @returns {Promise<Object>} Objeto con el resultado de la operación
 */
const createOrUpdateOrderDetail = async (orderId, data) => {
  try {
    const pool = await poolPromise;
    
    // Verificar si ya existe un registro para esta orden
    const [existingRows] = await pool.query(
      'SELECT id FROM order_detail WHERE order_id = ?',
      [orderId]
    );
    
    if (existingRows.length > 0) {
      // Actualizar registro existente
      const updateQuery = `
        UPDATE order_detail SET
          incoterm = ?,
          direccion_destino = ?,
          puerto_destino = ?,
          u_observaciones = ?,
          fecha_eta = ?,
          fecha_etd = ?,
          certificados = ?,
          updated_at = NOW()
        WHERE order_id = ?
      `;
      
      const [result] = await pool.query(updateQuery, [
        data.incoterm,
        data.direccion_destino,
        data.puerto_destino,
        data.u_observaciones,
        data.fecha_eta,
        data.fecha_etd,
        data.certificados,
        orderId
      ]);
      
      return { updated: true, id: existingRows[0].id };
    } else {
      // Crear nuevo registro
      const insertQuery = `
        INSERT INTO order_detail (
          order_id, incoterm, direccion_destino, puerto_destino, 
          u_observaciones, fecha_eta, fecha_etd, certificados, 
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `;
      
      const [result] = await pool.query(insertQuery, [
        orderId,
        data.incoterm,
        data.direccion_destino,
        data.puerto_destino,
        data.u_observaciones,
        data.fecha_eta,
        data.fecha_etd,
        data.certificados
      ]);
      
      return { created: true, id: result.insertId };
    }
    
  } catch (error) {
    console.error('Error creating/updating order detail:', error);
    throw error;
  }
};

/**
 * Obtiene datos básicos de una orden desde la tabla orders
 * @param {number} orderId - ID de la orden
 * @returns {Promise<Object|null>} Datos básicos de la orden o null si no existe
 */
const getBasicOrderData = async (orderId) => {
  try {
    const pool = await poolPromise;
    
    const query = `
      SELECT 
        id,
        pc,
        oc,
        fecha_etd,
        fecha_eta,
        created_at,
        updated_at
      FROM orders
      WHERE id = ?
    `;
    
    const [rows] = await pool.query(query, [orderId]);
    
    if (rows.length === 0) {
      return null;
    }
    
    const row = rows[0];
    
    // Crear objeto con datos básicos
    return {
      id: row.id,
      order_id: row.id,
      pc: row.pc,
      oc: row.oc,
      fecha_etd: row.fecha_etd,
      fecha_eta: row.fecha_eta,
      incoterm: null,
      direccion_destino: null,
      puerto_destino: null,
      u_observaciones: null,
      certificados: null,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
    
  } catch (error) {
    console.error('Error getting basic order data:', error);
    throw error;
  }
};

module.exports = {
  getOrderDetailByOrderId,
  createOrUpdateOrderDetail,
  getBasicOrderData
}; 