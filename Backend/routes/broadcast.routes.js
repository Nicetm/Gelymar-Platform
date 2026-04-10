const express = require('express');
const router = express.Router();
const { logger } = require('../utils/logger');

/**
 * POST /api/broadcast
 * Envía una notificación en tiempo real a un grupo de usuarios vía Socket.IO.
 * Body: { target: 'admin'|'seller'|'client'|'all', title, message, type: 'info'|'warning'|'success' }
 */
router.post('/', (req, res) => {
  try {
    const { target, title, message, type = 'info' } = req.body;

    if (!target || !title || !message) {
      return res.status(400).json({ message: 'target, title y message son requeridos' });
    }

    const validTargets = ['admin', 'seller', 'client', 'all'];
    if (!validTargets.includes(target)) {
      return res.status(400).json({ message: `target debe ser: ${validTargets.join(', ')}` });
    }

    const io = req.app.get('io');
    if (!io) {
      return res.status(500).json({ message: 'Socket.IO no disponible' });
    }

    const payload = { title, message, type, timestamp: new Date().toISOString() };

    if (target === 'all') {
      io.emit('broadcastNotification', payload);
    } else {
      io.to(`${target}-room`).emit('broadcastNotification', payload);
    }

    logger.info(`[broadcast] Notificación enviada target=${target} title="${title}"`);
    res.json({ success: true, message: `Notificación enviada a ${target}` });
  } catch (error) {
    logger.error(`[broadcast] Error: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
