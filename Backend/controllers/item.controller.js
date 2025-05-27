const items = require('../dummy/itemsByOrder.json');
const orders = require('../dummy/orders.json');

/**
 * GET /api/items/by-order/:orderId
 * Retorna los ítems fabricados para una orden específica
 */
exports.getItemsByOrder = (req, res) => {
  const orderId = parseInt(req.params.orderId);

  const order = orders.find(o => o.DocEntry === orderId);
  if (!order) return res.status(404).json({ message: 'Orden no encontrada' });

  if (req.user.role === 'cliente' && req.user.cardCode !== order.CardCode) {
    return res.status(403).json({ message: 'No autorizado para acceder a esta orden' });
  }

  const relatedItems = items.filter(item => item.DocEntry === orderId);
  return res.json(relatedItems);
};
