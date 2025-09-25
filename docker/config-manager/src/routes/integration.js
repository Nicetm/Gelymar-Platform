const express = require('express');
const router = express.Router();
const IntegrationService = require('../services/integration.service');
const RoleMiddleware = require('../middleware/role.middleware');
const AuditMiddleware = require('../middleware/audit.middleware');

const integrationService = new IntegrationService();
const roleMiddleware = new RoleMiddleware();
const auditMiddleware = new AuditMiddleware();

// Aplicar middleware de autenticación a todas las rutas
router.use(require('../middleware/auth').requireAuth);

// Verificar salud de todos los servicios
router.get('/health/all',
  roleMiddleware.requirePermission('integration.read'),
  async (req, res) => {
    try {
      const health = await integrationService.checkAllServicesHealth();

      res.json({
        success: true,
        data: health
      });
    } catch (error) {
      console.error('Error verificando salud de servicios:', error);
      res.status(500).json({
        success: false,
        message: 'Error verificando salud de servicios',
        error: error.message
      });
    }
  }
);

// Verificar salud de un servicio específico
router.get('/health/:serviceId',
  roleMiddleware.requirePermission('integration.read'),
  async (req, res) => {
    try {
      const { serviceId } = req.params;
      const health = await integrationService.checkServiceHealth(serviceId);

      res.json({
        success: true,
        data: health
      });
    } catch (error) {
      console.error('Error verificando salud del servicio:', error);
      res.status(500).json({
        success: false,
        message: 'Error verificando salud del servicio',
        error: error.message
      });
    }
  }
);

// Sincronizar datos entre servicios
router.post('/sync',
  roleMiddleware.requirePermission('integration.sync'),
  auditMiddleware.logAction('integration_sync', 'integration'),
  async (req, res) => {
    try {
      const {
        sourceService,
        targetService,
        dataType
      } = req.body;

      const result = await integrationService.syncDataBetweenServices(
        sourceService,
        targetService,
        dataType
      );

      // Registrar acción de auditoría
      await auditMiddleware.logManualAction(req, 'integration_sync', 'integration', null, {
        sourceService,
        targetService,
        dataType,
        recordsProcessed: result.recordsProcessed
      });

      res.json({
        success: true,
        data: result,
        message: 'Sincronización completada exitosamente'
      });
    } catch (error) {
      console.error('Error en sincronización:', error);
      res.status(500).json({
        success: false,
        message: 'Error en sincronización',
        error: error.message
      });
    }
  }
);

// Ejecutar acción en servicio remoto
router.post('/action/:serviceId/:action',
  roleMiddleware.requirePermission('integration.execute'),
  auditMiddleware.logAction('integration_action', 'integration'),
  async (req, res) => {
    try {
      const { serviceId, action } = req.params;
      const params = req.body;

      const result = await integrationService.executeRemoteAction(serviceId, action, params);

      // Registrar acción de auditoría
      await auditMiddleware.logManualAction(req, 'integration_action', 'integration', serviceId, {
        action,
        params
      });

      res.json({
        success: true,
        data: result,
        message: `Acción ${action} ejecutada en ${serviceId}`
      });
    } catch (error) {
      console.error('Error ejecutando acción remota:', error);
      res.status(500).json({
        success: false,
        message: 'Error ejecutando acción remota',
        error: error.message
      });
    }
  }
);

// Obtener métricas de servicios
router.get('/metrics',
  roleMiddleware.requirePermission('integration.read'),
  async (req, res) => {
    try {
      const metrics = await integrationService.getServicesMetrics();

      res.json({
        success: true,
        data: metrics
      });
    } catch (error) {
      console.error('Error obteniendo métricas de servicios:', error);
      res.status(500).json({
        success: false,
        message: 'Error obteniendo métricas de servicios',
        error: error.message
      });
    }
  }
);

// Configurar webhook
router.post('/webhook/:serviceId',
  roleMiddleware.requirePermission('integration.configure'),
  auditMiddleware.logAction('integration_webhook_setup', 'integration'),
  async (req, res) => {
    try {
      const { serviceId } = req.params;
      const { webhookUrl, events } = req.body;

      const result = await integrationService.setupWebhook(serviceId, webhookUrl, events);

      // Registrar acción de auditoría
      await auditMiddleware.logManualAction(req, 'integration_webhook_setup', 'integration', serviceId, {
        webhookUrl,
        events
      });

      res.json({
        success: true,
        data: result,
        message: 'Webhook configurado exitosamente'
      });
    } catch (error) {
      console.error('Error configurando webhook:', error);
      res.status(500).json({
        success: false,
        message: 'Error configurando webhook',
        error: error.message
      });
    }
  }
);

// Procesar webhook recibido
router.post('/webhook/receive/:serviceId',
  async (req, res) => {
    try {
      const { serviceId } = req.params;
      const payload = req.body;
      const signature = req.headers['x-webhook-signature'];

      const result = await integrationService.processWebhook(serviceId, payload, signature);

      res.json({
        success: true,
        data: result,
        message: 'Webhook procesado exitosamente'
      });
    } catch (error) {
      console.error('Error procesando webhook:', error);
      res.status(500).json({
        success: false,
        message: 'Error procesando webhook',
        error: error.message
      });
    }
  }
);

