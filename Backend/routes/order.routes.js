const express = require('express');
const router = express.Router();
const orderController = require('../controllers/order.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { authorizeRoles } = require('../middleware/role.middleware');

/**
 * @swagger
 * tags:
 *   name: Órdenes
 *   description: Endpoints para gestión de órdenes de venta
 */

/**
 * @swagger
 * /api/orders:
 *   get:
 *     summary: Obtiene todas las órdenes (admin) o solo del cliente autenticado
 *     tags: [Órdenes]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de órdenes
 */
router.get('/', authMiddleware, authorizeRoles(['admin', 'cliente']), orderController.getAllOrders);

/**
 * @swagger
 * /api/orders/{id}:
 *   get:
 *     summary: Obtiene una orden específica por ID
 *     tags: [Órdenes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Orden encontrada
 *       403:
 *         description: No autorizado
 *       404:
 *         description: No encontrada
 */
router.get('/:id', authMiddleware, authorizeRoles(['admin', 'cliente']), orderController.getOrderById);

/**
 * @swagger
 * /api/orders/{id}/details:
 *   get:
 *     summary: Obtiene el detalle de una orden
 *     tags: [Órdenes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Detalles de la orden
 *       403:
 *         description: No autorizado
 *       404:
 *         description: No encontrada
 */
router.get('/:id/details', authMiddleware, authorizeRoles(['admin', 'cliente']), orderController.getOrderDetails);

module.exports = router;
