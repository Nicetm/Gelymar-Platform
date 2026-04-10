const jwt = require('jsonwebtoken');
const { getConfig } = require('../config/database');

function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token requerido' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const config = getConfig();
    const decoded = jwt.verify(token, config.jwtSecret || 'super-admin-panel-secret-change-me');
    req.user = decoded;
    next();
  } catch {
    return res.status(403).json({ message: 'Token inválido o expirado' });
  }
}

module.exports = authMiddleware;
