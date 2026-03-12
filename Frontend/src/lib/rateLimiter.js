// src/lib/rateLimiter.js - Sistema de rate limiting en el cliente

/**
 * Configuración de rate limiting
 */
const RATE_LIMIT_CONFIG = {
  // Límites por tipo de acción
  LOGIN: { maxAttempts: 5, windowMs: 15 * 60 * 1000 }, // 5 intentos en 15 minutos
  API_CALLS: { maxAttempts: 100, windowMs: 60 * 1000 }, // 100 llamadas por minuto
  FILE_UPLOAD: { maxAttempts: 10, windowMs: 60 * 1000 }, // 10 uploads por minuto
  PASSWORD_RESET: { maxAttempts: 3, windowMs: 60 * 60 * 1000 }, // 3 intentos por hora
  GENERIC: { maxAttempts: 50, windowMs: 60 * 1000 } // 50 intentos por minuto
};

/**
 * Clase para manejar rate limiting
 */
class RateLimiter {
  constructor() {
    this.attempts = new Map();
    this.blockedIPs = new Map();
  }

  /**
   * Verifica si una acción está permitida
   * @param {string} action - Tipo de acción
   * @param {string} identifier - Identificador único (IP, userId, etc.)
   * @returns {boolean} Está permitido
   */
  isAllowed(action, identifier = 'default') {
    const key = `${action}:${identifier}`;
    const config = RATE_LIMIT_CONFIG[action] || RATE_LIMIT_CONFIG.GENERIC;
    
    // Verificar si está bloqueado
    if (this.isBlocked(key)) {
      return false;
    }

    const now = Date.now();
    const attempts = this.attempts.get(key) || [];
    
    // Limpiar intentos antiguos
    const validAttempts = attempts.filter(timestamp => 
      now - timestamp < config.windowMs
    );
    
    // Verificar límite
    if (validAttempts.length >= config.maxAttempts) {
      this.blockIP(key, config.windowMs);
      return false;
    }
    
    // Registrar intento
    validAttempts.push(now);
    this.attempts.set(key, validAttempts);
    
    return true;
  }

  /**
   * Registra un intento fallido
   * @param {string} action - Tipo de acción
   * @param {string} identifier - Identificador único
   */
  recordFailedAttempt(action, identifier = 'default') {
    const key = `${action}:${identifier}`;
    const config = RATE_LIMIT_CONFIG[action] || RATE_LIMIT_CONFIG.GENERIC;
    
    const now = Date.now();
    const attempts = this.attempts.get(key) || [];
    
    // Limpiar intentos antiguos
    const validAttempts = attempts.filter(timestamp => 
      now - timestamp < config.windowMs
    );
    
    // Agregar intento fallido
    validAttempts.push(now);
    this.attempts.set(key, validAttempts);
    
    // Verificar si debe bloquear
    if (validAttempts.length >= config.maxAttempts) {
      this.blockIP(key, config.windowMs);
    }
  }

  /**
   * Bloquea un identificador
   * @param {string} key - Clave del bloqueo
   * @param {number} durationMs - Duración del bloqueo en ms
   */
  blockIP(key, durationMs) {
    const blockUntil = Date.now() + durationMs;
    this.blockedIPs.set(key, blockUntil);
    
    // Limpiar bloqueo después del tiempo
    setTimeout(() => {
      this.blockedIPs.delete(key);
    }, durationMs);
  }

