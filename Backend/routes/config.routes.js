const express = require('express');
const router = express.Router();
const configController = require('../controllers/config.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { authorizeRoles } = require('../middleware/role.middleware');

// Rutas para PDF mail list
router.get('/pdf-mail-list', authMiddleware, authorizeRoles(['admin']), configController.getPdfMailList);

router.put('/pdf-mail-list', authMiddleware, authorizeRoles(['admin']), configController.updatePdfMailList);

// Ruta para configuración del chat
router.get('/headerBusquedaClienteChat', authMiddleware, authorizeRoles(['admin']), configController.getHeaderBusquedaClienteChat);

module.exports = router;
