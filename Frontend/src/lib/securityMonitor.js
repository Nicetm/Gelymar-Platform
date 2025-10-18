// src/lib/securityMonitor.js - Sistema de monitoreo de seguridad en tiempo real

import { securityAuditor, SECURITY_EVENTS, SEVERITY_LEVELS } from './security.js';
import { rateLimiter } from './rateLimiter.js';

/**
 * Configuración del monitor de seguridad
 */
const MONITOR_CONFIG = {
  // Intervalo de verificación (ms)
  CHECK_INTERVAL: 5000, // 5 segundos
  
  // Umbrales de alerta
  ALERTS: {
    FAILED_LOGINS: 3, // Alertar después de 3 intentos fallidos
    SUSPICIOUS_ACTIVITY: 2, // Alertar después de 2 actividades sospechosas
    API_ERRORS: 5, // Alertar después de 5 errores de API
    RATE_LIMIT_EXCEEDED: 1 // Alertar inmediatamente
  },
  
  // Tiempo de ventana para análisis (ms)
  ANALYSIS_WINDOW: 15 * 60 * 1000, // 15 minutos
};

/**
 * Clase para monitoreo de seguridad en tiempo real
 */
class SecurityMonitor {
  constructor() {
    this.alerts = [];
    this.isMonitoring = false;
    this.checkInterval = null;
    this.lastCheck = Date.now();
    this.alertCallbacks = [];
  }

  /**
   * Inicia el monitoreo
   */
  start() {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    this.checkInterval = setInterval(() => {
      this.performSecurityCheck();
    }, MONITOR_CONFIG.CHECK_INTERVAL);
  }

  /**
   * Detiene el monitoreo
   */
  stop() {
    if (!this.isMonitoring) return;
    
    this.isMonitoring = false;
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Realiza verificación de seguridad
   */
  performSecurityCheck() {
    const now = Date.now();
    const windowStart = now - MONITOR_CONFIG.ANALYSIS_WINDOW;
    
    // Obtener eventos recientes
    const recentEvents = securityAuditor.getEvents({
      since: new Date(windowStart).toISOString()
    });
    
    // Analizar eventos por tipo
    this.analyzeFailedLogins(recentEvents);
    this.analyzeSuspiciousActivity(recentEvents);
    this.analyzeApiErrors(recentEvents);
    this.analyzeRateLimiting();
    
    this.lastCheck = now;
  }

  /**
   * Analiza intentos de login fallidos
   * @param {Array} events - Eventos recientes
   */
  analyzeFailedLogins(events) {
    const failedLogins = events.filter(e => 
      e.eventType === SECURITY_EVENTS.LOGIN_FAILED
    );
    
    if (failedLogins.length >= MONITOR_CONFIG.ALERTS.FAILED_LOGINS) {
      this.createAlert('MULTIPLE_FAILED_LOGINS', {
        count: failedLogins.length,
        timeWindow: MONITOR_CONFIG.ANALYSIS_WINDOW / 1000 / 60,
        events: failedLogins
      }, SEVERITY_LEVELS.HIGH);
    }
  }

  /**
   * Analiza actividad sospechosa
   * @param {Array} events - Eventos recientes
   */
  analyzeSuspiciousActivity(events) {
    const suspiciousEvents = events.filter(e => 
      e.eventType === SECURITY_EVENTS.SUSPICIOUS_ACTIVITY
    );
    
    if (suspiciousEvents.length >= MONITOR_CONFIG.ALERTS.SUSPICIOUS_ACTIVITY) {
      this.createAlert('SUSPICIOUS_ACTIVITY_DETECTED', {
        count: suspiciousEvents.length,
        timeWindow: MONITOR_CONFIG.ANALYSIS_WINDOW / 1000 / 60,
        events: suspiciousEvents
      }, SEVERITY_LEVELS.CRITICAL);
    }
  }

  /**
   * Analiza errores de API
   * @param {Array} events - Eventos recientes
   */
  analyzeApiErrors(events) {
    const apiErrors = events.filter(e => 
      e.eventType === SECURITY_EVENTS.API_ERROR
    );
    
    if (apiErrors.length >= MONITOR_CONFIG.ALERTS.API_ERRORS) {
      this.createAlert('MULTIPLE_API_ERRORS', {
        count: apiErrors.length,
        timeWindow: MONITOR_CONFIG.ANALYSIS_WINDOW / 1000 / 60,
        events: apiErrors
      }, SEVERITY_LEVELS.MEDIUM);
    }
  }

  /**
   * Analiza rate limiting
   */
  analyzeRateLimiting() {
    // Verificar si hay bloqueos activos
    const blockedActions = [];
    
    for (const [key, blockUntil] of rateLimiter.blockedIPs.entries()) {
      if (Date.now() < blockUntil) {
        blockedActions.push({
          action: key.split(':')[0],
          identifier: key.split(':')[1],
          blockedUntil: new Date(blockUntil)
        });
      }
    }
    
    if (blockedActions.length > 0) {
      this.createAlert('RATE_LIMIT_BLOCKS_ACTIVE', {
        blockedActions: blockedActions
      }, SEVERITY_LEVELS.MEDIUM);
    }
  }

  /**
   * Crea una alerta de seguridad
   * @param {string} alertType - Tipo de alerta
   * @param {Object} data - Datos de la alerta
   * @param {string} severity - Nivel de severidad
   */
  createAlert(alertType, data, severity) {
    const alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: alertType,
      severity: severity,
      timestamp: new Date().toISOString(),
      data: data,
      acknowledged: false
    };
    
    this.alerts.push(alert);
    
    // Notificar a los callbacks registrados
    this.notifyAlertCallbacks(alert);
    
    return alert;
  }

