const express = require('express');
const router = express.Router();
const AuditModel = require('../models/audit.model');
const RoleMiddleware = require('../middleware/role.middleware');
const AuditMiddleware = require('../middleware/audit.middleware');

const auditModel = new AuditModel();
const roleMiddleware = new RoleMiddleware();
const auditMiddleware = new AuditMiddleware();

// Aplicar middleware de autenticación a todas las rutas
router.use(require('../middleware/auth').requireAuth);

// Obtener logs de auditoría
router.get('/logs',
  roleMiddleware.requirePermission('audit.read'),
  auditMiddleware.getAuditLogs,
  async (req, res) => {
    try {
      res.json({
        success: true,
        data: req.auditLogs
      });
    } catch (error) {
      console.error('Error obteniendo logs de auditoría:', error);
      res.status(500).json({
        success: false,
        message: 'Error obteniendo logs de auditoría',
        error: error.message
      });
    }
  }
);

// Obtener estadísticas de auditoría
router.get('/stats',
  roleMiddleware.requirePermission('audit.read'),
  auditMiddleware.getAuditStats,
  async (req, res) => {
    try {
      res.json({
        success: true,
        data: req.auditStats
      });
    } catch (error) {
      console.error('Error obteniendo estadísticas de auditoría:', error);
      res.status(500).json({
        success: false,
        message: 'Error obteniendo estadísticas de auditoría',
        error: error.message
      });
    }
  }
);

// Obtener acciones más frecuentes
router.get('/top-actions',
  roleMiddleware.requirePermission('audit.read'),
  async (req, res) => {
    try {
      const filters = {
        startDate: req.query.startDate || null,
        endDate: req.query.endDate || null
      };

      const limit = parseInt(req.query.limit) || 10;
      const topActions = await auditModel.getTopActions(limit, filters);

      res.json({
        success: true,
        data: topActions
      });
    } catch (error) {
      console.error('Error obteniendo acciones más frecuentes:', error);
      res.status(500).json({
        success: false,
        message: 'Error obteniendo acciones más frecuentes',
        error: error.message
      });
    }
  }
);

// Obtener usuarios más activos
router.get('/top-users',
  roleMiddleware.requirePermission('audit.read'),
  async (req, res) => {
    try {
      const filters = {
        startDate: req.query.startDate || null,
        endDate: req.query.endDate || null
      };

      const limit = parseInt(req.query.limit) || 10;
      const topUsers = await auditModel.getTopUsers(limit, filters);

      res.json({
        success: true,
        data: topUsers
      });
    } catch (error) {
      console.error('Error obteniendo usuarios más activos:', error);
      res.status(500).json({
        success: false,
        message: 'Error obteniendo usuarios más activos',
        error: error.message
      });
    }
  }
);

// Obtener actividad por hora del día
router.get('/activity/hourly',
  roleMiddleware.requirePermission('audit.read'),
  async (req, res) => {
    try {
      const filters = {
        startDate: req.query.startDate || null,
        endDate: req.query.endDate || null
      };

      const activity = await auditModel.getActivityByHour(filters);

      res.json({
        success: true,
        data: activity
      });
    } catch (error) {
      console.error('Error obteniendo actividad por hora:', error);
      res.status(500).json({
        success: false,
        message: 'Error obteniendo actividad por hora',
        error: error.message
      });
    }
  }
);

// Obtener actividad por día
router.get('/activity/daily',
  roleMiddleware.requirePermission('audit.read'),
  async (req, res) => {
    try {
      const filters = {
        startDate: req.query.startDate || null,
        endDate: req.query.endDate || null,
        days: parseInt(req.query.days) || 30
      };

      const activity = await auditModel.getActivityByDay(filters);

      res.json({
        success: true,
        data: activity
      });
    } catch (error) {
      console.error('Error obteniendo actividad por día:', error);
      res.status(500).json({
        success: false,
        message: 'Error obteniendo actividad por día',
        error: error.message
      });
    }
  }
);

// Obtener logs de un usuario específico
router.get('/user/:userId',
  roleMiddleware.requirePermission('audit.read'),
  async (req, res) => {
    try {
      const userId = req.params.userId;
      
      // Verificar si el usuario puede acceder a estos logs
      if (req.user.role !== 'admin' && req.user.id !== parseInt(userId)) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para acceder a estos logs'
        });
      }

      const filters = {
        userId: userId,
        startDate: req.query.startDate || null,
        endDate: req.query.endDate || null,
        limit: parseInt(req.query.limit) || 100,
        offset: parseInt(req.query.offset) || 0
      };

      const logs = await auditModel.getAuditLogs(filters);

      res.json({
        success: true,
        data: logs
      });
    } catch (error) {
      console.error('Error obteniendo logs del usuario:', error);
      res.status(500).json({
        success: false,
        message: 'Error obteniendo logs del usuario',
        error: error.message
      });
    }
  }
);

