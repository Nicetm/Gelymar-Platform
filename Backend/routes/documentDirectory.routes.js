const express = require('express');
const router = express.Router();
const controller = require('../controllers/documentDirectory.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { authorizeRoles } = require('../middleware/role.middleware');

/**
 * @swagger
 * /api/directories/create-client:
 *   post:
 *     summary: Crear carpeta principal del cliente
 *     tags: [Directorios]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - clientName
 *             properties:
 *               clientName:
 *                 type: string
 *                 example: Cliente Nuevo SPA
 *     responses:
 *       201:
 *         description: Carpeta creada
 *       400:
 *         description: Nombre requerido
 *       409:
 *         description: Ya existe
 */
router.post('/create-client', authMiddleware, authorizeRoles(['admin']), controller.createClientDirectory);

/**
 * @swagger
 * /api/directories/create-sub:
 *   post:
 *     summary: Crear subcarpeta dentro del directorio de cliente
 *     tags: [Directorios]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - clientName
 *               - subfolder
 *             properties:
 *               clientName:
 *                 type: string
 *                 example: Cliente Uno SPA
 *               subfolder:
 *                 type: string
 *                 example: CP1005
 *     responses:
 *       201:
 *         description: Subcarpeta creada
 *       400:
 *         description: Datos faltantes
 *       404:
 *         description: Cliente no existe
 *       409:
 *         description: Subcarpeta ya existe
 */
router.post('/create-sub', authMiddleware, authorizeRoles(['admin']), controller.createSubDirectory);

/**
 * @swagger
 * /api/directories/delete-sub:
 *   delete:
 *     summary: Eliminar subcarpeta vacía de un cliente
 *     tags: [Directorios]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - clientName
 *               - subfolder
 *             properties:
 *               clientName:
 *                 type: string
 *                 example: Cliente Dos Ltda
 *               subfolder:
 *                 type: string
 *                 example: CP1002
 *     responses:
 *       200:
 *         description: Subcarpeta eliminada
 *       400:
 *         description: Carpeta no vacía
 *       404:
 *         description: Subcarpeta no encontrada
 */

router.delete('/delete-sub', authMiddleware, authorizeRoles(['admin']), controller.deleteSubDirectory);

module.exports = router;