  /**
   * Verifica si un identificador está bloqueado
   * @param {string} key - Clave del bloqueo
   * @returns {boolean} Está bloqueado
   */
  isBlocked(key) {
    const blockUntil = this.blockedIPs.get(key);
    if (!blockUntil) return false;
    
    if (Date.now() > blockUntil) {
      this.blockedIPs.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * Obtiene información de rate limiting
   * @param {string} action - Tipo de acción
   * @param {string} identifier - Identificador único
   * @returns {Object} Información del rate limiting
   */
  getRateLimitInfo(action, identifier = 'default') {
    const key = `${action}:${identifier}`;
    const config = RATE_LIMIT_CONFIG[action] || RATE_LIMIT_CONFIG.GENERIC;
    
    const attempts = this.attempts.get(key) || [];
    const now = Date.now();
    const validAttempts = attempts.filter(timestamp => 
      now - timestamp < config.windowMs
    );
    
    const remainingAttempts = Math.max(0, config.maxAttempts - validAttempts.length);
    const resetTime = validAttempts.length > 0 ? 
      Math.max(...validAttempts) + config.windowMs : 
      now;
    
    return {
      remaining: remainingAttempts,
      limit: config.maxAttempts,
      resetTime: new Date(resetTime),
      isBlocked: this.isBlocked(key),
      blockUntil: this.blockedIPs.get(key) ? new Date(this.blockedIPs.get(key)) : null
    };
  }

  /**
   * Limpia intentos antiguos
   */
  cleanup() {
    const now = Date.now();
    
    for (const [key, attempts] of this.attempts.entries()) {
      const action = key.split(':')[0];
      const config = RATE_LIMIT_CONFIG[action] || RATE_LIMIT_CONFIG.GENERIC;
      
      const validAttempts = attempts.filter(timestamp => 
        now - timestamp < config.windowMs
      );
      
      if (validAttempts.length === 0) {
        this.attempts.delete(key);
      } else {
        this.attempts.set(key, validAttempts);
      }
    }
  }

  /**
   * Resetea todos los límites
   */
  reset() {
    this.attempts.clear();
    this.blockedIPs.clear();
  }
}

// Instancia global del rate limiter
export const rateLimiter = new RateLimiter();

/**
 * Middleware para rate limiting de fetch
 */
export function setupRateLimitedFetch() {
  const originalFetch = window.fetch;
  
  window.fetch = async function(...args) {
    const url = typeof args[0] === 'string' ? args[0] : args[0].url;
    
    // Determinar tipo de acción basado en la URL
    let action = 'API_CALLS';
    if (url.includes('/api/auth/login')) {
      action = 'LOGIN';
    } else if (url.includes('/api/files/upload')) {
      action = 'FILE_UPLOAD';
    } else if (url.includes('/api/auth/reset-password')) {
      action = 'PASSWORD_RESET';
    }
    
    // Verificar rate limiting
    if (!rateLimiter.isAllowed(action)) {
      const info = rateLimiter.getRateLimitInfo(action);
      throw new Error(`Rate limit exceeded. Try again after ${info.resetTime.toLocaleTimeString()}`);
    }
    
    try {
      const response = await originalFetch.apply(this, args);
      
      // Registrar intento fallido si la respuesta no es exitosa
      if (!response.ok && response.status !== 401) {
        rateLimiter.recordFailedAttempt(action);
      }
      
      return response;
    } catch (error) {
      // Registrar intento fallido en caso de error de red
      rateLimiter.recordFailedAttempt(action);
      throw error;
    }
  };
}

/**
 * Función helper para verificar rate limiting antes de una acción
 * @param {string} action - Tipo de acción
 * @param {string} identifier - Identificador único
 * @returns {Object} Resultado de la verificación
 */
export function checkRateLimit(action, identifier = 'default') {
  const info = rateLimiter.getRateLimitInfo(action, identifier);
  
  if (info.isBlocked) {
    return {
      allowed: false,
      reason: 'blocked',
      message: `Acceso bloqueado hasta ${info.blockUntil.toLocaleTimeString()}`,
      info
    };
  }
  
  if (info.remaining === 0) {
    return {
      allowed: false,
      reason: 'limit_exceeded',
      message: `Límite de intentos alcanzado. Intenta de nuevo después de ${info.resetTime.toLocaleTimeString()}`,
      info
    };
  }
  
  return {
    allowed: true,
    remaining: info.remaining,
    info
  };
}

/**
 * Función helper para registrar intento fallido
 * @param {string} action - Tipo de acción
 * @param {string} identifier - Identificador único
 */
export function recordFailedAttempt(action, identifier = 'default') {
  rateLimiter.recordFailedAttempt(action, identifier);
}

// Configurar rate limiting automático para fetch
if (typeof window !== 'undefined') {
  setupRateLimitedFetch();
  
  // Limpiar datos antiguos cada 5 minutos
  setInterval(() => {
    rateLimiter.cleanup();
  }, 5 * 60 * 1000);
} 