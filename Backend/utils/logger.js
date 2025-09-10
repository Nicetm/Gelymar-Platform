// logger.js
const { createLogger, format, transports } = require('winston');
const path = require('path');
const fs = require('fs');

// Formato simple para consola
const consoleFormat = format.combine(
  format.colorize(),
  format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
  format.printf(({ timestamp, level, message, ...meta }) => {
    let log = `[${timestamp}] -> Logger Process -> ${message}`;
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta)}`;
    }
    return log;
  })
);

// Configuración del logger - solo consola para evitar bloqueos
const loggerConfig = {
  level: 'info',
  format: consoleFormat,
  transports: [
    new transports.Console({ format: consoleFormat })
  ]
};

// Crear logger principal con manejo de errores
const logger = createLogger({
  ...loggerConfig,
  handleExceptions: true,
  handleRejections: true,
  exitOnError: false // No cerrar la aplicación si hay errores de logging
});

// Manejo global de errores de logging
logger.on('error', (error) => {
  console.error('Error en el logger:', error.message);
});

// Manejo de excepciones no capturadas
process.on('uncaughtException', (error) => {
  console.error('Excepción no capturada:', error.message);
  // Intentar loggear si es posible
  try {
    logger.error('Excepción no capturada', { error: error.message, stack: error.stack });
  } catch (logError) {
    console.error('No se pudo loggear la excepción:', logError.message);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Promesa rechazada no manejada:', reason);
  // Intentar loggear si es posible
  try {
    logger.error('Promesa rechazada no manejada', { reason: String(reason) });
  } catch (logError) {
    console.error('No se pudo loggear la promesa rechazada:', logError.message);
  }
});

// Logger específico para seguridad (solo consola)
const securityLogger = createLogger({
  level: 'info',
  format: consoleFormat,
  transports: [
    new transports.Console({ format: consoleFormat })
  ]
});

// Logger específico para auditoría (solo consola)
const auditLogger = createLogger({
  level: 'info',
  format: consoleFormat,
  transports: [
    new transports.Console({ format: consoleFormat })
  ]
});

// Logger específico para cron jobs (solo consola)
const cronLogger = createLogger({
  level: 'info',
  format: consoleFormat,
  transports: [
    new transports.Console({ format: consoleFormat })
  ]
});

// Funciones helper para logging específico
const logSecurity = (event, details = {}) => {
  securityLogger.info('SECURITY_EVENT', {
    event,
    timestamp: new Date().toISOString(),
    ip: details.ip,
    user: details.user,
    action: details.action,
    resource: details.resource,
    success: details.success,
    ...details
  });
};

const logAudit = (action, details = {}) => {
  auditLogger.info('AUDIT_EVENT', {
    action,
    timestamp: new Date().toISOString(),
    user: details.user,
    resource: details.resource,
    changes: details.changes,
    ...details
  });
};

// Función helper para logging de cron jobs
const logCronJob = (jobName, action, details = {}) => {
  const logMessage = `CRON_JOB: ${jobName} - ${action}`;
  cronLogger.info(logMessage, {
    jobName,
    action,
    timestamp: new Date().toISOString(),
    ...details
  });
  
  // También escribir en el logger principal
  logger.info(logMessage, {
    jobName,
    action,
    ...details
  });
};

module.exports = {
  logger,
  securityLogger,
  auditLogger,
  cronLogger,
  logSecurity,
  logAudit,
  logCronJob
};
