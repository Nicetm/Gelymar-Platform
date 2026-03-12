// src/lib/security.js - Sistema de auditoría de seguridad

import { AUTH_CONFIG } from './authConfig.js';

/**
 * Tipos de eventos de seguridad
 */
export const SECURITY_EVENTS = {
  LOGIN_SUCCESS: 'login_success',
  LOGIN_FAILED: 'login_failed',
  LOGOUT: 'logout',
  TOKEN_EXPIRED: 'token_expired',
  TOKEN_REFRESHED: 'token_refreshed',
  UNAUTHORIZED_ACCESS: 'unauthorized_access',
  SUSPICIOUS_ACTIVITY: 'suspicious_activity',
  PASSWORD_CHANGE: 'password_change',
  PROFILE_UPDATE: 'profile_update',
  FILE_UPLOAD: 'file_upload',
  FILE_DOWNLOAD: 'file_download',
  API_ERROR: 'api_error'
};

/**
 * Niveles de severidad
 */
export const SEVERITY_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

/**
 * Clase para auditoría de seguridad
 */
class SecurityAuditor {
  constructor() {
    this.events = [];
    this.maxEvents = 1000; // Máximo número de eventos en memoria
    this.suspiciousPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /data:text\/html/i,
      /vbscript:/i,
      /expression\(/i
    ];
  }

  /**
   * Registra un evento de seguridad
   * @param {string} eventType - Tipo de evento
   * @param {Object} data - Datos del evento
   * @param {string} severity - Nivel de severidad
   */
  logEvent(eventType, data = {}, severity = SEVERITY_LEVELS.LOW) {
    const event = {
      timestamp: new Date().toISOString(),
      eventType,
      severity,
      data: this.sanitizeEventData(data),
      userAgent: navigator.userAgent,
      url: window.location.href,
      referrer: document.referrer,
      sessionId: this.getSessionId()
    };

    // Agregar a la lista de eventos
    this.events.push(event);

    // Mantener límite de eventos
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }

