const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const AuditMiddleware = require('./audit.middleware');
const crypto = require('crypto');

// Configuración de la base de datos
const dbConfig = {
  host: 'mysql',
  port: 3306,
  user: 'root',
  password: 'root123456',
  database: 'gelymar',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

const pool = mysql.createPool(dbConfig);
const auditMiddleware = new AuditMiddleware();

/**
 * Middleware para verificar autenticación
 */
const requireAuth = async (req, res, next) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({
        success: false,
        message: 'No autorizado. Inicia sesión primero.'
      });
    }

    // Verificar que el usuario aún existe en la base de datos
    const [users] = await pool.execute(
      'SELECT id, username FROM monitoring WHERE id = ?',
      [req.session.userId]
    );

    if (users.length === 0) {
      req.session.destroy();
      return res.status(401).json({
        success: false,
        message: 'Usuario no encontrado. Inicia sesión nuevamente.'
      });
    }

    req.user = users[0];
    next();
  } catch (error) {
    console.error('Error en middleware de autenticación:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

/**
 * Autenticar usuario
 */
const authenticateUser = async (username, password) => {
  try {
    
    const [users] = await pool.execute(
      'SELECT id, username, password FROM monitoring WHERE username = ?',
      [username]
    );

    if (users.length === 0) {
      return { success: false, message: 'Usuario no encontrado' };
    }

    const user = users[0];
    
    // Verificar si la contraseña está hasheada o en texto plano
    let isValidPassword = false;
    
    if (user.password.startsWith('$2')) {
      // Hash bcrypt
      isValidPassword = await bcrypt.compare(password, user.password);
    } else if (user.password.length === 64) {
      // Hash SHA-256
      const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
      isValidPassword = passwordHash === user.password;
    } else {
      // Texto plano
      isValidPassword = password === user.password;
    }

    if (!isValidPassword) {
      return { success: false, message: 'Contraseña incorrecta' };
    }

    return {
      success: true,
      user: {
        id: user.id,
        username: user.username
      }
    };
  } catch (error) {
    console.error('Error autenticando usuario:', error);
    return { success: false, message: 'Error interno del servidor' };
  }
};

/**
 * Middleware para verificar si el usuario ya está autenticado
 */
const checkAuth = (req, res, next) => {
  if (req.session && req.session.userId) {
    return res.redirect('/dashboard');
  }
  next();
};

module.exports = {
  requireAuth,
  authenticateUser,
  checkAuth,
  pool
};
