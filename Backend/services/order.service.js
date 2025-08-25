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
      COUNT(f.id) AS files_count,
      o.fecha_cliente,
      o.currency,
      o.medio_envio,
      o.factura,
      o.fecha_factura
    FROM orders o
    JOIN customers c ON o.rut = c.rut
    LEFT JOIN files f ON f.pc = o.pc
    WHERE 1 = 1
  `;

  const params = [];

  if (filters.orderName) {
    query += ` AND o.pc LIKE ?`;
    params.push(`%${filters.orderName.trim()}%`);
  }

  if (filters.customerName) {
    query += ` AND c.name LIKE ?`;
    params.push(`%${filters.customerName.trim()}%`);
  }

  if (filters.customerUUID) {
    query += ` AND c.uuid = ?`;
    params.push(filters.customerUUID);
  }

  if (filters.fechaIngreso && /^\d{4}-\d{2}-\d{2}$/.test(filters.fechaIngreso)) {
    query += ` AND DATE(o.created_at) = ?`;
    params.push(filters.fechaIngreso);
  }



  if (filters.estado && filters.estado !== 'Todos' && filters.estado !== '') {
    const estadoMap = {
      'pendiente': 1,
      'enviado': 2,
      'completado': 3
    };
    const estadoId = estadoMap[filters.estado];
    if (estadoId) {
      query += ` AND f.status_id = ?`;
      params.push(estadoId);
    }
  }

  query += ` GROUP BY o.id, o.pc, o.rut, o.oc, o.created_at, o.updated_at, c.name, c.uuid, o.fecha_cliente, o.currency, o.medio_envio, o.factura, o.fecha_factura`;

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
      files_count: r.files_count,
      fecha_cliente: r.fecha_cliente,
      currency: r.currency,
      medio_envio: r.medio_envio,
      factura: r.factura,
      fecha_factura: r.fecha_factura
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
        customer_id, rut, pc, oc, factura, fec_factura, name, path, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `;

    const params = [
      data.customer_id,
      data.rut,
      data.pc,
      data.oc,
      data.factura,
      data.fec_factura,
      data.name,
      data.path || ''
    ];

    console.log(`Ejecutando INSERT en MySQL:`);
    console.log(`   Query: ${query}`);
    console.log(`   Params: [${params.map(p => `"${p}"`).join(', ')}]`);

    const [result] = await pool.query(query, params);
    
    console.log(`INSERT exitoso - ID insertado: ${result.insertId}`);
    
  } catch (error) {
    console.error(`Error en INSERT MySQL:`);
    console.error(`   Error: ${error.message}`);
    console.error(`   SQL State: ${error.sqlState}`);
    console.error(`   Error Code: ${error.errno}`);
    throw error; // Re-lanzar el error para que se maneje en el nivel superior
  }
};

/**
 * Obtiene todas las órdenes existentes por PC y OC
 * @returns {Promise<Array<string>>}
 */
const getAllExistingOrders = async () => {
  const pool = await poolPromise;
  const [rows] = await pool.query('SELECT pc, oc FROM orders WHERE pc IS NOT NULL AND oc IS NOT NULL');
  return rows.map(row => `${row.pc}-${row.oc}`);
};

/**
 * Obtiene el order_id por el campo pc
 * @param {string} pc - Número de PC
 * @returns {Promise<number|null>}
 */
const getOrderIdByPc = async (pc) => {
  const pool = await poolPromise;
  const [rows] = await pool.query('SELECT id FROM orders WHERE pc = ?', [pc]);
  return rows.length > 0 ? rows[0].id : null;
};

/**
 * Obtiene los items de una orden específica
 * @param {number} orderId - ID de la orden
 * @param {object} user - Usuario autenticado
 * @returns {Promise<Array|null>} Array de items o null si no autorizado
 */
const getOrderItems = async (orderId, user) => {
  try {
    const pool = await poolPromise;
    
    // Verificar que la orden existe y el usuario tiene acceso
    let orderQuery = `
      SELECT o.id, o.pc, o.oc, c.uuid as customer_uuid
      FROM orders o
      JOIN customers c ON o.customer_id = c.id
      WHERE o.id = ?
    `;
    
    const [orderRows] = await pool.query(orderQuery, [orderId]);
    
    if (orderRows.length === 0) {
      return null; // Orden no encontrada
    }
    
    const order = orderRows[0];
    
    // Si es cliente, verificar que la orden pertenece a él
    if (user.role === 'client' && user.uuid !== order.customer_uuid) {
      return null; // No autorizado
    }
    
    // Obtener los items de la orden
    const itemsQuery = `
      SELECT 
        oi.id,
        oi.order_id,
        oi.item_id,
        oi.kg_solicitados,
        oi.unit_price,
        oi.volumen,
        i.item_code,
        i.item_name,
        i.unidad_medida
      FROM order_items oi
      JOIN items i ON oi.item_id = i.id
      WHERE oi.order_id = ?
      ORDER BY oi.id
    `;
    
    const [itemRows] = await pool.query(itemsQuery, [orderId]);
    
    return itemRows.map(item => ({
      id: item.id,
      order_id: item.order_id,
      item_id: item.item_id,
      item_code: item.item_code,
      item_name: item.item_name,
      unidad_medida: item.unidad_medida,
      kg_solicitados: item.kg_solicitados,
      unit_price: item.unit_price,
      volumen: item.volumen
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
 * Obtiene una orden por ID
 * @param {number} orderId - ID de la orden
 * @returns {Promise<object|null>} Orden encontrada o null
 */
const getOrderById = async (orderId) => {
  try {
    const pool = await poolPromise;
    
    const query = `
      SELECT o.id, o.rut, o.oc, o.factura, o.fec_factura, o.updated_at
      FROM orders o
      WHERE o.id = ?
    `;
    
    const [rows] = await pool.query(query, [orderId]);
    
    return rows.length > 0 ? rows[0] : null;
    
  } catch (error) {
    console.error('Error getting order by ID:', error);
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

module.exports = {
  getOrdersByFilters,
  getClientDashboardOrders,
  getClientOrderDocuments,
  insertOrder,
  getAllExistingOrders,
  getOrderIdByPc,
  getOrderItems,
  getOrderByRutAndOc,
  getOrderById,
  updateOrderFactura,
  updateOrderFechaFactura
};
