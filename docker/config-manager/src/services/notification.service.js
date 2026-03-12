const nodemailer = require('nodemailer');
const winston = require('winston');

class NotificationService {
  constructor() {
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.simple()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/notifications.log' })
      ]
    });

    this.transporter = null;
    this.initializeEmail();
  }

  // Inicializar servicio de email
  initializeEmail() {
    try {
      this.transporter = nodemailer.createTransporter({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: process.env.SMTP_PORT || 587,
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });

      this.logger.info('Servicio de notificaciones inicializado');
    } catch (error) {
      this.logger.error('Error inicializando servicio de email:', error);
    }
  }

  // Enviar notificación por email
  async sendEmailNotification(notification) {
    try {
      const {
        to,
        subject,
        html,
        text,
        priority = 'normal'
      } = notification;

      if (!this.transporter) {
        throw new Error('Servicio de email no inicializado');
      }

      const mailOptions = {
        from: process.env.SMTP_FROM || 'noreply@gelymar.com',
        to: Array.isArray(to) ? to.join(', ') : to,
        subject: `[Gelymar Config Manager] ${subject}`,
        html: html,
        text: text,
        priority: priority === 'high' ? 'high' : 'normal'
      };

      const result = await this.transporter.sendMail(mailOptions);
      
      this.logger.info(`Email enviado exitosamente a ${to}`, {
        messageId: result.messageId,
        subject
      });

      return {
        success: true,
        messageId: result.messageId
      };
    } catch (error) {
      this.logger.error('Error enviando email:', error);
      throw error;
    }
  }

  // Enviar notificación de sistema
  async sendSystemNotification(type, data) {
    try {
      const notification = this.formatSystemNotification(type, data);
      
      // Enviar por email si está configurado
      if (process.env.NOTIFICATION_EMAIL) {
        await this.sendEmailNotification({
          to: process.env.NOTIFICATION_EMAIL,
          subject: notification.subject,
          html: notification.html,
          text: notification.text,
          priority: notification.priority
        });
      }

      // Log de la notificación
      this.logger.info(`Notificación de sistema enviada: ${type}`, data);

      return {
        success: true,
        type,
        data
      };
    } catch (error) {
      this.logger.error('Error enviando notificación de sistema:', error);
      throw error;
    }
  }

  // Formatear notificación de sistema
  formatSystemNotification(type, data) {
    const timestamp = new Date().toLocaleString('es-ES');
    
    switch (type) {
      case 'container_down':
        return {
          subject: `🚨 Contenedor caído: ${data.container}`,
          html: `
            <h2>🚨 Alerta de Sistema</h2>
            <p><strong>Contenedor caído:</strong> ${data.container}</p>
            <p><strong>Estado:</strong> ${data.status}</p>
            <p><strong>Timestamp:</strong> ${timestamp}</p>
            <p><strong>Acción requerida:</strong> Verificar y reiniciar el contenedor</p>
          `,
          text: `Contenedor caído: ${data.container} - Estado: ${data.status} - ${timestamp}`,
          priority: 'high'
        };

      case 'high_cpu_usage':
        return {
          subject: `⚠️ Alto uso de CPU: ${data.container}`,
          html: `
            <h2>⚠️ Alerta de Rendimiento</h2>
            <p><strong>Contenedor:</strong> ${data.container}</p>
            <p><strong>Uso de CPU:</strong> ${data.cpu}%</p>
            <p><strong>Uso de Memoria:</strong> ${data.memory}%</p>
            <p><strong>Timestamp:</strong> ${timestamp}</p>
          `,
          text: `Alto uso de CPU en ${data.container}: ${data.cpu}% - ${timestamp}`,
          priority: 'normal'
        };

      case 'high_memory_usage':
        return {
          subject: `⚠️ Alto uso de Memoria: ${data.container}`,
          html: `
            <h2>⚠️ Alerta de Rendimiento</h2>
            <p><strong>Contenedor:</strong> ${data.container}</p>
            <p><strong>Uso de Memoria:</strong> ${data.memory}%</p>
            <p><strong>Uso de CPU:</strong> ${data.cpu}%</p>
            <p><strong>Timestamp:</strong> ${timestamp}</p>
          `,
          text: `Alto uso de memoria en ${data.container}: ${data.memory}% - ${timestamp}`,
          priority: 'normal'
        };

      case 'disk_space_low':
        return {
          subject: `💾 Espacio en disco bajo`,
          html: `
            <h2>💾 Alerta de Almacenamiento</h2>
            <p><strong>Espacio disponible:</strong> ${data.available}GB</p>
            <p><strong>Espacio total:</strong> ${data.total}GB</p>
            <p><strong>Uso:</strong> ${data.usage}%</p>
            <p><strong>Timestamp:</strong> ${timestamp}</p>
            <p><strong>Acción requerida:</strong> Limpiar espacio en disco</p>
          `,
          text: `Espacio en disco bajo: ${data.available}GB disponibles de ${data.total}GB - ${timestamp}`,
          priority: 'high'
        };

      case 'test_failure':
        return {
          subject: `❌ Tests fallaron: ${data.testSuite}`,
          html: `
            <h2>❌ Alerta de Testing</h2>
            <p><strong>Test Suite:</strong> ${data.testSuite}</p>
            <p><strong>Entorno:</strong> ${data.environment}</p>
            <p><strong>Tests fallidos:</strong> ${data.failed}</p>
            <p><strong>Tests totales:</strong> ${data.total}</p>
            <p><strong>Timestamp:</strong> ${timestamp}</p>
          `,
          text: `Tests fallaron en ${data.testSuite}: ${data.failed}/${data.total} - ${timestamp}`,
          priority: 'high'
        };

      case 'security_alert':
        return {
          subject: `🔒 Alerta de Seguridad`,
          html: `
            <h2>🔒 Alerta de Seguridad</h2>
            <p><strong>Tipo:</strong> ${data.alertType}</p>
            <p><strong>Usuario:</strong> ${data.user || 'N/A'}</p>
            <p><strong>IP:</strong> ${data.ip || 'N/A'}</p>
            <p><strong>Descripción:</strong> ${data.description}</p>
            <p><strong>Timestamp:</strong> ${timestamp}</p>
          `,
          text: `Alerta de seguridad: ${data.alertType} - ${data.description} - ${timestamp}`,
          priority: 'high'
        };

      case 'backup_completed':
        return {
          subject: `✅ Backup completado`,
          html: `
            <h2>✅ Backup Exitoso</h2>
            <p><strong>Tipo:</strong> ${data.type}</p>
            <p><strong>Archivo:</strong> ${data.filename}</p>
            <p><strong>Tamaño:</strong> ${data.size}</p>
            <p><strong>Timestamp:</strong> ${timestamp}</p>
          `,
          text: `Backup completado: ${data.type} - ${data.filename} - ${timestamp}`,
          priority: 'normal'
        };

      case 'backup_failed':
        return {
          subject: `❌ Backup falló`,
          html: `
            <h2>❌ Error de Backup</h2>
            <p><strong>Tipo:</strong> ${data.type}</p>
            <p><strong>Error:</strong> ${data.error}</p>
            <p><strong>Timestamp:</strong> ${timestamp}</p>
            <p><strong>Acción requerida:</strong> Revisar configuración de backup</p>
          `,
          text: `Backup falló: ${data.type} - ${data.error} - ${timestamp}`,
          priority: 'high'
        };

      default:
        return {
          subject: `📢 Notificación del Sistema`,
          html: `
            <h2>📢 Notificación del Sistema</h2>
            <p><strong>Tipo:</strong> ${type}</p>
            <p><strong>Datos:</strong> ${JSON.stringify(data, null, 2)}</p>
            <p><strong>Timestamp:</strong> ${timestamp}</p>
          `,
          text: `Notificación del sistema: ${type} - ${JSON.stringify(data)} - ${timestamp}`,
          priority: 'normal'
        };
    }
  }

  // Enviar notificación de usuario
  async sendUserNotification(userId, notification) {
    try {
      // Aquí podrías integrar con un sistema de notificaciones en tiempo real
      // como WebSockets, Push notifications, etc.
      
      this.logger.info(`Notificación enviada al usuario ${userId}`, notification);
      
      return {
        success: true,
        userId,
        notification
      };
    } catch (error) {
      this.logger.error('Error enviando notificación de usuario:', error);
      throw error;
    }
  }

  // Configurar alertas automáticas
  async setupAutomaticAlerts() {
    try {
      // Configurar alertas basadas en umbrales
      const alerts = [
        {
          type: 'high_cpu_usage',
          threshold: 80,
          checkInterval: 60000 // 1 minuto
        },
        {
          type: 'high_memory_usage',
          threshold: 85,
          checkInterval: 60000
        },
        {
          type: 'disk_space_low',
          threshold: 90,
          checkInterval: 300000 // 5 minutos
        }
      ];

      // Iniciar monitoreo automático
      alerts.forEach(alert => {
        this.startMonitoring(alert);
      });

      this.logger.info('Alertas automáticas configuradas');
    } catch (error) {
      this.logger.error('Error configurando alertas automáticas:', error);
    }
  }

  // Iniciar monitoreo
  startMonitoring(alert) {
    setInterval(async () => {
      try {
        await this.checkAlert(alert);
      } catch (error) {
        this.logger.error(`Error en monitoreo de ${alert.type}:`, error);
      }
    }, alert.checkInterval);
  }

  // Verificar alerta
  async checkAlert(alert) {
    try {
      const Docker = require('dockerode');
      const docker = new Docker();

      switch (alert.type) {
        case 'high_cpu_usage':
        case 'high_memory_usage':
          await this.checkContainerResources(alert, docker);
          break;
        case 'disk_space_low':
          await this.checkDiskSpace(alert);
          break;
      }
    } catch (error) {
      this.logger.error(`Error verificando alerta ${alert.type}:`, error);
    }
  }

  // Verificar recursos de contenedores
  async checkContainerResources(alert, docker) {
    try {
      const containers = await docker.listContainers();
      const gelymarContainers = containers.filter(container => 
        container.Names.some(name => name.includes('gelymar-platform'))
      );

      for (const containerInfo of gelymarContainers) {
        const container = docker.getContainer(containerInfo.Id);
        const stats = await container.stats({ stream: false });

        const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
        const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
        const cpuPercent = (cpuDelta / systemDelta) * 100;

        const memoryUsage = stats.memory_stats.usage;
        const memoryLimit = stats.memory_stats.limit;
        const memoryPercent = (memoryUsage / memoryLimit) * 100;

        const containerName = containerInfo.Names[0].replace('/', '');

        if (alert.type === 'high_cpu_usage' && cpuPercent > alert.threshold) {
          await this.sendSystemNotification('high_cpu_usage', {
            container: containerName,
            cpu: cpuPercent.toFixed(2),
            memory: memoryPercent.toFixed(2)
          });
        }

        if (alert.type === 'high_memory_usage' && memoryPercent > alert.threshold) {
          await this.sendSystemNotification('high_memory_usage', {
            container: containerName,
            memory: memoryPercent.toFixed(2),
            cpu: cpuPercent.toFixed(2)
          });
        }
      }
    } catch (error) {
      this.logger.error('Error verificando recursos de contenedores:', error);
    }
  }

  // Verificar espacio en disco
  async checkDiskSpace(alert) {
    try {
      const { execSync } = require('child_process');
      const output = execSync('df -h /', { encoding: 'utf8' });
      const lines = output.split('\n');
      const dataLine = lines[1].split(/\s+/);
      
      const total = dataLine[1];
      const used = dataLine[2];
      const available = dataLine[3];
      const usagePercent = parseInt(dataLine[4].replace('%', ''));

      if (usagePercent > alert.threshold) {
        await this.sendSystemNotification('disk_space_low', {
          total,
          used,
          available,
          usage: usagePercent
        });
      }
    } catch (error) {
      this.logger.error('Error verificando espacio en disco:', error);
    }
  }

  // Obtener historial de notificaciones
  getNotificationHistory(limit = 100) {
    // En una implementación real, esto vendría de una base de datos
    return {
      notifications: [],
      total: 0
    };
  }

  // Limpiar notificaciones antiguas
  async cleanupOldNotifications(daysToKeep = 30) {
    try {
      // En una implementación real, esto limpiaría la base de datos
      this.logger.info(`Limpiando notificaciones más antiguas que ${daysToKeep} días`);
      return { success: true };
    } catch (error) {
      this.logger.error('Error limpiando notificaciones antiguas:', error);
      throw error;
    }
  }
}

module.exports = NotificationService;
