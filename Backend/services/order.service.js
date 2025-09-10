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
    SELECT DISTINCT
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
    LEFT JOIN order_detail od ON o.id = od.order_id
    ORDER BY o.fecha_factura DESC`;

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
    o.pc,
    o.oc AS orderNumber,
    c.name AS clientName,
    o.factura,
    o.fecha_factura,
    COUNT(DISTINCT CASE WHEN f.is_visible_to_client = 1 THEN f.id END) AS documents,
    COALESCE(oi_counts.items_count, 0) AS items_count
    FROM orders o
    JOIN customers c ON o.customer_id = c.id
    LEFT JOIN files f ON f.order_id = o.id
    LEFT JOIN (
        SELECT factura, COUNT(*) AS items_count
        FROM order_items
        GROUP BY factura
    ) oi_counts ON oi_counts.factura = o.factura
    WHERE c.uuid = ?
    GROUP BY o.id, o.pc, o.oc, c.name, o.factura, o.fecha_factura, oi_counts.items_count
    ORDER BY o.fecha_factura DESC;
  `;
  
  const [rows] = await pool.query(query, [customerUUID]);

  return rows.map(row => ({
    id: row.id,
    pc: row.pc,
    orderNumber: row.orderNumber,
    clientName: row.clientName,
    factura: row.factura,
    fecha_factura: row.fecha_factura,
    documents: row.documents,
    items_count: row.items_count
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
      o.factura,
      o.fecha_factura,
      s.name AS status
    FROM files f
    LEFT JOIN order_status s ON f.status_id = s.id
    LEFT JOIN orders o ON f.order_id = o.id
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
      factura: doc.factura,
      fecha_factura: doc.fecha_factura,
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
 * Obtiene el order_id por la clave compuesta pc + oc
 * @param {string} pc - Número de PC
 * @param {string} oc - Número de OC
 * @returns {Promise<number|null>}
 */
const getOrderIdByPc = async (pc, oc) => {
  const pool = await poolPromise;
  const [rows] = await pool.query('SELECT id FROM orders WHERE pc = ? AND oc = ?', [pc, oc]);
  return rows.length > 0 ? rows[0].id : null;
};

/**
 * Obtiene el ID de una orden solo por PC (para OrderLines)
 * @param {string} pc - Número de PC
 * @returns {Promise<number|null>} ID de la orden o null si no existe
 */
const getOrderIdByPcOnly = async (pc) => {
  const pool = await poolPromise;
  const [rows] = await pool.query('SELECT id FROM orders WHERE pc = ?', [pc]);
  const result = rows.length > 0 ? rows[0].id : null;
  return result;
};



/**
 * Obtiene los items de una orden específica
 * @param {number} orderPc - PC de la orden
 * @param {object} user - Usuario autenticado
 * @returns {Promise<Array|null>} Array de items o null si no autorizado
 */
const getOrderItems = async (orderPc, factura, user) => {
  try {
    const pool = await poolPromise;
    
        // Verificar que la orden existe y el usuario tiene acceso
    let orderQuery = `
      SELECT o.id, o.pc, o.oc, o.factura, c.uuid as customer_uuid
      FROM orders o
      JOIN customers c ON o.customer_id = c.id
      WHERE o.pc = ? AND (o.factura = ? OR (o.factura IS NULL AND ? IS NULL))
    `;
    console.log('orderPc', orderPc, 'factura', factura);
    
    const [orderRows] = await pool.query(orderQuery, [orderPc, factura, factura]);
    
    if (orderRows.length === 0) {
      return null; // Orden no encontrada
    }
    
    const order = orderRows[0];
    
    // Si es cliente, verificar que la orden pertenece a él
    if (user.role === 'client' && user.uuid !== order.customer_uuid) {
      return null; // No autorizado
    }
    
    // Obtener los items de la orden sin duplicados
    const itemsQuery = `
      SELECT DISTINCT
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
        i.unidad_medida
      FROM order_items oi
      JOIN items i ON oi.item_id = i.id
      WHERE oi.pc = ? AND (oi.factura = ? OR (oi.factura IS NULL AND ? IS NULL))
      ORDER BY oi.id
    `;
    
    // Obtener currency por separado para evitar duplicados
    const currencyQuery = `
      SELECT currency FROM order_detail WHERE order_id = ? LIMIT 1
    `;
    
    const [itemRows] = await pool.query(itemsQuery, [orderPc, factura, factura]);
    const [currencyRows] = await pool.query(currencyQuery, [order.id]);
    const currency = currencyRows[0]?.currency || 'CLP';
    
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
      currency: currency
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
  getOrderIdByPc,
  getOrderIdByPcOnly,
  getOrderItems,
  getOrderByRutAndOc,
  getOrderById,
  getOrderDetails,
  getOrderDetail
};
