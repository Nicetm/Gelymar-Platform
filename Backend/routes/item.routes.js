const express = require('express');
const router = express.Router();
const itemController = require('../controllers/item.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { authorizeRoles } = require('../middleware/role.middleware');

/**
 * @swagger
 * tags:
 *   name: Ítems
 *   description: Endpoints para gestión de ítems fabricados por orden
 */

/**
 * @swagger
 * /api/items/by-order/{orderId}:
 *   get:
 *     summary: Obtiene los ítems fabricados asociados a una orden
 *     tags: [Ítems]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: orderId
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la orden (DocEntry)
 *     responses:
 *       200:
 *         description: Lista de ítems encontrados
 *       403:
 *         description: No autorizado
 *       404:
 *         description: Orden no encontrada
 */
router.get('/by-order/:orderId', authMiddleware, authorizeRoles(['admin', 'cliente']), itemController.getItemsByOrder);

module.exports = router;
