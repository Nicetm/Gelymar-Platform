// middleware/authFromCookie.js
const jwt = require('jsonwebtoken');
const { poolPromise } = require('../config/db');

const authFromCookie = async (req, res, next) => {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).send('No autorizado (token no encontrado)');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // 🔐 OBTENER ROL COMPLETO DESDE LA BASE DE DATOS
    const pool = await poolPromise;
    const [rows] = await pool.query(
      `SELECT u.id, u.email, r.name AS role, u.twoFAEnabled, u.twoFASecret, c.uuid
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       LEFT JOIN customers c ON u.email = c.rut
       WHERE u.id = ?`,
      [decoded.id]
    );
    
    const user = rows[0];
    if (!user) {
      return res.status(401).send('Usuario no encontrado');
    }

    // Asignar datos completos del usuario
    req.user = {
      ...decoded,
      role: user.role,
      uuid: user.uuid
    };
    
    next();
  } catch (err) {
    return res.status(403).send('Token inválido o expirado');
  }
};

module.exports = authFromCookie;