    // Enviar a servidor si es crítico
    if (severity === SEVERITY_LEVELS.CRITICAL) {
      this.sendToServer(event);
    }
    return event;
  }

  /**
   * Sanitiza datos del evento para evitar XSS
   * @param {Object} data - Datos a sanitizar
   * @returns {Object} Datos sanitizados
   */
  sanitizeEventData(data) {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    const sanitized = {};
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string') {
        // Detectar patrones sospechosos
        if (this.detectSuspiciousPattern(value)) {
          this.logEvent(SECURITY_EVENTS.SUSPICIOUS_ACTIVITY, {
            pattern: 'suspicious_input_detected',
            field: key,
            value: value.substring(0, 100) // Limitar longitud
          }, SEVERITY_LEVELS.HIGH);
        }
        
        // Sanitizar string
        sanitized[key] = this.sanitizeString(value);
      } else if (typeof value === 'object') {
        sanitized[key] = this.sanitizeEventData(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Detecta patrones sospechosos en el input
   * @param {string} input - Input a verificar
   * @returns {boolean} Es sospechoso
   */
  detectSuspiciousPattern(input) {
    return this.suspiciousPatterns.some(pattern => pattern.test(input));
  }

  /**
   * Sanitiza string para prevenir XSS
   * @param {string} str - String a sanitizar
   * @returns {string} String sanitizado
   */
  sanitizeString(str) {
    if (typeof str !== 'string') return str;
    
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * Obtiene ID de sesión
   * @returns {string} ID de sesión
   */
  getSessionId() {
    let sessionId = sessionStorage.getItem('security_session_id');
    if (!sessionId) {
      sessionId = this.generateSessionId();
      sessionStorage.setItem('security_session_id', sessionId);
    }
    return sessionId;
  }

  /**
   * Genera ID de sesión único
   * @returns {string} ID de sesión
   */
  generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Envía evento crítico al servidor
   * @param {Object} event - Evento a enviar
   */
  async sendToServer(event) {
    try {
      const token = localStorage.getItem(AUTH_CONFIG.TOKEN_KEY);
      const response = await fetch('/api/security/log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify(event)
      });

      if (!response.ok) {
        console.error('Error enviando evento de seguridad al servidor');
      }
    } catch (error) {
      console.error('Error enviando evento de seguridad:', error);
    }
  }

  /**
   * Obtiene eventos de seguridad
   * @param {Object} filters - Filtros opcionales
   * @returns {Array} Lista de eventos
   */
  getEvents(filters = {}) {
    let filteredEvents = [...this.events];

    if (filters.eventType) {
      filteredEvents = filteredEvents.filter(e => e.eventType === filters.eventType);
    }

    if (filters.severity) {
      filteredEvents = filteredEvents.filter(e => e.severity === filters.severity);
    }

    if (filters.since) {
      filteredEvents = filteredEvents.filter(e => new Date(e.timestamp) >= new Date(filters.since));
    }

    return filteredEvents;
  }

  /**
   * Limpia eventos antiguos
   * @param {number} maxAge - Edad máxima en horas
   */
  cleanOldEvents(maxAge = 24) {
    const cutoff = new Date(Date.now() - maxAge * 60 * 60 * 1000);
    this.events = this.events.filter(e => new Date(e.timestamp) > cutoff);
  }

  /**
   * Exporta eventos para análisis
   * @returns {string} JSON de eventos
   */
  exportEvents() {
    return JSON.stringify(this.events, null, 2);
  }
}

// Instancia global del auditor
export const securityAuditor = new SecurityAuditor();

/**
 * Función helper para registrar login exitoso
 * @param {string} username - Nombre de usuario
 * @param {string} userRole - Rol del usuario
 */
export function logLoginSuccess(username, userRole) {
  securityAuditor.logEvent(SECURITY_EVENTS.LOGIN_SUCCESS, {
    username: username,
    userRole: userRole,
    ipAddress: 'client-side', // Se obtendrá del servidor
    userAgent: navigator.userAgent
  }, SEVERITY_LEVELS.LOW);
}

/**
 * Función helper para registrar login fallido
 * @param {string} username - Nombre de usuario intentado
 * @param {string} reason - Razón del fallo
 */
export function logLoginFailed(username, reason) {
  securityAuditor.logEvent(SECURITY_EVENTS.LOGIN_FAILED, {
    username: username,
    reason: reason,
    ipAddress: 'client-side'
  }, SEVERITY_LEVELS.MEDIUM);
}

/**
 * Función helper para registrar logout
 * @param {string} username - Nombre de usuario
 */
export function logLogout(username) {
  securityAuditor.logEvent(SECURITY_EVENTS.LOGOUT, {
    username: username
  }, SEVERITY_LEVELS.LOW);
}

/**
 * Función helper para registrar acceso no autorizado
 * @param {string} attemptedUrl - URL intentada
 * @param {string} requiredRole - Rol requerido
 */
export function logUnauthorizedAccess(attemptedUrl, requiredRole) {
  securityAuditor.logEvent(SECURITY_EVENTS.UNAUTHORIZED_ACCESS, {
    attemptedUrl: attemptedUrl,
    requiredRole: requiredRole,
    currentUrl: window.location.href
  }, SEVERITY_LEVELS.HIGH);
}

/**
 * Función helper para registrar actividad sospechosa
 * @param {string} activity - Descripción de la actividad
 * @param {Object} details - Detalles adicionales
 */
export function logSuspiciousActivity(activity, details = {}) {
  securityAuditor.logEvent(SECURITY_EVENTS.SUSPICIOUS_ACTIVITY, {
    activity: activity,
    ...details
  }, SEVERITY_LEVELS.HIGH);
}

/**
 * Función helper para registrar error de API
 * @param {string} endpoint - Endpoint de la API
 * @param {number} statusCode - Código de estado
 * @param {string} errorMessage - Mensaje de error
 */
export function logApiError(endpoint, statusCode, errorMessage) {
  securityAuditor.logEvent(SECURITY_EVENTS.API_ERROR, {
    endpoint: endpoint,
    statusCode: statusCode,
    errorMessage: errorMessage
  }, statusCode >= 500 ? SEVERITY_LEVELS.HIGH : SEVERITY_LEVELS.MEDIUM);
}

/**
 * Middleware para interceptar fetch y registrar errores
 */
export function setupApiErrorLogging() {
  const originalFetch = window.fetch;
  
  window.fetch = async function(...args) {
    try {
      const response = await originalFetch.apply(this, args);
      
      // Registrar errores de API
      if (!response.ok) {
        const url = typeof args[0] === 'string' ? args[0] : args[0].url;
        logApiError(url, response.status, `HTTP ${response.status} ${response.statusText}`);
      }
      
      return response;
    } catch (error) {
      const url = typeof args[0] === 'string' ? args[0] : args[0].url;
      logApiError(url, 0, error.message);
      throw error;
    }
  };
}

// Configurar logging automático de errores de API
if (typeof window !== 'undefined') {
  setupApiErrorLogging();
} 