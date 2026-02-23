const express = require('express');
const router = express.Router();
const ChatController = require('../controllers/chat.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { authorizeRoles } = require('../middleware/role.middleware');

// Rutas para clientes
router.post('/send', authMiddleware, ChatController.sendMessage);
router.post('/upload-image', authMiddleware, authorizeRoles(['client', 'admin']), ChatController.uploadChatImage);
router.get('/messages/:customerId', authMiddleware, ChatController.getCustomerMessages);
router.get('/unread/:customerId', authMiddleware, ChatController.getUnreadCount);
router.put('/read/:customerId', authMiddleware, ChatController.markAsRead);

// Rutas solo para administradores
router.get('/recent', authMiddleware, authorizeRoles(['admin']), ChatController.getRecentChats);
router.get('/summary', authMiddleware, authorizeRoles(['admin']), ChatController.getChatSummary);
router.get('/admin/status', authMiddleware, authorizeRoles(['admin', 'client']), ChatController.getAdminOnlineStatus);
router.put('/mark-all-read', authMiddleware, authorizeRoles(['admin']), ChatController.markAllAsRead);
router.put('/mark-read-admin/:customerId', authMiddleware, authorizeRoles(['admin']), ChatController.markAsReadByAdmin);
router.put('/mark-read-client/:customerId', authMiddleware, authorizeRoles(['client']), ChatController.markAsReadByClient);

// Rutas para typing
router.post('/typing', authMiddleware, authorizeRoles(['client']), ChatController.handleTyping);
router.post('/stop-typing', authMiddleware, authorizeRoles(['client']), ChatController.handleStopTyping);
router.get('/admins', authMiddleware, authorizeRoles(['client']), ChatController.getAdmins);

module.exports = router; 
