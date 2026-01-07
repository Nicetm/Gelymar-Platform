// middleware/auth.middleware.js
const jwt = require('jsonwebtoken');
const { logger } = require('../utils/logger');
const { normalizeRole } = require('../utils/role.util');
const userService = require('../services/user.service');

/**
 * Middleware unificado de autenticación que maneja tanto tokens JWT como cookies
 * @param {Object} options - Opciones de configuración
 * @param {boolean} options.requireAuth - Si requiere autenticación (default: true)
 * @param {boolean} options.allowExpired - Si permite tokens expirados (default: false)
 * @param {string} options.tokenSource - Fuente del token ('both', 'header', 'cookie')
 * @param {boolean} options.preferHeader - Prioriza Authorization header cuando tokenSource = 'both'
 */
const createAuthMiddleware = (options = {}) => {
  const {
    requireAuth = true,
    allowExpired = false,
    tokenSource = 'both',
    preferHeader = false
  } = options;

  return async (req, res, next) => {
    try {
      let token = null;

      // Obtener token según la fuente especificada
      const readFromHeader = () => {
        const authHeader = req.headers['authorization'];
        if (authHeader?.startsWith('Bearer ')) {
          return authHeader.split(' ')[1];
        }
        return null;
      };

      const readFromCookie = () => req.cookies?.token || null;

      if (tokenSource === 'both') {
        token = preferHeader ? (readFromHeader() || readFromCookie()) : (readFromCookie() || readFromHeader());
      } else if (tokenSource === 'header') {
        token = readFromHeader();
      } else if (tokenSource === 'cookie') {
        token = readFromCookie();
      }

      if (!token) {
        if (requireAuth) {
          return res.status(401).json({ message: 'Token requerido' });
        }
        return next();
      }

      // Verificar token
      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
      } catch (err) {
        // Manejar token expirado según configuración
        if (allowExpired && err.name === 'TokenExpiredError') {
          decoded = jwt.decode(token);
          if (!decoded || !decoded.email) {
            return res.status(403).json({ message: 'Token inválido' });
          }
        } else {
          // Si el token expiró y no se permite, actualizar online a 0
          if (err.name === 'TokenExpiredError') {
            try {
              const expiredDecoded = jwt.decode(token);
              if (expiredDecoded && expiredDecoded.id) {
                await userService.updateUserOnlineStatus(expiredDecoded.id, 0);
                logger.info(`Token expirado para usuario ${expiredDecoded.email} - online actualizado a 0`);
              }
            } catch (error) {
              logger.error(`Error actualizando estado online por token expirado: ${error.message}`);
            }
          }
          return res.status(403).json({ message: 'Token inválido o expirado' });
        }
      }

      // Obtener datos completos del usuario desde BD
      const user = await userService.findUserForAuth(decoded.id);
      if (!user) {
        return res.status(401).json({ message: 'Usuario no encontrado' });
      }

      const normalizedRole = normalizeRole(user.role, user.role_id);

      // Asignar datos completos del usuario
      req.user = {
        ...decoded,
        role: normalizedRole,
        roleName: user.role,
        roleId: user.role_id,
        uuid: user.uuid,
        twoFAEnabled: user.twoFAEnabled,
        twoFASecret: user.twoFASecret
      };

      next();

    } catch (error) {
      logger.error(`Error en middleware de autenticación: ${error.message}`);
      return res.status(500).json({ message: 'Error interno de autenticación' });
    }
  };
};

// Middleware por defecto (requiere autenticación)
module.exports = createAuthMiddleware();

// Exportar función para crear middlewares personalizados
module.exports.createAuthMiddleware = createAuthMiddleware;
