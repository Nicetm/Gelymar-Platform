const { poolPromise } = require('../config/db');
const Order = require('../models/order.model');

/**
 * Busca órdenes por filtros opcionales
 * @param {object} filters
 * @returns {Promise<Order[]>}
 */
const getOrdersByFilters = async (filters = {}) => {
  const pool = await poolPromise;

  let query = `
    SELECT 
      o.id,
      o.rut,
      o.oc,
      o.pc,
      o.created_at,
      o.updated_at,
      c.name AS customer_name,
      c.uuid AS customer_uuid,
      o.factura,
      o.fecha_factura,
      od.order_id,
      od.fecha,
      od.fecha_etd,
      od.currency,
      od.medio_envio_factura
    FROM orders o
    JOIN customers c ON o.customer_id = c.id
    JOIN order_detail od ON o.id = od.order_id`;

  const params = [];

  const [rows] = await pool.query(query, params);

  return rows.map(r => {
    const order = new Order({
      id: r.id,
      rut: r.rut,
      pc: r.pc,
      oc: r.oc,
      path: r.path,
      created_at: r.created_at,
      updated_at: r.updated_at,
      customer_name: r.customer_name,
      customer_uuid: r.customer_uuid,
      order_id: r.order_id,
      factura: r.factura,
      fecha_factura: r.fecha_factura,
      fecha: r.fecha,
      fecha_etd: r.fecha_etd,
      currency: r.currency,
      medio_envio_factura: r.medio_envio_factura
    });

    return order;
  });
};

/**
 * Obtiene órdenes formateadas para el dashboard del cliente
 * @param {string} customerUUID - UUID del cliente
 * @returns {Promise<Array>} Array de órdenes formateadas
 */
const getClientDashboardOrders = async (customerUUID) => {
  const pool = await poolPromise;
  
  const query = `
    SELECT 
      o.id,
      o.oc AS orderNumber,
      c.name AS clientName,
      o.created_at,
      o.updated_at,
      COUNT(CASE WHEN f.is_visible_to_client = 1 THEN f.id END) AS documents,
      CASE 
        WHEN COUNT(CASE WHEN f.is_visible_to_client = 1 THEN f.id END) = 0 THEN 'Pending'
        WHEN COUNT(CASE WHEN f.is_visible_to_client = 1 THEN f.id END) < 5 THEN 'In Progress'
        ELSE 'Completed'
      END AS status,
      CASE 
        WHEN o.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 'high'
        WHEN o.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 'medium'
        ELSE 'low'
      END AS priority
    FROM orders o
    JOIN customers c ON o.customer_id = c.id
    LEFT JOIN files f ON f.order_id = o.id
    WHERE c.uuid = ?
    GROUP BY o.id, o.oc, c.name, o.created_at, o.updated_at
    ORDER BY o.updated_at DESC
    LIMIT 6
  `;
  
  const [rows] = await pool.query(query, [customerUUID]);

  return rows.map(row => ({
    id: row.id,
    orderNumber: row.orderNumber,
    clientName: row.clientName,
    status: row.status,
    documents: row.documents,
    lastUpdated: row.updated_at,
    priority: row.priority
  }));
};

/**
 * Obtiene documentos de una orden específica del cliente
 * @param {number} orderId - ID de la orden
 * @param {string} customerUUID - UUID del cliente
 * @returns {Promise<Array|null>} Array de documentos o null si no autorizado
 */
