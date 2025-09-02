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
      gasto_adicional_flete, localizacion, codigo_impuesto, 
      vendedor, nave, condicion_venta, csv_row_hash, csv_file_timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      orderDetailData.localizacion,
      orderDetailData.codigo_impuesto,
      orderDetailData.vendedor,
      orderDetailData.nave,
      orderDetailData.condicion_venta,
      orderDetailData.csv_row_hash,
      orderDetailData.csv_file_timestamp
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

// Crear o actualizar order detail
async function createOrUpdateOrderDetail(orderId, data) {
  const pool = await poolPromise;
  
  // Verificar si ya existe un order detail para este order_id
  const [existingRows] = await pool.query(
    'SELECT id FROM order_detail WHERE order_id = ?',
    [orderId]
  );
  
  if (existingRows.length > 0) {
    // Actualizar el existente
    const [result] = await pool.query(
      `UPDATE order_detail SET 
        fecha = ?, tipo = ?, incoterm = ?, currency = ?, direccion_destino = ?,
        direccion_alterna = ?, puerto_embarque = ?, puerto_destino = ?, fecha_eta = ?,
        fecha_etd = ?, certificados = ?, estado_ov = ?, medio_envio_factura = ?,
        gasto_adicional_flete = ?, localizacion = ?, codigo_impuesto = ?,
        vendedor = ?, nave = ?, condicion_venta = ?, csv_row_hash = ?, csv_file_timestamp = ?
      WHERE order_id = ?`,
      [
        data.fecha,
        data.tipo,
        data.incoterm,
        data.currency,
        data.direccion_destino,
        data.direccion_alterna,
        data.puerto_embarque,
        data.puerto_destino,
        data.fecha_eta,
        data.fecha_etd,
        data.certificados,
        data.estado_ov,
        data.medio_envio_factura,
        data.gasto_adicional_flete,
        data.localizacion,
        data.codigo_impuesto,
        data.vendedor,
        data.nave,
        data.condicion_venta,
        data.csv_row_hash,
        data.csv_file_timestamp,
        orderId
      ]
    );
    
    return { created: false, updated: true, id: existingRows[0].id };
  } else {
    // Crear uno nuevo
    const insertId = await insertOrderDetail({
      order_id: orderId,
      ...data
    });
    
    return { created: true, updated: false, id: insertId };
  }
}

module.exports = {
  insertOrderDetail,
  getOrderDetailByOrderId,
  getAllOrderDetails,
  createOrUpdateOrderDetail
}; 