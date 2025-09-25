const orderService = require('../services/order.service');

/**
 * GET /api/orders
 * Lista todas las órdenes, filtradas por campos opcionales:
 * - Cliente: solo puede ver sus órdenes
 * - Admin: puede ver todas
 * - Soporta filtros por: nombre orden, cliente, fecha ingreso, ETD, ETA, estado
 */
exports.getAllOrders = async (req, res) => {
  try {
    const filters = {};

    // Si es cliente, se filtra automáticamente por UUID
    if (req.user.role === 'client') {
      filters.customerUUID = req.user.uuid; // o req.user.customer_uuid
    }

    const data = await orderService.getOrdersByFilters(filters);

    res.json(data);
  } catch (err) {
    console.error('[getAllOrders] Error:', err.message);
    res.status(500).json({ message: 'Error al obtener órdenes' });
  }
};

/**
 * POST /api/orders/search
 * Devuelve órdenes según filtros entregados
 */
exports.searchOrders = async (req, res) => {
  try {
    const filters = req.body || {};

    // Si es cliente, forzamos el filtro por su UUID
    if (req.user.role === 'client') {
      filters.customerUUID = req.user.uuid;
    }

    const data = await orderService.getOrdersByFilters(filters);

    res.json(data);
  } catch (err) {
    console.error('[searchOrders] Error:', err.message);
    res.status(500).json({ message: 'Error interno al buscar órdenes' });
  }
};

/**
 * GET /api/orders/:id
 * Devuelve una orden específica
 */
exports.getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await orderService.getOrderById(id, req.user);
    
    if (!order) {
      return res.status(404).json({ message: 'Orden no encontrada' });
    }

    res.json(order);
  } catch (err) {
    console.error('[getOrderById] Error:', err.message);
    res.status(500).json({ message: 'Error al obtener orden' });
  }
};

/**
 * GET /api/orders/:id/details
 * Devuelve el detalle de una orden específica
 */
exports.getOrderDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const details = await orderService.getOrderDetails(id, req.user);
    
    if (!details) {
      return res.status(404).json({ message: 'Orden no encontrada' });
    }

    res.json(details);
  } catch (err) {
    console.error('[getOrderDetails] Error:', err.message);
    res.status(500).json({ message: 'Error al obtener detalles de orden' });
  }
};



/**
 * GET /api/orders/client/dashboard
 * Devuelve órdenes formateadas específicamente para el dashboard del cliente
 * Solo accesible por clientes, automáticamente filtra por su UUID
 */
exports.getClientDashboardOrders = async (req, res) => {
  try {
    console.log('🔍 [Controller] req.user:', req.user);
    console.log('🔍 [Controller] req.user.uuid:', req.user.uuid);
    
    // Solo clientes pueden acceder a este endpoint
    if (req.user.role !== 'client') {
      return res.status(403).json({ 
        message: 'Acceso no autorizado',
        userRole: req.user.role,
        expectedRole: 'client'
      });
    }

    // Obtener órdenes del cliente autenticado
    const orders = await orderService.getClientDashboardOrders(req.user.uuid);
    console.log('🔍 [Controller] orders found:', orders.length);

    res.json(orders);
  } catch (err) {
    console.error('[getClientDashboardOrders] Error:', err.message);
    res.status(500).json({ message: 'Error al obtener órdenes del dashboard' });
  }
};

/**
 * GET /api/orders/client/:orderId/documents
 * Devuelve documentos de una orden específica del cliente
 * Solo accesible por clientes, verifica que la orden pertenezca al cliente
 */
exports.getClientOrderDocuments = async (req, res) => {
  try {
    const { orderId } = req.params;

    // Solo clientes pueden acceder a este endpoint
    if (req.user.role !== 'client') {
      return res.status(403).json({ 
        message: 'Acceso no autorizado',
        userRole: req.user.role,
        expectedRole: 'client'
      });
    }

    // Obtener documentos de la orden del cliente
    const documents = await orderService.getClientOrderDocuments(orderId, req.user.uuid);

    if (!documents) {
      return res.status(404).json({ message: 'Orden no encontrada o no autorizada' });
    }

    res.json(documents);
  } catch (err) {
    console.error('[getClientOrderDocuments] Error:', err.message);
    res.status(500).json({ message: 'Error al obtener documentos de la orden' });
  }
};

/**
 * GET /api/orders/:orderPc/items
 * Devuelve los items de una orden específica
 * Accesible por admin y clientes (clientes solo pueden ver sus propias órdenes)
 */
exports.getOrderItems = async (req, res) => {
  try {
    const { orderPc, orderOc, factura } = req.params;

    // Obtener items de la orden
    const items = await orderService.getOrderItems(orderPc, orderOc, factura, req.user);

    if (!items) {
      return res.status(404).json({ message: 'Orden no encontrada o no autorizada' });
    }

    res.json(items);
  } catch (err) {
    console.error('[getOrderItems] Error:', err.message);
    res.status(500).json({ message: 'Error al obtener items de la orden' });
  }
};

/**
 * GET /api/orders/:orderPc/items
 * Obtiene los items de una orden sin factura
 * Accesible por admin y clientes (clientes solo pueden ver sus propias órdenes)
 */
exports.getOrderItemsWithoutFactura = async (req, res) => {
  try {
    const { orderPc, orderOc } = req.params;

    // Obtener items de la orden sin factura
    const items = await orderService.getOrderItemsWithoutFactura(orderPc, orderOc, req.user);

    if (!items) {
      return res.status(404).json({ message: 'Orden no encontrada o no autorizada' });
    }

    res.json(items);
  } catch (err) {
    console.error('[getOrderItemsWithoutFactura] Error:', err.message);
    res.status(500).json({ message: 'Error al obtener items de la orden' });
  }
};

/**
 * GET /api/orders/:orderId/detail
 * Devuelve los detalles completos de una orden específica
 * Accesible por admin y clientes (clientes solo pueden ver sus propias órdenes)
 */
exports.getOrderDetail = async (req, res) => {
  try {
    const { orderId } = req.params;

    // Obtener detalles de la orden
    const orderDetail = await orderService.getOrderDetails(orderId, req.user);

    if (!orderDetail) {
      return res.status(404).json({ message: 'Orden no encontrada o no autorizada' });
    }

    res.json(orderDetail);
  } catch (err) {
    console.error('[getOrderDetail] Error:', err.message);
    res.status(500).json({ message: 'Error al obtener detalles de la orden' });
  }
};
