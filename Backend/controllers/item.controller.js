const itemService = require('../services/item.service');

/**
 * GET /api/items/by-order/:orderId
 * Retorna los ítems fabricados para una orden específica
 */
exports.getItemsByOrder = async (req, res) => {
  try {
    const orderId = parseInt(req.params.orderId);
    
    if (isNaN(orderId)) {
      return res.status(400).json({ message: 'ID de orden inválido' });
    }

    const items = await itemService.getItemsByOrder(orderId, req.user);
    
    if (!items) {
      return res.status(404).json({ message: 'Orden no encontrada o no autorizada' });
    }

    res.json(items);
  } catch (err) {
    console.error('[getItemsByOrder] Error:', err.message);
    res.status(500).json({ message: 'Error al obtener items de la orden' });
  }
};
