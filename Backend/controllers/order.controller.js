const { container } = require('../config/container');
const { logger } = require('../utils/logger');
const { t } = require('../i18n');
const orderService = container.resolve('orderService');

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
    const roleId = Number(req.user.roleId || req.user.role_id);

    // Si es cliente, se filtra automáticamente por UUID
    if (req.user.role === 'client') {
      filters.customerRut = req.user.rut;
    }

    // Si es vendedor, filtrar por su propio RUT (email)
    if (roleId === 3) {
      filters.salesRut = req.user.rut || req.user.email;
    }

    const data = await orderService.getOrdersByFilters(filters);

    res.json(data);
  } catch (err) {
    logger.error(`[getAllOrders] Error: ${err.message}`);
    res.status(500).json({ message: t('order.get_orders_error', req.lang || 'es') });
  }
};

/**
 * POST /api/orders/search
 * Devuelve órdenes según filtros entregados
 */
exports.searchOrders = async (req, res) => {
  try {
    const filters = req.body || {};
    const roleId = Number(req.user.roleId || req.user.role_id);

    // Si es cliente, forzamos el filtro por su UUID
    if (req.user.role === 'client') {
      filters.customerRut = req.user.rut;
    }

    if (roleId === 3) {
      filters.salesRut = req.user.rut || req.user.email;
    }

    const data = await orderService.getOrdersByFilters(filters);

    res.json(data);
  } catch (err) {
    logger.error(`[searchOrders] Error: ${err.message}`);
    res.status(500).json({ message: t('order.search_orders_error', req.lang || 'es') });
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
      return res.status(404).json({ message: t('order.order_not_found', req.lang || 'es') });
    }

    res.json(order);
  } catch (err) {
    logger.error(`[getOrderById] Error: ${err.message}`);
    res.status(500).json({ message: t('order.get_order_error', req.lang || 'es') });
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
      return res.status(404).json({ message: t('order.order_not_found', req.lang || 'es') });
    }

    res.json(details);
  } catch (err) {
    logger.error(`[getOrderDetails] Error: ${err.message}`);
    res.status(500).json({ message: t('order.get_order_details_error', req.lang || 'es') });
  }
};

/**
 * GET /api/orders/client/dashboard
 * Devuelve órdenes formateadas específicamente para el dashboard del cliente
 * Solo accesible por clientes, automáticamente filtra por su UUID
 */
exports.getClientDashboardOrders = async (req, res) => {
  try {
    // Solo clientes pueden acceder a este endpoint
    if (req.user.role !== 'client') {
      return res.status(403).json({ 
        message: t('errors.access_denied', req.lang || 'es'),
        userRole: req.user.role,
        expectedRole: 'client'
      });
    }

    // Obtener órdenes del cliente autenticado
    const orders = await orderService.getClientDashboardOrders(req.user.rut);

    res.json(orders);
  } catch (err) {
    logger.error(`[getClientDashboardOrders] Error: ${err.message}`);
    res.status(500).json({ message: t('order.get_dashboard_orders_error', req.lang || 'es') });
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
        message: t('errors.access_denied', req.lang || 'es'),
        userRole: req.user.role,
        expectedRole: 'client'
      });
    }

    // Obtener documentos de la orden del cliente
    const documents = await orderService.getClientOrderDocuments(orderId, req.user.rut);

    if (!documents) {
      return res.status(404).json({ message: t('order.order_not_found_or_unauthorized', req.lang || 'es') });
    }

    res.json(documents);
  } catch (err) {
    logger.error(`[getClientOrderDocuments] Error: ${err.message}`);
    res.status(500).json({ message: t('order.get_order_documents_error', req.lang || 'es') });
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
    const idNroOvMasFactura = req.query.idov || req.query.idNroOvMasFactura || null;

    // Obtener items de la orden
    const items = await orderService.getOrderItems(orderPc, orderOc, factura, req.user, idNroOvMasFactura);

    if (!items) {
      logger.warn(`[getOrderItems] Orden no encontrada pc=${orderPc || 'N/A'} oc=${orderOc || 'N/A'} factura=${factura || 'N/A'}`);
      return res.status(404).json({ message: t('order.order_not_found_or_unauthorized', req.lang || 'es') });
    }

    res.json(items);
  } catch (err) {
    logger.error(`[getOrderItems] Error: ${err.message}`);
    res.status(500).json({ message: t('order.get_order_items_error', req.lang || 'es') });
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
      logger.warn(`[getOrderItemsWithoutFactura] Orden no encontrada pc=${orderPc || 'N/A'} oc=${orderOc || 'N/A'}`);
      return res.status(404).json({ message: t('order.order_not_found_or_unauthorized', req.lang || 'es') });
    }

    res.json(items);
  } catch (err) {
    logger.error(`[getOrderItemsWithoutFactura] Error: ${err.message}`);
    res.status(500).json({ message: t('order.get_order_items_error', req.lang || 'es') });
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
      return res.status(404).json({ message: t('order.order_not_found_or_unauthorized', req.lang || 'es') });
    }

    res.json(orderDetail);
  } catch (err) {
    logger.error(`[getOrderDetail] Error: ${err.message}`);
    res.status(500).json({ message: t('order.get_order_detail_error', req.lang || 'es') });
  }
};

/**
 * GET /api/orders/pc/:pc
 * Devuelve una orden por PC (admin)
 */
exports.getOrderByPc = async (req, res) => {
  try {
    const { pc } = req.params;
    const order = await orderService.getOrderByPc(pc);

    if (!order) {
      return res.status(404).json({ message: t('order.order_not_found', req.lang || 'es') });
    }

    res.json(order);
  } catch (err) {
    logger.error(`[getOrderByPc] Error: ${err.message}`);
    res.status(500).json({ message: t('order.get_order_error', req.lang || 'es') });
  }
};

/**
 * GET /api/orders/admin/dashboard/sales
 * Devuelve metricas de ventas para el dashboard admin
 */
exports.getAdminSalesDashboard = async (req, res) => {
  try {
    const { start, end, metric } = req.query;
    const data = await orderService.getSalesDashboardData({
      startDate: start,
      endDate: end,
      metricType: metric
    });
    res.json(data);
  } catch (err) {
    logger.error(`[getAdminSalesDashboard] Error: ${err.message}`);
    res.status(500).json({ message: t('order.get_dashboard_metrics_error', req.lang || 'es') });
  }
};

/**
 * GET /api/orders/admin/price-analysis
 * Devuelve datos de analisis de precios (solo Carla)
 */
exports.getAdminPriceAnalysis = async (req, res) => {
  try {
    const { start, end, productId, customerId, market, currency } = req.query;
    const data = await orderService.getPriceAnalysisData({
      startDate: start,
      endDate: end,
      productId,
      customerId,
      market,
      currency
    });
    res.json(data);
  } catch (err) {
    logger.error(`[getAdminPriceAnalysis] Error: ${err.message}`);
    res.status(500).json({ message: t('order.get_price_analysis_error', req.lang || 'es') });
  }
};

