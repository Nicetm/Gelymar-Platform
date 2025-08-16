const orderService = require('../services/order.service');
const orderDetails = require('../dummy/orderDetails.json');

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
    if (req.user.role === 'cliente') {
      filters.customerUUID = req.user.uuid; // o req.user.customer_uuid
    }

    const data = await orderService.getOrdersByFilters(filters);
    console.log(data);
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
    if (req.user.role === 'cliente') {
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
exports.getOrderById = (req, res) => {
  const order = orders.find(o => o.DocEntry == req.params.id);
  if (!order) return res.status(404).json({ message: 'Orden no encontrada' });

  if (req.user.role === 'cliente' && req.user.cardCode !== order.CardCode) {
    return res.status(403).json({ message: 'No autorizado para ver esta orden' });
  }

  res.json(order);
};

/**
 * GET /api/orders/:id/details
 * Devuelve el detalle de una orden específica
 */
exports.getOrderDetails = (req, res) => {
  const order = orders.find(o => o.DocEntry == req.params.id);
  if (!order) return res.status(404).json({ message: 'Orden no encontrada' });

  if (req.user.role === 'cliente' && req.user.cardCode !== order.CardCode) {
    return res.status(403).json({ message: 'No autorizado para ver el detalle de esta orden' });
  }

  const details = orderDetails.filter(d => d.DocEntry == req.params.id);
  res.json(details);
};

exports.searchOrders = async (req, res) => {
  try {
    const filters = req.body;

    if (!filters || typeof filters !== 'object') {
      return res.status(400).json({ message: 'Filtros no válidos' });
    }

    const data = await orderService.getOrdersByFilters(filters);
    res.json(data);
  } catch (err) {
    console.error('[searchOrders] Error:', err.message);
    res.status(500).json({ message: 'Error interno al buscar órdenes' });
  }
};