const getClientOrderDocuments = async (orderId, customerUUID) => {
  try {
    const pool = await poolPromise;

    // Primero verificar que la orden pertenece al cliente
    const orderQuery = `
      SELECT o.id, o.oc AS orderNumber, c.name AS clientName
      FROM orders o
      JOIN customers c ON o.customer_id = c.id
      WHERE o.id = ? AND c.uuid = ?
    `;

    const [orderRows] = await pool.query(orderQuery, [orderId, customerUUID]);

    if (orderRows.length === 0) {
      return null; // Orden no encontrada o no autorizada
    }

  const order = orderRows[0];

  // Obtener documentos de la orden (solo los visibles para el cliente)
  const documentsQuery = `
    SELECT 
      f.id,
      f.name AS filename,
      f.path AS filepath,
      f.file_type AS filetype,
      f.created_at,
      f.updated_at,
      s.name AS status
    FROM files f
    LEFT JOIN order_status s ON f.status_id = s.id
    WHERE f.order_id = ? AND f.is_visible_to_client = 1
    ORDER BY f.created_at DESC
  `;

  const [documentRows] = await pool.query(documentsQuery, [order.id]);

  const result = {
    order: {
      id: order.id,
      orderNumber: order.orderNumber,
      clientName: order.clientName
    },
    documents: documentRows.map(doc => ({
      id: doc.id,
      filename: doc.filename,
      filepath: doc.filepath,
      filetype: doc.filetype,
      filesize: 0, // No hay campo filesize en la tabla
      status: doc.status || 'Unread',
      statusColor: 'gray', // Color por defecto ya que no hay campo color en order_status
      created: doc.created_at,
      updated: doc.updated_at
    }))
  };

  return result;
  } catch (error) {
    throw error; // Re-lanzar el error para que el controlador lo maneje
  }
};

/**
 * Inserta una nueva orden en la base de datos
 * @param {object} data - Datos de la orden
 * @returns {Promise<void>}
 */
const insertOrder = async (data) => {
  try {
    const pool = await poolPromise;
    
    const query = `
      INSERT INTO orders (
        customer_id, rut, pc, oc, factura, fecha_factura, csv_row_hash, csv_file_timestamp, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `;

    const params = [
      data.customer_id,
      data.rut,
      data.pc,
      data.oc,
      data.factura,
      data.fecha_factura,
      data.csv_row_hash || null,
      data.csv_file_timestamp || null
    ];

    const [result] = await pool.query(query, params);
    
    // Retornar el ID de la orden insertada
    return result.insertId;
    
  } catch (error) {
    throw error; // Re-lanzar el error para que se maneje en el nivel superior
  }
};

/**
 * Obtiene todas las órdenes existentes con datos para comparación
 * @returns {Promise<Array<Object>>}
 */
const getAllExistingOrders = async () => {
  const pool = await poolPromise;
  const [rows] = await pool.query(`
    SELECT 
      o.pc, 
      o.oc, 
      o.factura, 
      o.fecha_factura,
      o.csv_row_hash,
      o.csv_file_timestamp,
      o.updated_at
    FROM orders o 
    WHERE o.pc IS NOT NULL AND o.oc IS NOT NULL
  `);
  return rows.map(row => ({
    key: `${row.pc}-${row.oc || ''}-${row.factura || ''}`, // Clave compuesta: pc + oc + factura
    pc: row.pc,
    oc: row.oc,
    factura: row.factura,
    fecha_factura: row.fecha_factura,
    csv_row_hash: row.csv_row_hash,
    csv_file_timestamp: row.csv_file_timestamp,
    updated_at: row.updated_at
  }));
};

/**
 * Obtiene el order_id por la clave compuesta pc + oc + factura
 * @param {string} pc - Número de PC
 * @param {string} oc - Número de OC
 * @param {string} factura - Número de factura
 * @returns {Promise<number|null>}
 */
const getOrderIdByPc = async (pc, oc, factura) => {
  const pool = await poolPromise;
  const [rows] = await pool.query('SELECT id FROM orders WHERE pc = ? AND oc = ? AND factura = ?', [pc, oc, factura]);
  return rows.length > 0 ? rows[0].id : null;
};

/**
 * Obtiene el ID de una orden solo por PC (para OrderLines)
 * @param {string} pc - Número de PC
 * @returns {Promise<number|null>} ID de la orden o null si no existe
 */
const getOrderIdByPcOnly = async (pc) => {
  const pool = await poolPromise;
  console.log(`🔍 Buscando orden con PC: "${pc}"`);
  const [rows] = await pool.query('SELECT id FROM orders WHERE pc = ?', [pc]);
  console.log(`🔍 Resultado:`, rows);
  const result = rows.length > 0 ? rows[0].id : null;
  console.log(`🔍 orderId retornado:`, result);
  return result;
};

/**
 * Actualiza una orden existente por PC
 * @param {string} pc - Número de PC
 * @param {Object} data - Datos a actualizar
 * @returns {Promise<void>}
 */
