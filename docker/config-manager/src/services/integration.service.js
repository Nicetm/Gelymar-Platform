const axios = require('axios');
const winston = require('winston');

class IntegrationService {
  constructor() {
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.simple()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/integrations.log' })
      ]
    });

    this.services = new Map();
    this.initializeServices();
  }

  // Inicializar servicios integrados
  initializeServices() {
    this.services.set('gelymar-backend', {
      name: 'Gelymar Backend API',
      baseUrl: process.env.BACKEND_URL || 'http://localhost:3000',
      endpoints: {
        health: '/api/health',
        orders: '/api/orders',
        customers: '/api/customers',
        items: '/api/items',
        auth: '/api/auth'
      },
      timeout: 10000,
      retries: 3
    });

    this.services.set('gelymar-frontend', {
      name: 'Gelymar Frontend',
      baseUrl: process.env.FRONTEND_URL || 'http://localhost:2121',
      endpoints: {
        health: '/health',
        status: '/status'
      },
      timeout: 5000,
      retries: 2
    });

    this.services.set('gelymar-fileserver', {
      name: 'Gelymar File Server',
      baseUrl: process.env.FILESERVER_URL || 'http://localhost:8080',
      endpoints: {
        health: '/health',
        files: '/api/files',
        upload: '/api/upload'
      },
      timeout: 15000,
      retries: 3
    });

    this.services.set('gelymar-cron', {
      name: 'Gelymar Cron Jobs',
      baseUrl: process.env.CRON_URL || 'http://localhost:3001',
      endpoints: {
        health: '/health',
        jobs: '/api/jobs',
        status: '/api/status'
      },
      timeout: 10000,
      retries: 2
    });

    this.logger.info('Servicios de integración inicializados');
  }

  // Verificar salud de todos los servicios
  async checkAllServicesHealth() {
    const results = {
      timestamp: new Date().toISOString(),
      services: {},
      summary: {
        total: 0,
        healthy: 0,
        unhealthy: 0,
        unknown: 0
      }
    };

    for (const [serviceId, service] of this.services.entries()) {
      try {
        const health = await this.checkServiceHealth(serviceId);
        results.services[serviceId] = health;
        results.summary.total++;
        
        if (health.status === 'healthy') {
          results.summary.healthy++;
        } else if (health.status === 'unhealthy') {
          results.summary.unhealthy++;
        } else {
          results.summary.unknown++;
        }
      } catch (error) {
        results.services[serviceId] = {
          status: 'error',
          error: error.message,
          timestamp: new Date().toISOString()
        };
        results.summary.total++;
        results.summary.unknown++;
      }
    }

    return results;
  }

  // Verificar salud de un servicio específico
  async checkServiceHealth(serviceId) {
    const service = this.services.get(serviceId);
    if (!service) {
      throw new Error(`Servicio no encontrado: ${serviceId}`);
    }

    try {
      const startTime = Date.now();
      const response = await axios.get(
        `${service.baseUrl}${service.endpoints.health}`,
        { timeout: service.timeout }
      );
      const responseTime = Date.now() - startTime;

      return {
        serviceId,
        name: service.name,
        status: response.status === 200 ? 'healthy' : 'unhealthy',
        responseTime,
        statusCode: response.status,
        timestamp: new Date().toISOString(),
        data: response.data
      };
    } catch (error) {
      return {
        serviceId,
        name: service.name,
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  // Sincronizar datos entre servicios
  async syncDataBetweenServices(sourceService, targetService, dataType) {
    try {
      this.logger.info(`Iniciando sincronización: ${sourceService} -> ${targetService} (${dataType})`);

      const source = this.services.get(sourceService);
      const target = this.services.get(targetService);

      if (!source || !target) {
        throw new Error('Servicio fuente o destino no encontrado');
      }

      // Obtener datos del servicio fuente
      const sourceData = await this.getDataFromService(sourceService, dataType);
      
      // Enviar datos al servicio destino
      const result = await this.sendDataToService(targetService, dataType, sourceData);

      this.logger.info(`Sincronización completada: ${sourceService} -> ${targetService}`);
      
      return {
        success: true,
        source: sourceService,
        target: targetService,
        dataType,
        recordsProcessed: sourceData.length,
        result
      };
    } catch (error) {
      this.logger.error('Error en sincronización:', error);
      throw error;
    }
  }

  // Obtener datos de un servicio
  async getDataFromService(serviceId, dataType) {
    const service = this.services.get(serviceId);
    if (!service) {
      throw new Error(`Servicio no encontrado: ${serviceId}`);
    }

    const endpoint = service.endpoints[dataType];
    if (!endpoint) {
      throw new Error(`Endpoint no encontrado: ${dataType} en ${serviceId}`);
    }

    try {
      const response = await axios.get(
        `${service.baseUrl}${endpoint}`,
        { timeout: service.timeout }
      );

      return response.data.data || response.data;
    } catch (error) {
      this.logger.error(`Error obteniendo datos de ${serviceId}:`, error);
      throw error;
    }
  }

  // Enviar datos a un servicio
  async sendDataToService(serviceId, dataType, data) {
    const service = this.services.get(serviceId);
    if (!service) {
      throw new Error(`Servicio no encontrado: ${serviceId}`);
    }

    const endpoint = service.endpoints[dataType];
    if (!endpoint) {
      throw new Error(`Endpoint no encontrado: ${dataType} en ${serviceId}`);
    }

    try {
      const response = await axios.post(
        `${service.baseUrl}${endpoint}`,
        data,
        { timeout: service.timeout }
      );

      return response.data;
    } catch (error) {
      this.logger.error(`Error enviando datos a ${serviceId}:`, error);
      throw error;
    }
  }

  // Ejecutar acción en servicio remoto
  async executeRemoteAction(serviceId, action, params = {}) {
    const service = this.services.get(serviceId);
    if (!service) {
      throw new Error(`Servicio no encontrado: ${serviceId}`);
    }

    try {
      const endpoint = service.endpoints[action] || `/api/${action}`;
      
      const response = await axios.post(
        `${service.baseUrl}${endpoint}`,
        params,
        { timeout: service.timeout }
      );

      this.logger.info(`Acción ejecutada en ${serviceId}: ${action}`);
      
      return {
        success: true,
        service: serviceId,
        action,
        result: response.data
      };
    } catch (error) {
      this.logger.error(`Error ejecutando acción en ${serviceId}:`, error);
      throw error;
    }
  }

  // Obtener métricas de servicios
  async getServicesMetrics() {
    const metrics = {
      timestamp: new Date().toISOString(),
      services: {}
    };

    for (const [serviceId, service] of this.services.entries()) {
      try {
        const health = await this.checkServiceHealth(serviceId);
        metrics.services[serviceId] = {
          ...health,
          baseUrl: service.baseUrl,
          timeout: service.timeout
        };
      } catch (error) {
        metrics.services[serviceId] = {
          serviceId,
          name: service.name,
          status: 'error',
          error: error.message,
          baseUrl: service.baseUrl,
          timestamp: new Date().toISOString()
        };
      }
    }

    return metrics;
  }

  // Configurar webhook para notificaciones
  async setupWebhook(serviceId, webhookUrl, events = []) {
    try {
      const service = this.services.get(serviceId);
      if (!service) {
        throw new Error(`Servicio no encontrado: ${serviceId}`);
      }

      const webhookConfig = {
        url: webhookUrl,
        events: events,
        secret: this.generateWebhookSecret(),
        active: true
      };

      // Enviar configuración al servicio
      const response = await axios.post(
        `${service.baseUrl}/api/webhooks`,
        webhookConfig,
        { timeout: service.timeout }
      );

      this.logger.info(`Webhook configurado para ${serviceId}: ${webhookUrl}`);
      
      return {
        success: true,
        service: serviceId,
        webhook: webhookConfig,
        result: response.data
      };
    } catch (error) {
      this.logger.error(`Error configurando webhook para ${serviceId}:`, error);
      throw error;
    }
  }

  // Generar secreto para webhook
  generateWebhookSecret() {
    const crypto = require('crypto');
    return crypto.randomBytes(32).toString('hex');
  }

  // Procesar webhook recibido
  async processWebhook(serviceId, payload, signature) {
    try {
      // Verificar firma del webhook
      const isValid = this.verifyWebhookSignature(payload, signature);
      if (!isValid) {
        throw new Error('Firma de webhook inválida');
      }

      const event = payload.event;
      const data = payload.data;

      this.logger.info(`Webhook recibido de ${serviceId}: ${event}`);

      // Procesar evento según el tipo
      switch (event) {
        case 'container.status.changed':
          await this.handleContainerStatusChange(data);
          break;
        case 'order.created':
          await this.handleOrderCreated(data);
          break;
        case 'customer.updated':
          await this.handleCustomerUpdated(data);
          break;
        case 'system.alert':
          await this.handleSystemAlert(data);
          break;
        default:
          this.logger.warn(`Evento de webhook no manejado: ${event}`);
      }

      return {
        success: true,
        event,
        processed: true
      };
    } catch (error) {
      this.logger.error('Error procesando webhook:', error);
      throw error;
    }
  }

  // Verificar firma de webhook
  verifyWebhookSignature(payload, signature) {
    const crypto = require('crypto');
    const secret = process.env.WEBHOOK_SECRET || 'default-secret';
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex');
    
    return signature === expectedSignature;
  }

  // Manejadores de eventos de webhook
  async handleContainerStatusChange(data) {
    this.logger.info('Manejando cambio de estado de contenedor:', data);
    // Implementar lógica específica
  }

  async handleOrderCreated(data) {
    this.logger.info('Manejando orden creada:', data);
    // Implementar lógica específica
  }

  async handleCustomerUpdated(data) {
    this.logger.info('Manejando cliente actualizado:', data);
    // Implementar lógica específica
  }

  async handleSystemAlert(data) {
    this.logger.info('Manejando alerta del sistema:', data);
    // Implementar lógica específica
  }

  // Obtener logs de servicios
  async getServiceLogs(serviceId, lines = 100) {
    try {
      const service = this.services.get(serviceId);
      if (!service) {
        throw new Error(`Servicio no encontrado: ${serviceId}`);
      }

      const response = await axios.get(
        `${service.baseUrl}/api/logs?lines=${lines}`,
        { timeout: service.timeout }
      );

      return {
        service: serviceId,
        logs: response.data.logs || response.data,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error(`Error obteniendo logs de ${serviceId}:`, error);
      throw error;
    }
  }

  // Reiniciar servicio remoto
  async restartRemoteService(serviceId) {
    try {
      const result = await this.executeRemoteAction(serviceId, 'restart');
      this.logger.info(`Servicio ${serviceId} reiniciado exitosamente`);
      return result;
    } catch (error) {
      this.logger.error(`Error reiniciando servicio ${serviceId}:`, error);
      throw error;
    }
  }

  // Obtener configuración de servicio remoto
  async getRemoteServiceConfig(serviceId) {
    try {
      const service = this.services.get(serviceId);
      if (!service) {
        throw new Error(`Servicio no encontrado: ${serviceId}`);
      }

      const response = await axios.get(
        `${service.baseUrl}/api/config`,
        { timeout: service.timeout }
      );

      return {
        service: serviceId,
        config: response.data,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error(`Error obteniendo configuración de ${serviceId}:`, error);
      throw error;
    }
  }

  // Actualizar configuración de servicio remoto
  async updateRemoteServiceConfig(serviceId, config) {
    try {
      const service = this.services.get(serviceId);
      if (!service) {
        throw new Error(`Servicio no encontrado: ${serviceId}`);
      }

      const response = await axios.put(
        `${service.baseUrl}/api/config`,
        config,
        { timeout: service.timeout }
      );

      this.logger.info(`Configuración actualizada para ${serviceId}`);
      
      return {
        success: true,
        service: serviceId,
        result: response.data
      };
    } catch (error) {
      this.logger.error(`Error actualizando configuración de ${serviceId}:`, error);
      throw error;
    }
  }

  // Obtener estadísticas de integración
  getIntegrationStats() {
    return {
      totalServices: this.services.size,
      services: Array.from(this.services.keys()),
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = IntegrationService;
