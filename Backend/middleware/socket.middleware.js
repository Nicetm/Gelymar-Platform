// Socket.io middleware para rate limiting y validación

// Rate limiting para Socket.io
const socketRateLimits = new Map();
const MAX_CONNECTIONS_PER_USER = 5;

/**
 * Verifica rate limit para un socket y evento específico
 * @param {string} socketId - ID del socket
 * @param {string} event - Nombre del evento
 * @param {number} maxPerMinute - Máximo de eventos por minuto
 * @returns {boolean} - true si está dentro del límite, false si excede
 */
const checkRateLimit = (socketId, event, maxPerMinute = 60) => {
  const key = `${socketId}:${event}`;
  const now = Date.now();
  const windowStart = now - 60000; // 1 minute window
  
  if (!socketRateLimits.has(key)) {
    socketRateLimits.set(key, []);
  }
  
  const timestamps = socketRateLimits.get(key).filter(ts => ts > windowStart);
  
  if (timestamps.length >= maxPerMinute) {
    return false; // Rate limit exceeded
  }
  
  timestamps.push(now);
  socketRateLimits.set(key, timestamps);
  return true;
};

/**
 * Limpia entradas antiguas de rate limits cada 5 minutos
 */
const startRateLimitCleanup = () => {
  setInterval(() => {
    const now = Date.now();
    for (const [key, timestamps] of socketRateLimits.entries()) {
      const recent = timestamps.filter(ts => now - ts < 300000);
      if (recent.length === 0) {
        socketRateLimits.delete(key);
      } else {
        socketRateLimits.set(key, recent);
      }
    }
  }, 300000); // 5 minutes
};

/**
 * Valida el formato y contenido de un mensaje
 * @param {any} data - Datos del mensaje a validar
 * @returns {object} - { valid: boolean, error?: string }
 */
const validateMessage = (data) => {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Invalid message format' };
  }
  
  if (!data.message || typeof data.message !== 'string') {
    return { valid: false, error: 'Message is required and must be a string' };
  }
  
  if (data.message.length > 5000) {
    return { valid: false, error: 'Message too long (max 5000 characters)' };
  }
  
  if (data.message.trim().length === 0) {
    return { valid: false, error: 'Message cannot be empty' };
  }
  
  return { valid: true };
};

/**
 * Verifica el límite de conexiones por usuario
 * @param {object} io - Instancia de Socket.io
 * @param {string} userId - ID del usuario
 * @returns {number} - Número de conexiones activas del usuario
 */
const getUserConnectionCount = (io, userId) => {
  let count = 0;
  for (const [, socket] of io.sockets.sockets) {
    if (socket.user?.id === userId) {
      count++;
    }
  }
  return count;
};

module.exports = {
  checkRateLimit,
  startRateLimitCleanup,
  validateMessage,
  getUserConnectionCount,
  MAX_CONNECTIONS_PER_USER
};
