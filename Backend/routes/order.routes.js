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
 * /api/orders/client/dashboard:
 *   get:
 *     summary: Obtiene órdenes formateadas para el dashboard del cliente
 *     tags: [Órdenes]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de órdenes formateadas para el dashboard
 *       403:
 *         description: No autorizado
 */
router.get('/client/dashboard', authMiddleware, authorizeRoles(['client']), orderController.getClientDashboardOrders);

/**
 * @swagger
 * /api/orders/client/{orderId}/documents:
 *   get:
 *     summary: Obtiene documentos de una orden específica del cliente
 *     tags: [Órdenes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: orderId
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lista de documentos de la orden
 *       403:
 *         description: No autorizado
 *       404:
 *         description: Orden no encontrada
 */
router.get('/client/:orderId/documents', authMiddleware, authorizeRoles(['client']), orderController.getClientOrderDocuments);

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
router.get('/', authMiddleware, authorizeRoles(['admin', 'client']), orderController.getAllOrders);

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
router.get('/:id', authMiddleware, authorizeRoles(['admin', 'client']), orderController.getOrderById);

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
router.get('/:id/details', authMiddleware, authorizeRoles(['admin', 'client']), orderController.getOrderDetails);


router.post('/search', authMiddleware, authorizeRoles(['admin', 'client']), orderController.searchOrders);

/**
 * @swagger
 * /api/orders/{orderPc}/items:
 *   get:
 *     summary: Obtiene los items de una orden específica
 *     tags: [Órdenes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: orderPc
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de items de la orden
 *       403:
 *         description: No autorizado
 *       404:
 *         description: Orden no encontrada
 */
router.get('/:orderPc/items', authMiddleware, authorizeRoles(['admin', 'client']), orderController.getOrderItems);

/**
 * @swagger
 * /api/orders/{orderId}/detail:
 *   get:
 *     summary: Obtiene los detalles completos de una orden específica
 *     tags: [Órdenes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: orderId
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Detalles completos de la orden
 *       403:
 *         description: No autorizado
 *       404:
 *         description: Orden no encontrada
 */
router.get('/:orderId/detail', authMiddleware, authorizeRoles(['admin', 'client']), orderController.getOrderDetail);

module.exports = router;
