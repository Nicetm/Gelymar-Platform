const express = require('express');
const router = express.Router();
const controller = require('../controllers/documentFile.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { authorizeRoles } = require('../middleware/role.middleware');

/**
 * @swagger
 * tags:
 *   name: Archivos
 *   description: Endpoints para subir y eliminar archivos
 */

/**
 * @swagger
 * /api/files/upload:
 *   post:
 *     summary: Sube un archivo al subdirectorio de un cliente
 *     tags: [Archivos]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - clientName
 *               - subfolder
 *               - file
 *             properties:
 *               clientName:
 *                 type: string
 *                 example: Cliente Uno SPA
 *               subfolder:
 *                 type: string
 *                 example: CP1005
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Archivo subido
 *       400:
 *         description: Parámetros faltantes o inválidos
 *       500:
 *         description: Error interno
 */
router.post('/upload', authMiddleware, authorizeRoles(['admin']), controller.uploadFile, controller.handleUpload);

/**
 * @swagger
 * /api/files/delete:
 *   delete:
 *     summary: Elimina un archivo de un subdirectorio de cliente
 *     tags: [Archivos]
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
 *               - filename
 *             properties:
 *               clientName:
 *                 type: string
 *               subfolder:
 *                 type: string
 *               filename:
 *                 type: string
 *                 example: informe.pdf
 *     responses:
 *       200:
 *         description: Archivo eliminado
 *       404:
 *         description: Archivo no encontrado
 *       400:
 *         description: Datos faltantes
 */
router.delete('/delete', authMiddleware, authorizeRoles(['admin']), controller.deleteFile);

module.exports = router;
