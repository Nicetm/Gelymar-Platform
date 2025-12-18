const { poolPromise } = require('../config/db');
const Order = require('../models/order.model');
const mysql = require('mysql2');

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
      od.fecha_eta,
      od.currency,
      od.medio_envio_factura,
      od.medio_envio_ov,
      od.incoterm,
      od.puerto_destino,
      od.certificados,
      od.estado_ov,
      COALESCE(doc_counts.document_count, 0) AS document_count
    FROM orders o
    JOIN customers c ON o.customer_id = c.id
    LEFT JOIN order_detail od ON o.id = od.order_id
    LEFT JOIN sellers s ON s.codigo = od.vendedor
    LEFT JOIN (
      SELECT order_id, COUNT(*) AS document_count
      FROM order_files
      GROUP BY order_id
    ) doc_counts ON o.id = doc_counts.order_id`;

  const params = [];
  const conditions = [];

  if (filters.customerUUID) {
    conditions.push('c.uuid = ?');
    params.push(filters.customerUUID);
  }

  if (filters.salesRut) {
    conditions.push('s.rut = ?');
    params.push(filters.salesRut);
  }

  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(' AND ')}`;
  }

  query += ' ORDER BY o.fecha_factura DESC';

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
      fecha_eta: r.fecha_eta,
      currency: r.currency,
      medio_envio_factura: r.medio_envio_factura,
      medio_envio_ov: r.medio_envio_ov,
      incoterm: r.incoterm,
      puerto_destino: r.puerto_destino,
      certificados: r.certificados,
      estado_ov: r.estado_ov,
      document_count: r.document_count
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
    LEFT JOIN order_files f ON f.order_id = o.id
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
      ofi.id,
      ofi.name AS filename,
      ofi.path AS filepath,
      ofi.file_type AS filetype,
      ofi.created_at,
      ofi.updated_at,
      o.factura,
      o.fecha_factura,
      os.name AS status
    FROM order_files ofi
    JOIN order_status os ON ofi.status_id = os.id
    JOIN orders o ON ofi.order_id = o.id
    WHERE ofi.order_id = ? AND ofi.is_visible_to_client = 1
    ORDER BY ofi.created_at DESC;
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
        customer_id, rut, pc, oc, factura, fecha_factura, fecha_ingreso, linea, unique_key, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `;

    const params = [
      data.customer_id,
      data.rut,
      data.pc,
      data.oc,
      data.factura,
      data.fecha_factura,
      data.fecha_ingreso,
      data.linea,
      data.unique_key
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
const getOrderItems = async (orderPc, orderOc, factura, user) => {
  try {
    const pool = await poolPromise;
    
        // Verificar que la orden existe y el usuario tiene acceso
    const roleId = Number(user.roleId || user.role_id);

    let orderQuery = `
      SELECT o.id, o.pc, o.oc, o.factura, c.uuid as customer_uuid
      FROM orders o
      JOIN customers c ON o.customer_id = c.id
      LEFT JOIN order_detail od ON o.id = od.order_id
      LEFT JOIN sellers s ON s.codigo = od.vendedor
      WHERE o.pc = ? AND o.oc = ? AND (o.factura = ? OR (o.factura IS NULL AND ? = 'null'))
    `;

    const orderParams = [orderPc, orderOc, factura, factura];

    if (roleId === 3) {
      orderQuery += ' AND s.rut = ?';
      orderParams.push(user.email);
    }

    const [orderRows] = await pool.query(orderQuery, orderParams);

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
        oi.descripcion,
        oi.kg_solicitados,
        oi.unit_price,
        oi.volumen,
        oi.tipo,
        oi.mercado,
        oi.kg_despachados,
        oi.kg_facturados,
        oi.fecha_etd,
        oi.fecha_eta,
        i.item_code,
        i.item_name,
        i.unidad_medida
      FROM order_items oi
      JOIN items i ON oi.item_id = i.id
      JOIN orders o ON oi.order_id = o.id
      WHERE oi.pc = ? AND o.oc = ? AND (oi.factura = ? OR (oi.factura IS NULL AND ? is null))
      ORDER BY oi.id
    `;
    
    // Obtener currency, gasto adicional y customer_name por separado para evitar duplicados
    const currencyQuery = `
      SELECT od.currency, od.gasto_adicional_flete, c.name as customer_name 
      FROM order_detail od
      JOIN orders o ON od.order_id = o.id
      JOIN customers c ON o.customer_id = c.id
      WHERE od.order_id = ? LIMIT 1
    `;
    
    const [itemRows] = await pool.query(itemsQuery, [orderPc, orderOc, factura, factura]);
    const [currencyRows] = await pool.query(currencyQuery, [order.id]);
    const currency = currencyRows[0]?.currency || 'CLP';
    const gastoAdicional = currencyRows[0]?.gasto_adicional_flete || 0;
    const customerName = currencyRows[0]?.customer_name || 'N/A';
    
    return itemRows.map(item => ({
      id: item.id,
      order_id: item.order_id,
      item_id: item.item_id,
      descripcion: item.descripcion,
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
      fecha_etd: item.fecha_etd,
      fecha_eta: item.fecha_eta,
      currency: currency,
      gasto_adicional_flete: gastoAdicional,
      customer_name: customerName
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
 * Obtiene una orden por ID simple (sin validación de permisos)
 * @param {number} orderId - ID de la orden
 * @returns {Promise<object|null>} Orden encontrada o null
 */
const getOrderByIdSimple = async (orderId) => {
  try {
    const pool = await poolPromise;
    const [[order]] = await pool.query(
      `
        SELECT 
          o.*,
          c.name AS customer_name,
          od.fecha_etd AS fecha_etd,
          od.fecha AS fecha_detalle
        FROM orders o
        JOIN customers c ON o.customer_id = c.id
        LEFT JOIN (
          SELECT 
            order_id,
            MAX(fecha_etd) AS fecha_etd,
            MAX(fecha) AS fecha
          FROM order_detail
          GROUP BY order_id
        ) od ON od.order_id = o.id
        WHERE o.id = ?
      `,
      [orderId]
    );
    return order || null;
  } catch (error) {
    console.error('Error en getOrderByIdSimple:', error.message);
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
      SELECT 
        o.*,
        c.name AS customer_name,
        c.uuid AS customer_uuid,
        od.fecha_etd AS fecha_etd,
        od.fecha AS fecha_detalle
      FROM orders o
      JOIN customers c ON o.customer_id = c.id
      LEFT JOIN (
        SELECT 
          order_id,
          MAX(fecha_etd) AS fecha_etd,
          MAX(fecha) AS fecha
        FROM order_detail
        GROUP BY order_id
      ) od ON od.order_id = o.id
      WHERE o.id = ?
    `;
    let params = [orderId];

    // Si es cliente, verificar que la orden pertenezca al cliente
    if (user.role === 'client') {
      query += ' AND c.uuid = ?';
      params.push(user.uuid);
    }

    const roleId = Number(user.roleId || user.role_id);
    if (roleId === 3) {
      query += ` AND EXISTS (
        SELECT 1 FROM order_detail od
        JOIN sellers s ON s.codigo = od.vendedor
        WHERE od.order_id = o.id AND s.rut = ?
      )`;
      params.push(user.email);
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

    const roleId = Number(user.roleId || user.role_id);
    if (roleId === 3) {
      query += ` AND EXISTS (
        SELECT 1 FROM order_detail od2
        JOIN sellers s ON s.codigo = od2.vendedor
        WHERE od2.order_id = o.id AND s.rut = ?
      )`;
      params.push(user.email);
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

    const roleId = Number(user.roleId || user.role_id);
    if (roleId === 3) {
      query += ` AND EXISTS (
        SELECT 1 FROM order_detail od2
        JOIN sellers s ON s.codigo = od2.vendedor
        WHERE od2.order_id = o.id AND s.rut = ?
      )`;
      params.push(user.email);
    }

    const [rows] = await pool.query(query, params);
    return rows[0] || null;
  } catch (error) {
    console.error('Error en getOrderDetail:', error.message);
    throw error;
  }
};

/**
 * Obtiene los items de una orden sin factura
 * @param {string} orderPc - PC de la orden
 * @param {object} user - Usuario autenticado
 * @returns {Promise<Array|null>} Items de la orden o null si no se encuentra
 */
const getOrderItemsWithoutFactura = async (orderPc, orderOc, user) => {
  try {
    const pool = await poolPromise;
    
    // Verificar que la orden existe y el usuario tiene acceso
    const roleId = Number(user.roleId || user.role_id);

    let orderQuery = `
      SELECT o.id, o.pc, o.oc, o.factura, c.uuid as customer_uuid
      FROM orders o
      JOIN customers c ON o.customer_id = c.id
      LEFT JOIN order_detail od ON o.id = od.order_id
      LEFT JOIN sellers s ON s.codigo = od.vendedor
      WHERE o.pc = ? AND o.oc = ? AND o.factura IS NULL
    `;

    const orderParams = [orderPc, orderOc];

    if (roleId === 3) {
      orderQuery += ' AND s.rut = ?';
      orderParams.push(user.email);
    }

    const [orderRows] = await pool.query(orderQuery, orderParams);
    
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
        oi.descripcion,
        oi.kg_solicitados,
        oi.unit_price,
        oi.volumen,
        oi.tipo,
        oi.mercado,
        oi.kg_despachados,
        oi.kg_facturados,
        oi.fecha_etd,
        oi.fecha_eta,
        i.item_code,
        i.item_name,
        i.unidad_medida
      FROM order_items oi
      JOIN items i ON oi.item_id = i.id
      JOIN orders o ON oi.order_id = o.id
      WHERE oi.pc = ? AND o.oc = ? AND oi.factura = ''
      ORDER BY oi.id
    `;
    
    // Obtener currency, gasto adicional y customer_name por separado para evitar duplicados
    const currencyQuery = `
      SELECT od.currency, od.gasto_adicional_flete, c.name as customer_name 
      FROM order_detail od
      JOIN orders o ON od.order_id = o.id
      JOIN customers c ON o.customer_id = c.id
      WHERE od.order_id = ? LIMIT 1
    `;
    
    const [itemRows] = await pool.query(itemsQuery, [orderPc, orderOc]);
    const [currencyRows] = await pool.query(currencyQuery, [order.id]);
    const currency = currencyRows[0]?.currency || 'CLP';
    const gastoAdicional = currencyRows[0]?.gasto_adicional_flete || 0;
    const customerName = currencyRows[0]?.customer_name || 'N/A';
    
    return itemRows.map(item => ({
      id: item.id,
      order_id: item.order_id,
      item_id: item.item_id,
      descripcion: item.descripcion,
      kg_solicitados: item.kg_solicitados,
      unit_price: item.unit_price,
      volumen: item.volumen,
      tipo: item.tipo,
      mercado: item.mercado,
      kg_despachados: item.kg_despachados,
      kg_facturados: item.kg_facturados,
      fecha_etd: item.fecha_etd,
      fecha_eta: item.fecha_eta,
      item_code: item.item_code,
      item_name: item.item_name,
      unidad_medida: item.unidad_medida,
      currency: currency,
      gasto_adicional_flete: gastoAdicional,
      customer_name: customerName
    }));
    
  } catch (error) {
    console.error('Error getting order items without factura:', error);
    throw error;
  }
};

/**
 * Obtiene las órdenes que cumplen con la condición de alerta por falta de documentos.
 * @param {Object} options
 * @param {string} options.fechaAlerta - Fecha mínima de ingreso de la orden (formato YYYY-MM-DD).
 * @param {number} [options.minDocuments=5] - Cantidad mínima de documentos requeridos.
 * @returns {Promise<Array>}
 */
const getOrdersMissingDocumentsAlert = async ({ fechaAlerta, minDocuments = 5 }) => {
  try {
    const pool = await poolPromise;
    const sanitizedFecha = fechaAlerta || '1970-01-01';

    const query = `
        SELECT 
          o.id,
          o.pc,
          o.oc,
          c.name AS customer_name,
          c.uuid AS customer_uuid,
          od.fecha,
          od.fecha_etd,
          COALESCE(doc_counts.document_count, 0) AS document_count
        FROM orders o
        JOIN customers c ON o.customer_id = c.id
        LEFT JOIN order_detail od ON o.id = od.order_id
        LEFT JOIN (
          SELECT order_id, COUNT(*) AS document_count
          FROM order_files
          GROUP BY order_id
        ) doc_counts ON o.id = doc_counts.order_id
        WHERE DATE(COALESCE(od.fecha, o.fecha_factura, o.created_at)) >= ?
          AND od.fecha_etd IS NOT NULL
          AND DATE_ADD(DATE(od.fecha_etd), INTERVAL 5 DAY) <= CURDATE()
          AND COALESCE(doc_counts.document_count, 0) < ?
        ORDER BY od.fecha_etd ASC, o.pc ASC
      `;

    const [rows] = await pool.query(query, [sanitizedFecha, minDocuments]);

    return rows.map(row => ({
      id: row.id,
      pc: row.pc,
      oc: row.oc,
      customer_name: row.customer_name,
      customer_uuid: row.customer_uuid,
      fecha: row.fecha,
      fecha_etd: row.fecha_etd,
      document_count: row.document_count
    }));
  } catch (error) {
    console.error('Error en getOrdersMissingDocumentsAlert:', error.message);
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
  getOrderItemsWithoutFactura,
  getOrderByRutAndOc,
  getOrderById,
  getOrderByIdSimple,
  getOrderDetails,
  getOrderDetail,
  getOrdersMissingDocumentsAlert
};
