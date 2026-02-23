const express = require('express');
const router = express.Router();
const orderController = require('../controllers/order.controller');
const configController = require('../controllers/config.controller');
const authMiddleware = require('../middleware/auth.middleware');
const headerPreferredAuth = authMiddleware.createAuthMiddleware({ tokenSource: 'both', preferHeader: true });
const { authorizeRoles } = require('../middleware/role.middleware');

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
router.get('/', authMiddleware, authorizeRoles(['admin', 'seller', 'client']), orderController.getAllOrders);

/**
 * @swagger
 * /api/orders/alerts/missing-documents:
 *   get:
 *     summary: Obtiene órdenes que requieren alerta por falta de documentos
 *     tags: [Órdenes]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de órdenes que necesitan documentos
 *       404:
 *         description: Configuración no encontrada
 */
router.get('/alerts/missing-documents', authMiddleware, authorizeRoles(['admin']), configController.getOrdersMissingDocumentsAlert);

// Obtener orden por PC (admin)
router.get('/pc/:pc', authMiddleware, authorizeRoles(['admin']), orderController.getOrderByPc);

/**
 * @swagger
 * /api/orders/admin/dashboard/sales:
 *   get:
 *     summary: Obtiene metricas de ventas para dashboard admin
 *     tags: [òrdenes]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Datos de ventas
 */
router.get('/admin/dashboard/sales', authMiddleware, authorizeRoles(['admin']), orderController.getAdminSalesDashboard);

/**
 * @swagger
 * /api/orders/admin/price-analysis:
 *   get:
 *     summary: Obtiene datos de analisis de precios (solo Carla)
 *     tags: [•rdenes]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Datos de analisis de precios
 */
router.get('/admin/price-analysis', headerPreferredAuth, authorizeRoles(['admin']), orderController.getAdminPriceAnalysis);

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
router.get('/:id', authMiddleware, authorizeRoles(['admin', 'seller', 'client']), orderController.getOrderById);

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
router.get('/:id/details', authMiddleware, authorizeRoles(['admin', 'seller', 'client']), orderController.getOrderDetails);


router.post('/search', authMiddleware, authorizeRoles(['admin', 'seller', 'client']), orderController.searchOrders);

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
router.get('/:orderPc/:orderOc/:factura/items', authMiddleware, authorizeRoles(['admin', 'seller', 'client']), orderController.getOrderItems);
router.get('/:orderPc/:orderOc/items', authMiddleware, authorizeRoles(['admin', 'seller', 'client']), orderController.getOrderItemsWithoutFactura);

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
router.get('/:orderId/detail', authMiddleware, authorizeRoles(['admin', 'seller', 'client']), orderController.getOrderDetail);

module.exports = router;
