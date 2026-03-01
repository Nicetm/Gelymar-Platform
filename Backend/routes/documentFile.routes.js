const express = require('express');
const router = express.Router();
const controller = require('../controllers/documentFile.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { authorizeRoles } = require('../middleware/role.middleware');
const { languageMiddleware } = require('../i18n');


/**
 * @swagger
 * /api/files/{customerRut}:
 *   get:
 *     summary: Lista archivos de un cliente según carpeta
 *     tags: [Archivos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: customerUuid
 *         required: true
 *         schema:
 *           type: string
 *         description: UUID del cliente
 *       - in: query
 *         name: f
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID numérico del folder
 *     responses:
 *       200:
 *         description: Archivos listados correctamente
 *       400:
 *         description: Parámetros inválidos
 *       404:
 *         description: Cliente o folder no encontrado
 *       500:
 *         description: Error interno del servidor
 */


// Rutas de visualización/descarga de archivos
router.get('/view/:id', languageMiddleware, authMiddleware, controller.viewFile);
router.get('/temp-view/:token', languageMiddleware, controller.tempViewFile);
// view-with-token valida el token de query en el controlador; se expone sin auth aquí
router.get('/view-with-token/:id', languageMiddleware, controller.viewWithToken);
router.get('/download/:id', languageMiddleware, authMiddleware, controller.downloadFile);
router.get('/:customerRut', languageMiddleware, authMiddleware, authorizeRoles(['admin', 'seller', 'client']), controller.getFilesByCustomerAndFolder);

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
router.post('/upload', languageMiddleware, authMiddleware, authorizeRoles(['admin']), controller.uploadFile, controller.handleUpload);

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

router.post('/generate/:id', languageMiddleware, authMiddleware, authorizeRoles(['admin']), controller.generateFile);

router.post('/regenerate/:id', languageMiddleware, authMiddleware, authorizeRoles(['admin']), controller.regenerateFile);

router.post('/send/:id', languageMiddleware, authMiddleware, authorizeRoles(['admin']), controller.sendFile);

router.post('/resend/:id', languageMiddleware, authMiddleware, authorizeRoles(['admin']), controller.resendFile);

router.put('/rename/:id', languageMiddleware, authMiddleware, authorizeRoles(['admin']), controller.RenameFile);

router.delete('/delete/:id', languageMiddleware, authMiddleware, authorizeRoles(['admin']), controller.deleteFileById);

/**
 * @swagger
 * /api/files/create-default/{orderId}:
 *   post:
 *     summary: Crea archivos por defecto para una orden específica
 *     tags: [Archivos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la orden
 *     responses:
 *       201:
 *         description: Archivos por defecto creados exitosamente
 *       404:
 *         description: Orden no encontrada
 *       500:
 *         description: Error interno del servidor
 */
router.post('/create-default', languageMiddleware, authMiddleware, authorizeRoles(['admin']), controller.createDefaultFiles);
router.post('/create-default/:orderId', languageMiddleware, authMiddleware, authorizeRoles(['admin']), controller.createDefaultFiles);
router.post('/process-new-orders', languageMiddleware, controller.processNewOrdersAndSendReception);

module.exports = router;
