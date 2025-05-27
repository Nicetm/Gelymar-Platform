const orders = require('../dummy/orders.json');
const orderDetails = require('../dummy/orderDetails.json');

/**
 * GET /api/orders
 * Lista todas las órdenes (admin) o solo las del cliente autenticado
 */
exports.getAllOrders = (req, res) => {
  if (req.user.role === 'admin') {
    return res.json(orders);
  }

  if (req.user.role === 'cliente') {
    const filtered = orders.filter(o => o.CardCode === req.user.cardCode);
    if (filtered.length === 0) {
      return res.status(404).json({ message: 'No se encontraron órdenes para este cliente' });
    }
    return res.json(filtered);
  }

  const filtered = orders.filter(o => o.CardCode === req.user.cardCode);
  return res.json(filtered);
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