const updateOrderByPc = async (pc, data) => {
  const pool = await poolPromise;
  await pool.query(`
    UPDATE orders 
    SET 
      factura = ?, 
      fecha_factura = ?, 
      csv_row_hash = ?,
      csv_file_timestamp = ?,
      updated_at = NOW()
    WHERE pc = ?
  `, [
    data.factura, 
    data.fecha_factura, 
    data.csv_row_hash,
    data.csv_file_timestamp,
    pc
  ]);
};

/**
 * Obtiene los items de una orden específica
 * @param {number} orderPc - PC de la orden
 * @param {object} user - Usuario autenticado
 * @returns {Promise<Array|null>} Array de items o null si no autorizado
 */
const getOrderItems = async (orderPc, user) => {
  try {
    const pool = await poolPromise;
    
    // Verificar que la orden existe y el usuario tiene acceso
    let orderQuery = `
      SELECT o.id, o.pc, o.oc, c.uuid as customer_uuid
      FROM orders o
      JOIN customers c ON o.customer_id = c.id
      WHERE o.pc = ?
    `;
    
    const [orderRows] = await pool.query(orderQuery, [orderPc]);
    
    if (orderRows.length === 0) {
      return null; // Orden no encontrada
    }
    
    const order = orderRows[0];
    
    // Si es cliente, verificar que la orden pertenece a él
    if (user.role === 'client' && user.uuid !== order.customer_uuid) {
      return null; // No autorizado
    }
    
    // Obtener los items de la orden con la moneda
    const itemsQuery = `
      SELECT 
        oi.id,
        oi.order_id,
        oi.item_id,
        oi.kg_solicitados,
        oi.unit_price,
        oi.volumen,
        oi.tipo,
        oi.mercado,
        oi.kg_despachados,
        oi.kg_facturados,
        i.item_code,
        i.item_name,
        i.unidad_medida,
        od.currency
      FROM order_items oi
      JOIN items i ON oi.item_id = i.id
      LEFT JOIN order_detail od ON oi.order_id = od.order_id
      WHERE oi.order_id = ?
      ORDER BY oi.id
    `;
    
    const [itemRows] = await pool.query(itemsQuery, [order.id]);
    
    return itemRows.map(item => ({
      id: item.id,
      order_id: item.order_id,
      item_id: item.item_id,
      item_code: item.item_code,
      item_name: item.item_name,
      unidad_medida: item.unidad_medida,
      kg_solicitados: item.kg_solicitados,
      unit_price: item.unit_price,
      volumen: item.volumen,
      tipo: item.tipo,
      mercado: item.mercado,
      kg_despachados: item.kg_despachados,
      kg_facturados: item.kg_facturados,
      currency: item.currency
    }));
    
  } catch (error) {
    console.error('Error getting order items:', error);
    throw error;
  }
};

/**
 * Obtiene una orden por RUT y OC
 * @param {string} rut - RUT del cliente
 * @param {string} oc - OC de la orden
 * @returns {Promise<object|null>} Orden encontrada o null
 */
const getOrderByRutAndOc = async (rut, oc) => {
  try {
    const pool = await poolPromise;
    
    const query = `
      SELECT o.id, o.rut, o.oc, o.factura, o.fec_factura, o.updated_at
      FROM orders o
      WHERE o.rut = ? AND o.oc = ?
    `;
    
    const [rows] = await pool.query(query, [rut, oc]);
    
    return rows.length > 0 ? rows[0] : null;
    
  } catch (error) {
    console.error('Error getting order by RUT and OC:', error);
    throw error;
  }
};

/**
 * Actualiza el campo factura de una orden
 * @param {number} orderId - ID de la orden
 * @param {string} factura - Nuevo número de factura
 * @returns {Promise<void>}
 */
const updateOrderFactura = async (orderId, factura) => {
  try {
    const pool = await poolPromise;
    
    const query = `
      UPDATE orders 
      SET factura = ?, updated_at = NOW()
      WHERE id = ?
    `;
    
    const [result] = await pool.query(query, [factura, orderId]);
    
    if (result.affectedRows === 0) {
      throw new Error(`No se pudo actualizar la orden con ID ${orderId}`);
    }
    
    console.log(`Orden ${orderId} actualizada con factura: ${factura}`);
    
  } catch (error) {
    console.error('Error updating order factura:', error);
    throw error;
  }
};

