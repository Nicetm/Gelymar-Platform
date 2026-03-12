// middleware/auth.middleware.js
const jwt = require('jsonwebtoken');
const { logger } = require('../utils/logger');
const { normalizeRole } = require('../utils/role.util');
const { container } = require('../config/container');
const userService = container.resolve('userService');

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
      let tokenSourceUsed = 'none';

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
        const headerToken = readFromHeader();
        const cookieToken = readFromCookie();
        if (preferHeader) {
          token = headerToken || cookieToken;
          tokenSourceUsed = headerToken ? 'header' : (cookieToken ? 'cookie' : 'none');
        } else {
          token = cookieToken || headerToken;
          tokenSourceUsed = cookieToken ? 'cookie' : (headerToken ? 'header' : 'none');
        }
      } else if (tokenSource === 'header') {
        token = readFromHeader();
        tokenSourceUsed = token ? 'header' : 'none';
      } else if (tokenSource === 'cookie') {
        token = readFromCookie();
        tokenSourceUsed = token ? 'cookie' : 'none';
      }

      if (!token) {
        if (requireAuth) {
          logger.warn(`[auth] token requerido path=${req.originalUrl || req.path} source=${tokenSourceUsed}`);
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
          if (!decoded || !(decoded.rut || decoded.email)) {
            return res.status(403).json({ message: 'Token inválido' });
          }
        } else {
          // Si el token expiró y no se permite, actualizar online a 0
          if (err.name === 'TokenExpiredError') {
            try {
              const expiredDecoded = jwt.decode(token);
              if (expiredDecoded && expiredDecoded.id) {
                await userService.updateUserOnlineStatus(expiredDecoded.id, 0);
                logger.info(`Token expirado para usuario ${expiredDecoded.rut || expiredDecoded.email} - online actualizado a 0`);
              }
            } catch (error) {
              logger.error(`Error actualizando estado online por token expirado: ${error.message}`);
            }
          }
          logger.warn(`[auth] token inválido path=${req.originalUrl || req.path} source=${tokenSourceUsed} reason=${err.name || 'unknown'}`);
          return res.status(403).json({ message: 'Token inválido o expirado' });
        }
      }

      // Obtener datos completos del usuario desde BD
      const user = await userService.findUserForAuth(decoded.id);
      if (!user) {
        logger.warn(`[auth] usuario no encontrado id=${decoded?.id || 'N/A'} path=${req.originalUrl || req.path}`);
        return res.status(401).json({ message: 'Usuario no encontrado' });
      }

      const normalizedRole = normalizeRole(user.role, user.role_id);

      // Asignar datos completos del usuario
      req.user = {
        ...decoded,
        rut: decoded.rut || decoded.email,
        role: normalizedRole,
        roleName: user.role,
        roleId: user.role_id,
        customer_rut: user.rut,
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
// Preferir el token del header para evitar conflictos con cookies de otros portales.
module.exports = createAuthMiddleware({ tokenSource: 'both', preferHeader: true });

// Exportar función para crear middlewares personalizados
module.exports.createAuthMiddleware = createAuthMiddleware;
