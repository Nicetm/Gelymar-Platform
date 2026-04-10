const router = require('express').Router();
const authMiddleware = require('../middleware/auth.middleware');
const { getConfig, getEnvConfig, getCurrentEnv } = require('../config/database');

router.post('/send', authMiddleware, async (req, res) => {
  try {
    const { target, title, message, type } = req.body;

    if (!target || !title || !message) {
      return res.status(400).json({ message: 'target, title y message son requeridos' });
    }

    const envCfg = getEnvConfig(getCurrentEnv());
    const backendUrl = envCfg?.backendUrl || 'http://localhost:3000';

    const response = await fetch(`${backendUrl}/api/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target, title, message, type })
    });

    const data = await response.json();

    if (response.ok) {
      res.json(data);
    } else {
      res.status(response.status).json(data);
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
