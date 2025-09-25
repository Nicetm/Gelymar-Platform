const AuditModel = require('../models/audit.model');

class AuditMiddleware {
  constructor() {
    this.auditModel = new AuditModel();
  }

  // Middleware para registrar acciones automáticamente
  logAction(action, resourceType = null, resourceId = null) {
    return async (req, res, next) => {
      try {
        // Obtener información del usuario y request
        const userId = req.session?.userId || null;
        const username = req.session?.username || 'anonymous';
        const ipAddress = req.ip || req.connection.remoteAddress;
        const userAgent = req.get('User-Agent');

        // Extraer detalles relevantes del request
        const details = {
          method: req.method,
          url: req.originalUrl,
          body: req.method !== 'GET' ? req.body : null,
          query: req.query,
          params: req.params
        };

        // Registrar la acción
        await this.auditModel.logAction({
          userId,
          username,
          action,
          resourceType,
          resourceId,
          details,
          ipAddress,
          userAgent
        });

        // Continuar con el siguiente middleware
        next();
      } catch (error) {
        console.error('Error en middleware de auditoría:', error);
        // No bloquear la request por errores de auditoría
        next();
      }
    };
  }

  // Middleware específico para acciones de contenedores
  logContainerAction(action) {
    return this.logAction(`container_${action}`, 'container', null);
  }

  // Middleware específico para acciones de configuración
  logConfigAction(action) {
    return this.logAction(`config_${action}`, 'configuration', null);
  }

  // Middleware específico para acciones de usuarios
  logUserAction(action, userId = null) {
    return this.logAction(`user_${action}`, 'user', userId);
  }

  // Middleware específico para acciones de sistema
  logSystemAction(action) {
    return this.logAction(`system_${action}`, 'system', null);
  }

  // Middleware para registrar login
  logLogin() {
    return async (req, res, next) => {
      try {
        const userId = req.session?.userId || null;
        const username = req.session?.username || 'unknown';
        const ipAddress = req.ip || req.connection.remoteAddress;
        const userAgent = req.get('User-Agent');

        await this.auditModel.logAction({
          userId,
          username,
          action: 'login',
          resourceType: 'authentication',
          resourceId: userId,
          details: {
            method: req.method,
            url: req.originalUrl,
            success: true
          },
          ipAddress,
          userAgent
        });

        next();
      } catch (error) {
        console.error('Error registrando login:', error);
        next();
      }
    };
  }

  // Middleware para registrar logout
  logLogout() {
    return async (req, res, next) => {
      try {
        const userId = req.session?.userId || null;
        const username = req.session?.username || 'unknown';
        const ipAddress = req.ip || req.connection.remoteAddress;
        const userAgent = req.get('User-Agent');

        await this.auditModel.logAction({
          userId,
          username,
          action: 'logout',
          resourceType: 'authentication',
          resourceId: userId,
          details: {
            method: req.method,
            url: req.originalUrl
          },
          ipAddress,
          userAgent
        });

        next();
      } catch (error) {
        console.error('Error registrando logout:', error);
        next();
      }
    };
  }

  // Middleware para registrar intentos de acceso no autorizado
  logUnauthorizedAccess() {
    return async (req, res, next) => {
      try {
        const ipAddress = req.ip || req.connection.remoteAddress;
        const userAgent = req.get('User-Agent');

        await this.auditModel.logAction({
          userId: null,
          username: 'unauthorized',
          action: 'unauthorized_access',
          resourceType: 'security',
          resourceId: null,
          details: {
            method: req.method,
            url: req.originalUrl,
            reason: 'Authentication required'
          },
          ipAddress,
          userAgent
        });

        next();
      } catch (error) {
        console.error('Error registrando acceso no autorizado:', error);
        next();
      }
    };
  }

  // Middleware para registrar errores
  logError(error, req) {
    return async (req, res, next) => {
      try {
        const userId = req.session?.userId || null;
        const username = req.session?.username || 'unknown';
        const ipAddress = req.ip || req.connection.remoteAddress;
        const userAgent = req.get('User-Agent');

        await this.auditModel.logAction({
          userId,
          username,
          action: 'error',
          resourceType: 'system',
          resourceId: null,
          details: {
            method: req.method,
            url: req.originalUrl,
            error: error.message,
            stack: error.stack
          },
          ipAddress,
          userAgent
        });

        next();
      } catch (auditError) {
        console.error('Error registrando error en auditoría:', auditError);
        next();
      }
    };
  }

  // Función helper para registrar acciones manualmente
  async logManualAction(req, action, resourceType = null, resourceId = null, details = null) {
    try {
      const userId = req.session?.userId || null;
      const username = req.session?.username || 'system';
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.get('User-Agent');

      await this.auditModel.logAction({
        userId,
        username,
        action,
        resourceType,
        resourceId,
        details,
        ipAddress,
        userAgent
      });
    } catch (error) {
      console.error('Error registrando acción manual:', error);
    }
  }

  // Middleware para obtener estadísticas de auditoría
  async getAuditStats(req, res, next) {
    try {
      const filters = {
        startDate: req.query.startDate || null,
        endDate: req.query.endDate || null
      };

      const stats = await this.auditModel.getAuditStats(filters);
      req.auditStats = stats;
      next();
    } catch (error) {
      console.error('Error obteniendo estadísticas de auditoría:', error);
      req.auditStats = null;
      next();
    }
  }

  // Middleware para obtener logs de auditoría
  async getAuditLogs(req, res, next) {
    try {
      const filters = {
        userId: req.query.userId || null,
        action: req.query.action || null,
        resourceType: req.query.resourceType || null,
        startDate: req.query.startDate || null,
        endDate: req.query.endDate || null,
        limit: parseInt(req.query.limit) || 100,
        offset: parseInt(req.query.offset) || 0
      };

      const logs = await this.auditModel.getAuditLogs(filters);
      req.auditLogs = logs;
      next();
    } catch (error) {
      console.error('Error obteniendo logs de auditoría:', error);
      req.auditLogs = [];
      next();
    }
  }
}

module.exports = AuditMiddleware;
