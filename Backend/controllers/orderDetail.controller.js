const { container } = require('../config/container');
const orderDetailService = container.resolve('orderDetailService');
const { logger } = require('../utils/logger');
const { t } = require('../i18n');

/**
 * @route GET /api/order-detail/:orderId
 * @desc Obtiene los detalles de una orden específica
 * @access Protegido (requiere JWT)
 */
exports.getOrderDetail = async (req, res) => {
  const { orderId } = req.params;
  
  if (!orderId) {
    logger.warn('ID de orden requerido en getOrderDetail');
    return res.status(400).json({ message: t('order.order_id_required', req.lang || 'es') });
  }

  try {
    const orderDetail = await orderDetailService.getOrderDetailByOrderId(orderId);
    
    if (!orderDetail) {
      logger.info(`No hay datos en order_detail para orderId: ${orderId}`);
      res.status(404).json({ message: t('order.order_detail_not_found', req.lang || 'es') });
    } else {
      logger.info(`Detalles de orden obtenidos para orderId: ${orderId}`);
      res.status(200).json(orderDetail);
    }
  } catch (err) {
    logger.error(`Error al obtener detalles de orden: ${err.message}`);
    res.status(500).json({ message: t('order.get_order_detail_internal_error', req.lang || 'es') });
  }
};

// createOrderDetail eliminado: ahora los detalles provienen directamente de SQL (vista).