  /**
   * Registra un callback para alertas
   * @param {Function} callback - Función a llamar cuando hay alertas
   */
  onAlert(callback) {
    this.alertCallbacks.push(callback);
  }

  /**
   * Notifica a los callbacks registrados
   * @param {Object} alert - Alerta a notificar
   */
  notifyAlertCallbacks(alert) {
    this.alertCallbacks.forEach(callback => {
      try {
        callback(alert);
      } catch (error) {
        console.error('Error en callback de alerta:', error);
      }
    });
  }

  /**
   * Marca una alerta como reconocida
   * @param {string} alertId - ID de la alerta
   */
  acknowledgeAlert(alertId) {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
    }
  }

  /**
   * Obtiene alertas activas
   * @param {Object} filters - Filtros opcionales
   * @returns {Array} Lista de alertas
   */
  getAlerts(filters = {}) {
    let filteredAlerts = [...this.alerts];
    
    if (filters.severity) {
      filteredAlerts = filteredAlerts.filter(a => a.severity === filters.severity);
    }
    
    if (filters.acknowledged !== undefined) {
      filteredAlerts = filteredAlerts.filter(a => a.acknowledged === filters.acknowledged);
    }
    
    if (filters.since) {
      filteredAlerts = filteredAlerts.filter(a => 
        new Date(a.timestamp) >= new Date(filters.since)
      );
    }
    
    return filteredAlerts;
  }

  /**
   * Limpia alertas antiguas
   * @param {number} maxAge - Edad máxima en horas
   */
  cleanOldAlerts(maxAge = 24) {
    const cutoff = new Date(Date.now() - maxAge * 60 * 60 * 1000);
    this.alerts = this.alerts.filter(a => new Date(a.timestamp) > cutoff);
  }

  /**
   * Obtiene estadísticas de seguridad
   * @returns {Object} Estadísticas
   */
  getSecurityStats() {
    const now = Date.now();
    const windowStart = now - MONITOR_CONFIG.ANALYSIS_WINDOW;
    
    const recentEvents = securityAuditor.getEvents({
      since: new Date(windowStart).toISOString()
    });
    
    const stats = {
      totalEvents: recentEvents.length,
      failedLogins: recentEvents.filter(e => e.eventType === SECURITY_EVENTS.LOGIN_FAILED).length,
      suspiciousActivity: recentEvents.filter(e => e.eventType === SECURITY_EVENTS.SUSPICIOUS_ACTIVITY).length,
      apiErrors: recentEvents.filter(e => e.eventType === SECURITY_EVENTS.API_ERROR).length,
      activeAlerts: this.alerts.filter(a => !a.acknowledged).length,
      blockedActions: Array.from(rateLimiter.blockedIPs.keys()).length,
      timeWindow: MONITOR_CONFIG.ANALYSIS_WINDOW / 1000 / 60 // minutos
    };
    
    return stats;
  }

  /**
   * Exporta datos de seguridad para análisis
   * @returns {Object} Datos exportados
   */
  exportSecurityData() {
    return {
      alerts: this.alerts,
      events: securityAuditor.exportEvents(),
      stats: this.getSecurityStats(),
      timestamp: new Date().toISOString()
    };
  }
}

