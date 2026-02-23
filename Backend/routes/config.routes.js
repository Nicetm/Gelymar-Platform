const express = require('express');
const router = express.Router();
const configController = require('../controllers/config.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { authorizeRoles } = require('../middleware/role.middleware');

// Rutas para PDF mail list
router.get('/pdf-mail-list', authMiddleware, authorizeRoles(['admin']), configController.getPdfMailList);
router.put('/pdf-mail-list', authMiddleware, authorizeRoles(['admin']), configController.updatePdfMailList);

// Rutas para Notificación Email List
router.get('/notification-email-list', authMiddleware, authorizeRoles(['admin']), configController.getNotificationEmailList);
router.put('/notification-email-list', authMiddleware, authorizeRoles(['admin']), configController.updateNotificationEmailList);

// Ruta para configuración del chat
router.get('/headerBusquedaClienteChat', authMiddleware, authorizeRoles(['admin']), configController.getHeaderBusquedaClienteChat);
router.get('/headerUsersSinCuenta', authMiddleware, authorizeRoles(['admin']), configController.getHeaderUsersSinCuenta);
router.get('/headerNotificaciones', authMiddleware, authorizeRoles(['admin']), configController.getHeaderNotificaciones);
router.get('/headerOrdenesSinDocumentos', authMiddleware, authorizeRoles(['admin']), configController.getHeaderOrdenesSinDocumentosConfig);
router.get('/sidebar-menu', authMiddleware, authorizeRoles(['admin', 'client']), configController.getSidebarMenuConfig);

// Visibilidad de opciones del panel de ajustes
router.get('/admin-settings/visibility', authMiddleware, authorizeRoles(['admin']), configController.getAdminSettingsVisibility);

// Configuración de recaptcha en login (público - sin auth)
router.get('/recaptcha-login', configController.getRecaptchaLoginConfig);

module.exports = router;
