const orderDetailService = require('../services/orderDetail.service');
const logger = require('@utils/logger');

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
    
    // Siempre devolver una respuesta, incluso si no hay datos en order_detail
    if (!orderDetail) {
      logger.info(`No hay datos en order_detail para orderId: ${orderId}, devolviendo datos básicos de orders`);
      // Obtener datos básicos de la tabla orders
      const basicOrderData = await orderDetailService.getBasicOrderData(orderId);
      if (basicOrderData) {
        res.status(200).json(basicOrderData);
      } else {
        res.status(404).json({ message: 'Orden no encontrada' });
      }
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
 * @desc Crea o actualiza los detalles de una orden
 * @access Protegido (requiere JWT)
 */
exports.createOrUpdateOrderDetail = async (req, res) => {
  const { orderId } = req.params;
  const data = req.body;
  
  if (!orderId) {
    logger.warn('ID de orden requerido en createOrUpdateOrderDetail');
    return res.status(400).json({ message: 'ID de orden requerido' });
  }

  try {
    const result = await orderDetailService.createOrUpdateOrderDetail(orderId, data);
    
    const message = result.created 
      ? 'Detalles de orden creados exitosamente' 
      : 'Detalles de orden actualizados exitosamente';
    
    logger.info(`${message} para orderId: ${orderId}`);
    res.status(200).json({ 
      message, 
      result 
    });
  } catch (err) {
    logger.error(`Error al crear/actualizar detalles de orden: ${err.message}`);
    res.status(500).json({ message: 'Error interno al procesar detalles de orden' });
  }
}; 