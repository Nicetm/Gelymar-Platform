const { container } = require('../config/container');
const itemService = container.resolve('itemService');
const { logger } = require('../utils/logger');
const { t } = require('../i18n');

/**
 * GET /api/items/by-order/:orderId
 * Retorna los ítems fabricados para una orden específica
 */
exports.getItemsByOrder = async (req, res) => {
  try {
    const orderId = parseInt(req.params.orderId);
    
    if (isNaN(orderId)) {
      return res.status(400).json({ message: t('item.invalid_order_id', req.lang || 'es') });
    }

    const items = await itemService.getItemsByOrder(orderId, req.user);
    
    if (!items) {
      return res.status(404).json({ message: t('item.order_not_found_or_unauthorized', req.lang || 'es') });
    }

    res.json(items);
  } catch (err) {
    logger.error(`[ItemController][getItemsByOrder] Error: ${err.message}`);
    res.status(500).json({ message: t('item.get_items_error', req.lang || 'es') });
  }
};
