// services/monitoring.service.js
const { poolPromise } = require('../config/db');
const { logger } = require('../utils/logger');
const crypto = require('crypto');

// Almacenamiento de sesiones en memoria (en producción usar Redis)
if (!global.monitoringSessions) {
  global.monitoringSessions = new Map();
}

/**
 * Autenticar usuario del panel de monitoreo
 * @param {string} username - Nombre de usuario
 * @param {string} password - Contraseña en texto plano
 * @returns {Object|null} Datos del usuario si es válido, null si no
 */
async function authenticateUser(username, password) {
  try {
    const pool = await poolPromise;
    
    // Buscar usuario en tabla monitoring
    const [rows] = await pool.query(
      'SELECT * FROM monitoring WHERE username = ? AND is_enabled = 1',
      [username]
    );

    if (rows.length === 0) {
      logger.warn(`Usuario de monitoreo no encontrado o deshabilitado: ${username}`);
      return null;
    }

    const user = rows[0];
    
    // Verificar contraseña (SHA256)
    const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
    
    if (hashedPassword !== user.password) {
      logger.warn(`Contraseña incorrecta para usuario de monitoreo: ${username}`);
      return null;
    }

    // Parsear app_types
    let appTypes = user.app_types;
    if (typeof appTypes === 'string') {
      try {
        appTypes = JSON.parse(appTypes);
      } catch (e) {
        logger.error(`Error parseando app_types para usuario ${username}:`, e);
        appTypes = [];
      }
    }

    return {
      id: user.id,
      username: user.username,
      appTypes: appTypes,
      createdAt: user.created_at,
      updatedAt: user.updated_at
    };

  } catch (error) {
    logger.error(`Error en autenticación de monitoreo: ${error.message}`);
    throw error;
  }
}

/**
 * Generar token de sesión para monitoreo
 * @param {Object} user - Datos del usuario autenticado
 * @returns {string} Token de sesión
 */
function generateSessionToken(user) {
  const sessionToken = crypto.randomBytes(32).toString('hex');
  
  global.monitoringSessions.set(sessionToken, {
    userId: user.id,
    username: user.username,
    appTypes: user.appTypes,
    createdAt: new Date()
  });

  return sessionToken;
}

/**
 * Verificar token de sesión de monitoreo
 * @param {string} token - Token de sesión
 * @returns {Object|null} Datos de la sesión si es válida, null si no
 */
function verifySessionToken(token) {
  if (!global.monitoringSessions.has(token)) {
    return null;
  }

  const session = global.monitoringSessions.get(token);
  
  // Verificar que la sesión no haya expirado (24 horas)
  const sessionAge = Date.now() - session.createdAt.getTime();
  const maxAge = 24 * 60 * 60 * 1000; // 24 horas
  
  if (sessionAge > maxAge) {
    global.monitoringSessions.delete(token);
    return null;
  }

  return session;
}

/**
 * Cerrar sesión de monitoreo
 * @param {string} token - Token de sesión
 * @returns {boolean} True si se cerró correctamente
 */
function closeSession(token) {
  if (global.monitoringSessions.has(token)) {
    const session = global.monitoringSessions.get(token);
    global.monitoringSessions.delete(token);
    return true;
  }
  return false;
}

/**
 * Limpiar sesiones expiradas
 */
function cleanupExpiredSessions() {
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24 horas
  
  for (const [token, session] of global.monitoringSessions.entries()) {
    const sessionAge = now - session.createdAt.getTime();
    if (sessionAge > maxAge) {
      global.monitoringSessions.delete(token);
    }
  }
}

// Limpiar sesiones expiradas cada hora
setInterval(cleanupExpiredSessions, 60 * 60 * 1000);

module.exports = {
  authenticateUser,
  generateSessionToken,
  verifySessionToken,
  closeSession,
  cleanupExpiredSessions
}; 