// Obtener logs de servicio
router.get('/logs/:serviceId',
  roleMiddleware.requirePermission('integration.read'),
  async (req, res) => {
    try {
      const { serviceId } = req.params;
      const { lines = 100 } = req.query;

      const logs = await integrationService.getServiceLogs(serviceId, lines);

      res.json({
        success: true,
        data: logs
      });
    } catch (error) {
      console.error('Error obteniendo logs del servicio:', error);
      res.status(500).json({
        success: false,
        message: 'Error obteniendo logs del servicio',
        error: error.message
      });
    }
  }
);

// Reiniciar servicio remoto
router.post('/restart/:serviceId',
  roleMiddleware.requirePermission('integration.manage'),
  auditMiddleware.logAction('integration_restart', 'integration'),
  async (req, res) => {
    try {
      const { serviceId } = req.params;

      const result = await integrationService.restartRemoteService(serviceId);

      // Registrar acción de auditoría
      await auditMiddleware.logManualAction(req, 'integration_restart', 'integration', serviceId);

      res.json({
        success: true,
        data: result,
        message: `Servicio ${serviceId} reiniciado exitosamente`
      });
    } catch (error) {
      console.error('Error reiniciando servicio remoto:', error);
      res.status(500).json({
        success: false,
        message: 'Error reiniciando servicio remoto',
        error: error.message
      });
    }
  }
);

// Obtener configuración de servicio remoto
router.get('/config/:serviceId',
  roleMiddleware.requirePermission('integration.read'),
  async (req, res) => {
    try {
      const { serviceId } = req.params;

      const config = await integrationService.getRemoteServiceConfig(serviceId);

      res.json({
        success: true,
        data: config
      });
    } catch (error) {
      console.error('Error obteniendo configuración del servicio:', error);
      res.status(500).json({
        success: false,
        message: 'Error obteniendo configuración del servicio',
        error: error.message
      });
    }
  }
);

// Actualizar configuración de servicio remoto
router.put('/config/:serviceId',
  roleMiddleware.requirePermission('integration.configure'),
  auditMiddleware.logAction('integration_config_update', 'integration'),
  async (req, res) => {
    try {
      const { serviceId } = req.params;
      const config = req.body;

      const result = await integrationService.updateRemoteServiceConfig(serviceId, config);

      // Registrar acción de auditoría
      await auditMiddleware.logManualAction(req, 'integration_config_update', 'integration', serviceId, {
        configKeys: Object.keys(config)
      });

      res.json({
        success: true,
        data: result,
        message: `Configuración de ${serviceId} actualizada exitosamente`
      });
    } catch (error) {
      console.error('Error actualizando configuración del servicio:', error);
      res.status(500).json({
        success: false,
        message: 'Error actualizando configuración del servicio',
        error: error.message
      });
    }
  }
);

// Obtener estadísticas de integración
router.get('/stats',
  roleMiddleware.requirePermission('integration.read'),
  async (req, res) => {
    try {
      const stats = integrationService.getIntegrationStats();

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error obteniendo estadísticas de integración:', error);
      res.status(500).json({
        success: false,
        message: 'Error obteniendo estadísticas de integración',
        error: error.message
      });
    }
  }
);

// Obtener datos de un servicio específico
router.get('/data/:serviceId/:dataType',
  roleMiddleware.requirePermission('integration.read'),
  async (req, res) => {
    try {
      const { serviceId, dataType } = req.params;

      const data = await integrationService.getDataFromService(serviceId, dataType);

      res.json({
        success: true,
        data: {
          service: serviceId,
          dataType,
          records: data,
          count: Array.isArray(data) ? data.length : 1,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error obteniendo datos del servicio:', error);
      res.status(500).json({
        success: false,
        message: 'Error obteniendo datos del servicio',
        error: error.message
      });
    }
  }
);

// Enviar datos a un servicio específico
router.post('/data/:serviceId/:dataType',
  roleMiddleware.requirePermission('integration.write'),
  auditMiddleware.logAction('integration_data_send', 'integration'),
  async (req, res) => {
    try {
      const { serviceId, dataType } = req.params;
      const data = req.body;

      const result = await integrationService.sendDataToService(serviceId, dataType, data);

      // Registrar acción de auditoría
      await auditMiddleware.logManualAction(req, 'integration_data_send', 'integration', serviceId, {
        dataType,
        recordCount: Array.isArray(data) ? data.length : 1
      });

      res.json({
        success: true,
        data: result,
        message: `Datos enviados a ${serviceId} exitosamente`
      });
    } catch (error) {
      console.error('Error enviando datos al servicio:', error);
      res.status(500).json({
        success: false,
        message: 'Error enviando datos al servicio',
        error: error.message
      });
    }
  }
);

// Obtener lista de servicios disponibles
router.get('/services',
  roleMiddleware.requirePermission('integration.read'),
  async (req, res) => {
    try {
      const services = Array.from(integrationService.services.entries()).map(([id, service]) => ({
        id,
        name: service.name,
        baseUrl: service.baseUrl,
        endpoints: Object.keys(service.endpoints),
        timeout: service.timeout
      }));

      res.json({
        success: true,
        data: services
      });
    } catch (error) {
      console.error('Error obteniendo lista de servicios:', error);
      res.status(500).json({
        success: false,
        message: 'Error obteniendo lista de servicios',
        error: error.message
      });
    }
  }
);

module.exports = router;