// Instancia global del monitor
export const securityMonitor = new SecurityMonitor();

/**
 * Función helper para iniciar monitoreo automáticamente
 */
export function startSecurityMonitoring() {
  securityMonitor.start();
  
  // Limpiar alertas antiguas cada hora
  setInterval(() => {
    securityMonitor.cleanOldAlerts();
  }, 60 * 60 * 1000);
}

/**
 * Función helper para mostrar alertas en la UI
 */
export function setupSecurityAlertUI() {
  securityMonitor.onAlert((alert) => {
    // Crear notificación visual
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 max-w-md ${
      alert.severity === SEVERITY_LEVELS.CRITICAL ? 'bg-red-500 text-white' :
      alert.severity === SEVERITY_LEVELS.HIGH ? 'bg-orange-500 text-white' :
      alert.severity === SEVERITY_LEVELS.MEDIUM ? 'bg-yellow-500 text-black' :
      'bg-blue-500 text-white'
    }`;
    
    notification.innerHTML = `
      <div class="flex items-start">
        <div class="flex-shrink-0">
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
          </svg>
        </div>
        <div class="ml-3">
          <h3 class="text-sm font-medium">Alerta de Seguridad</h3>
          <p class="text-sm mt-1">${this.getAlertMessage(alert)}</p>
        </div>
        <button class="ml-auto -mx-1.5 -my-1.5 text-current opacity-75 hover:opacity-100" onclick="this.parentElement.parentElement.remove()">
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
          </svg>
        </button>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    // Remover automáticamente después de 10 segundos
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 10000);
  });
}

/**
 * Obtiene mensaje descriptivo para una alerta
 * @param {Object} alert - Alerta
 * @returns {string} Mensaje
 */
function getAlertMessage(alert) {
  switch (alert.type) {
    case 'MULTIPLE_FAILED_LOGINS':
      return `Se detectaron ${alert.data.count} intentos de login fallidos en los últimos ${alert.data.timeWindow} minutos.`;
    case 'SUSPICIOUS_ACTIVITY_DETECTED':
      return `Se detectaron ${alert.data.count} actividades sospechosas en los últimos ${alert.data.timeWindow} minutos.`;
    case 'MULTIPLE_API_ERRORS':
      return `Se detectaron ${alert.data.count} errores de API en los últimos ${alert.data.timeWindow} minutos.`;
    case 'RATE_LIMIT_BLOCKS_ACTIVE':
      return `${alert.data.blockedActions.length} acciones están bloqueadas por rate limiting.`;
    default:
      return 'Se detectó una actividad de seguridad inusual.';
  }
}

// Iniciar monitoreo automáticamente en el cliente
if (typeof window !== 'undefined') {
  startSecurityMonitoring();
  setupSecurityAlertUI();
} 