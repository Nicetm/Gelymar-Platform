const orderDetailService = require('../services/orderDetail.service');
const { logger } = require('../utils/logger');

/**
 * @route GET /api/order-detail/:orderId
 * @desc Obtiene los detalles de una orden específica
 * @access Protegido (requiere JWT)
 */
exports.getOrderDetail = async (req, res) => {
  const { orderId } = req.params;
  
  if (!orderId) {
    logger.warn('ID de orden requerido en getOrderDetail');
    return res.status(400).json({ message: 'ID de orden requerido' });
  }

  try {
    const orderDetail = await orderDetailService.getOrderDetailByOrderId(orderId);
    
    if (!orderDetail) {
      logger.info(`No hay datos en order_detail para orderId: ${orderId}`);
      res.status(404).json({ message: 'Detalles de orden no encontrados' });
    } else {
      logger.info(`Detalles de orden obtenidos para orderId: ${orderId}`);
      res.status(200).json(orderDetail);
    }
  } catch (err) {
    logger.error(`Error al obtener detalles de orden: ${err.message}`);
    res.status(500).json({ message: 'Error interno al obtener detalles de orden' });
  }
};

/**
 * @route POST /api/order-detail/:orderId
 * @desc Crea los detalles de una orden
 * @access Protegido (requiere JWT)
 */
exports.createOrderDetail = async (req, res) => {
  const { orderId } = req.params;
  const data = req.body;
  
  if (!orderId) {
    logger.warn('ID de orden requerido en createOrderDetail');
    return res.status(400).json({ message: 'ID de orden requerido' });
  }

  try {
    const result = await orderDetailService.createOrderDetail(orderId, data);
    
    logger.info(`Detalles de orden creados exitosamente para orderId: ${orderId}`);
    res.status(200).json({ 
      message: 'Detalles de orden creados exitosamente', 
      result 
    });
  } catch (err) {
    logger.error(`Error al crear detalles de orden: ${err.message}`);
    res.status(500).json({ message: 'Error interno al procesar detalles de orden' });
  }
}; 