const express = require('express');
const router = express.Router();
const ChatController = require('../controllers/chat.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { authorizeRoles } = require('../middleware/role.middleware');

// Ruta de prueba para verificar la tabla (sin autenticación)
router.get('/test', async (req, res) => {
  try {
    const pool = require('../config/db');
    const [rows] = await pool.query('SHOW TABLES LIKE "chat_messages"');
    res.json({ 
      tableExists: rows.length > 0,
      tables: rows,
      message: 'Endpoint funcionando'
    });
  } catch (error) {
    console.error('Error en /test:', error);
    res.status(500).json({ 
      error: error.message,
      stack: error.stack 
    });
  }
});

// Rutas para clientes
router.post('/send', authMiddleware, ChatController.sendMessage);
router.get('/messages/:customerId', authMiddleware, ChatController.getCustomerMessages);
router.get('/unread/:customerId', authMiddleware, ChatController.getUnreadCount);
router.put('/read/:customerId', authMiddleware, ChatController.markAsRead);

// Rutas solo para administradores
router.get('/recent', authMiddleware, authorizeRoles(['admin']), ChatController.getRecentChats);
router.get('/summary', authMiddleware, authorizeRoles(['admin']), ChatController.getChatSummary);
router.put('/mark-all-read', authMiddleware, authorizeRoles(['admin']), ChatController.markAllAsRead);
router.put('/mark-read-admin/:customerId', authMiddleware, authorizeRoles(['admin']), ChatController.markAsReadByAdmin);

module.exports = router; 