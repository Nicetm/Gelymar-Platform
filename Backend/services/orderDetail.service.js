// services/orderDetail.service.js
const { poolPromise } = require('../config/db');

// Insertar un nuevo order detail
async function insertOrderDetail(orderDetailData) {
  const pool = await poolPromise;
  
  const [result] = await pool.query(
    `INSERT INTO order_detail (
      order_id, fecha, tipo, incoterm, currency, direccion_destino, 
      direccion_alterna, puerto_embarque, puerto_destino, fecha_eta, 
      fecha_etd, certificados, estado_ov, medio_envio_factura, 
      gasto_adicional_flete, fecha_incoterm, localizacion, codigo_impuesto, 
      vendedor, nave, condicion_venta, linea, unique_key, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      orderDetailData.order_id,
      orderDetailData.fecha,
      orderDetailData.tipo,
      orderDetailData.incoterm,
      orderDetailData.currency,
      orderDetailData.direccion_destino,
      orderDetailData.direccion_alterna,
      orderDetailData.puerto_embarque,
      orderDetailData.puerto_destino,
      orderDetailData.fecha_eta,
      orderDetailData.fecha_etd,
      orderDetailData.certificados,
      orderDetailData.estado_ov,
      orderDetailData.medio_envio_factura,
      orderDetailData.gasto_adicional_flete,
      orderDetailData.fecha_incoterm,
      orderDetailData.localizacion,
      orderDetailData.codigo_impuesto,
      orderDetailData.vendedor,
      orderDetailData.nave,
      orderDetailData.condicion_venta,
      orderDetailData.linea,
      orderDetailData.unique_key,
      orderDetailData.created_at,
      orderDetailData.updated_at
    ]
  );
  
  return result.insertId;
}

// Obtener order detail por order_id
async function getOrderDetailByOrderId(orderId) {
  const pool = await poolPromise;
  
  const [rows] = await pool.query(
    `SELECT 
      id, order_id, incoterm, direccion_destino, puerto_destino, 
      u_observaciones, fecha_eta, fecha_etd, certificados, 
      pymnt_group, fec_deseada_dep_planta, fec_deseada_cliente, 
      fec_real_dep_planta, fec_original_cliente, u_reserva, 
      folio_gd, motivo_retraso, created_at, updated_at
    FROM order_detail WHERE order_id = ?`,
    [orderId]
  );
  
  return rows[0];
}

// Obtener todos los order details
async function getAllOrderDetails() {
  const pool = await poolPromise;
  
  const [rows] = await pool.query(
    'SELECT * FROM order_detail ORDER BY id DESC'
  );
  
  return rows;
}

// Crear order detail (solo insertar)
async function createOrderDetail(orderId, data) {
  // Crear uno nuevo
  const insertId = await insertOrderDetail({
    order_id: orderId,
    ...data
  });
  
  return { created: true, id: insertId };
}

module.exports = {
  insertOrderDetail,
  getOrderDetailByOrderId,
  getAllOrderDetails,
  createOrderDetail
}; 