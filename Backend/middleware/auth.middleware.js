// middleware/auth.middleware.js
const jwt = require('jsonwebtoken');
const { poolPromise } = require('../config/db');

module.exports = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.split(' ')[1];

  if (!token) return res.status(401).json({ message: 'Token requerido' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const pool = await poolPromise;
    const [rows] = await pool.query(
      `SELECT u.id, u.email, r.name AS role, u.twoFAEnabled, u.twoFASecret
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.id = ?`,
      [decoded.id]
    );
    const user = rows[0];
    if (!user) {
      return res.status(401).json({ message: 'Usuario no encontrado' });
    }
  
    req.user = user;
    return next();

  } catch (err) {
    // Permitir token expirado SOLO para /refresh
    if (req.path === '/refresh' && err.name === 'TokenExpiredError') {
      const decoded = jwt.decode(token);
      req.user = decoded;
      return next();
    }
    return res.status(403).json({ message: 'Token inválido o expirado' });
  }
};