/**
 * Obtiene una orden por ID con validación de permisos
 * @param {number} orderId - ID de la orden
 * @param {object} user - Usuario autenticado
 * @returns {Promise<object|null>} Orden encontrada o null
 */
const getOrderById = async (orderId, user) => {
  try {
    const pool = await poolPromise;
    let query = `
      SELECT o.*, c.name as customer_name, c.uuid as customer_uuid
      FROM orders o
      JOIN customers c ON o.customer_id = c.id
      WHERE o.id = ?
    `;
    let params = [orderId];

    // Si es cliente, verificar que la orden pertenezca al cliente
    if (user.role === 'client') {
      query += ' AND c.uuid = ?';
      params.push(user.uuid);
    }

    const [rows] = await pool.query(query, params);
    return rows[0] || null;
  } catch (error) {
    console.error('Error en getOrderById:', error.message);
    throw error;
  }
};

/**
 * Obtener detalles de una orden específica
 * @param {number} orderPc - PC de la orden
 * @param {object} user - Usuario autenticado
 * @returns {Promise<array|null>} Detalles de la orden o null
 */
const getOrderDetails = async (orderId, user) => {
  try {
    const pool = await poolPromise;
    let query = `
      SELECT 
        o.id,
        o.pc,
        o.oc,
        od.fecha_etd,
        od.fecha_eta,
        od.incoterm,
        od.certificados,
        od.direccion_destino,
        od.puerto_destino
      FROM orders o
      LEFT JOIN order_detail od ON o.id = od.order_id
      JOIN customers c ON o.customer_id = c.id
      WHERE o.id = ?
    `;
    let params = [orderId];

    // Si es cliente, verificar que la orden pertenezca al cliente
    if (user.role === 'client') {
      query += ' AND c.uuid = ?';
      params.push(user.uuid);
    }

    const [rows] = await pool.query(query, params);
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    console.error('Error en getOrderDetails:', error.message);
    throw error;
  }
};

/**
 * Actualiza el campo fecha_factura de una orden
 * @param {number} orderId - ID de la orden
 * @param {string} fechaFactura - Nueva fecha de factura
 * @returns {Promise<void>}
 */
const updateOrderFechaFactura = async (orderId, fechaFactura) => {
  try {
    const pool = await poolPromise;
    
    const query = `
      UPDATE orders 
      SET fec_factura = ?, updated_at = NOW()
      WHERE id = ?
    `;
    
    const [result] = await pool.query(query, [fechaFactura, orderId]);
    
    if (result.affectedRows === 0) {
      throw new Error(`No se pudo actualizar la orden con ID ${orderId}`);
    }
    
    console.log(`Orden ${orderId} actualizada con fecha de factura: ${fechaFactura}`);
    
  } catch (error) {
    console.error('Error updating order fecha_factura:', error);
    throw error;
  }
};

/**
 * Obtiene los detalles completos de una orden específica
 * @param {number} orderId - ID de la orden
 * @param {object} user - Usuario autenticado
 * @returns {Promise<object|null>} Detalles de la orden o null
 */
const getOrderDetail = async (orderId, user) => {
  try {
    const pool = await poolPromise;
    let query = `
      SELECT 
        o.id,
        o.pc,
        o.oc,
        od.fecha_etd,
        od.fecha_eta,
        od.incoterm,
        od.certificados,
        od.direccion_destino,
        od.puerto_destino
      FROM orders o
      LEFT JOIN order_detail od ON o.id = od.order_id
      JOIN customers c ON o.customer_id = c.id
      WHERE o.id = ?
    `;
    let params = [orderId];

    // Si es cliente, verificar que la orden pertenezca al cliente
    if (user.role === 'client') {
      query += ' AND c.uuid = ?';
      params.push(user.uuid);
    }

    const [rows] = await pool.query(query, params);
    return rows[0] || null;
  } catch (error) {
    console.error('Error en getOrderDetail:', error.message);
    throw error;
  }
};

module.exports = {
  getOrdersByFilters,
  getClientDashboardOrders,
  getClientOrderDocuments,
  insertOrder,
  getAllExistingOrders,
  updateOrderByPc,
  getOrderIdByPc,
  getOrderIdByPcOnly,
  getOrderItems,
  getOrderByRutAndOc,
  getOrderById,
  getOrderDetails,
  getOrderDetail,
  updateOrderFactura,
  updateOrderFechaFactura
};