// Obtener logs de una acción específica
router.get('/action/:action',
  roleMiddleware.requirePermission('audit.read'),
  async (req, res) => {
    try {
      const action = req.params.action;

      const filters = {
        action: action,
        startDate: req.query.startDate || null,
        endDate: req.query.endDate || null,
        limit: parseInt(req.query.limit) || 100,
        offset: parseInt(req.query.offset) || 0
      };

      const logs = await auditModel.getAuditLogs(filters);

      res.json({
        success: true,
        data: logs
      });
    } catch (error) {
      console.error('Error obteniendo logs de la acción:', error);
      res.status(500).json({
        success: false,
        message: 'Error obteniendo logs de la acción',
        error: error.message
      });
    }
  }
);

// Obtener logs de un recurso específico
router.get('/resource/:resourceType/:resourceId',
  roleMiddleware.requirePermission('audit.read'),
  async (req, res) => {
    try {
      const { resourceType, resourceId } = req.params;

      const filters = {
        resourceType: resourceType,
        resourceId: resourceId,
        startDate: req.query.startDate || null,
        endDate: req.query.endDate || null,
        limit: parseInt(req.query.limit) || 100,
        offset: parseInt(req.query.offset) || 0
      };

      const logs = await auditModel.getAuditLogs(filters);

      res.json({
        success: true,
        data: logs
      });
    } catch (error) {
      console.error('Error obteniendo logs del recurso:', error);
      res.status(500).json({
        success: false,
        message: 'Error obteniendo logs del recurso',
        error: error.message
      });
    }
  }
);

// Limpiar logs antiguos (solo admin)
router.delete('/cleanup',
  roleMiddleware.requireRole('admin'),
  auditMiddleware.logAction('audit_cleanup', 'audit'),
  async (req, res) => {
    try {
      const daysToKeep = parseInt(req.body.daysToKeep) || 90;

      if (daysToKeep < 7) {
        return res.status(400).json({
          success: false,
          message: 'No se pueden eliminar logs de menos de 7 días'
        });
      }

      const deletedCount = await auditModel.cleanOldLogs(daysToKeep);

      // Registrar acción de auditoría
      await auditMiddleware.logManualAction(req, 'audit_cleanup', 'audit', null, {
        daysToKeep,
        deletedCount
      });

      res.json({
        success: true,
        data: { deletedCount },
        message: `${deletedCount} logs eliminados exitosamente`
      });
    } catch (error) {
      console.error('Error limpiando logs antiguos:', error);
      res.status(500).json({
        success: false,
        message: 'Error limpiando logs antiguos',
        error: error.message
      });
    }
  }
);

// Exportar logs de auditoría (solo admin)
router.get('/export',
  roleMiddleware.requireRole('admin'),
  auditMiddleware.logAction('audit_export', 'audit'),
  async (req, res) => {
    try {
      const filters = {
        startDate: req.query.startDate || null,
        endDate: req.query.endDate || null,
        limit: parseInt(req.query.limit) || 10000
      };

      const logs = await auditModel.getAuditLogs(filters);

      // Convertir a CSV
      const csvHeader = 'ID,Usuario,Acción,Tipo de Recurso,ID de Recurso,IP,Timestamp,Detalles\n';
      const csvRows = logs.map(log => {
        const details = log.details ? JSON.stringify(log.details).replace(/"/g, '""') : '';
        return `${log.id},"${log.username}","${log.action}","${log.resource_type || ''}","${log.resource_id || ''}","${log.ip_address || ''}","${log.timestamp}","${details}"`;
      }).join('\n');

      const csvContent = csvHeader + csvRows;

      // Registrar acción de auditoría
      await auditMiddleware.logManualAction(req, 'audit_export', 'audit', null, {
        recordCount: logs.length,
        filters
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="audit_logs_${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csvContent);
    } catch (error) {
      console.error('Error exportando logs de auditoría:', error);
      res.status(500).json({
        success: false,
        message: 'Error exportando logs de auditoría',
        error: error.message
      });
    }
  }
);

// Obtener resumen de seguridad
router.get('/security/summary',
  roleMiddleware.requirePermission('audit.read'),
  async (req, res) => {
    try {
      const filters = {
        startDate: req.query.startDate || null,
        endDate: req.query.endDate || null
      };

      // Obtener estadísticas de seguridad
      const [stats, topActions, topUsers] = await Promise.all([
        auditModel.getAuditStats(filters),
        auditModel.getTopActions(5, filters),
        auditModel.getTopUsers(5, filters)
      ]);

      // Obtener intentos de acceso no autorizado
      const unauthorizedLogs = await auditModel.getAuditLogs({
        action: 'unauthorized_access',
        startDate: filters.startDate,
        endDate: filters.endDate,
        limit: 10
      });

      // Obtener errores recientes
      const errorLogs = await auditModel.getAuditLogs({
        action: 'error',
        startDate: filters.startDate,
        endDate: filters.endDate,
        limit: 10
      });

      res.json({
        success: true,
        data: {
          stats,
          topActions,
          topUsers,
          security: {
            unauthorizedAttempts: unauthorizedLogs,
            recentErrors: errorLogs
          }
        }
      });
    } catch (error) {
      console.error('Error obteniendo resumen de seguridad:', error);
      res.status(500).json({
        success: false,
        message: 'Error obteniendo resumen de seguridad',
        error: error.message
      });
    }
  }
);

module.exports = router;
