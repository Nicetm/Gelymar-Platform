const express = require('express');
const router = express.Router();
const orderDetailController = require('../controllers/orderDetail.controller');
const authMiddleware = require('../middleware/auth.middleware');

// Aplicar middleware de autenticación a todas las rutas
router.use(authMiddleware);

// GET /api/order-detail/:orderId - Obtener detalles de una orden
router.get('/:orderId', orderDetailController.getOrderDetail);

// POST /api/order-detail/:orderId - Crear detalles de una orden

module.exports = router; 
