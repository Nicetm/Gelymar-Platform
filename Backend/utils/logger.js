// logger.js
const { createLogger, format, transports } = require('winston');
require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');

// Asegurar que el directorio de logs exista
const logDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

// Formato detallado para archivos
const fileFormat = format.combine(
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  format.errors({ stack: true }),
  format.json()
);

// Formato simple para consola
const consoleFormat = format.combine(
  format.colorize(),
  format.timestamp({ format: 'HH:mm:ss' }),
  format.printf(({ timestamp, level, message, ...meta }) => {
    let log = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta)}`;
    }
    return log;
  })
);

// Transportes de archivo con rotación diaria
const dailyRotateFileTransport = new transports.DailyRotateFile({
  filename: path.join(logDir, 'app-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d', // guarda 14 días de logs
  format: fileFormat
});

// Transporte para errores separado
const errorFileTransport = new transports.DailyRotateFile({
  filename: path.join(logDir, 'error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '30d', // guarda 30 días de logs de error
  level: 'error',
  format: fileFormat
});

// Transporte para auditoría de seguridad
const securityFileTransport = new transports.DailyRotateFile({
  filename: path.join(logDir, 'security-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '10m',
  maxFiles: '90d', // guarda 90 días de logs de seguridad
  format: fileFormat
});

// Configuración del logger según entorno
const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

const loggerConfig = {
  level: isDevelopment ? 'debug' : 'info',
  format: isProduction ? fileFormat : consoleFormat,
  transports: []
};

// Agregar transportes según entorno
if (isProduction) {
  // En producción: solo archivos
  loggerConfig.transports = [
    dailyRotateFileTransport,
    errorFileTransport,
    securityFileTransport
  ];
} else {
  // En desarrollo: consola + archivos básicos
  loggerConfig.transports = [
    new transports.Console({ format: consoleFormat }),
    dailyRotateFileTransport
  ];
}

// Crear logger principal
const logger = createLogger(loggerConfig);

// Logger específico para seguridad
const securityLogger = createLogger({
  level: 'info',
  format: fileFormat,
  transports: [securityFileTransport]
});

// Logger específico para auditoría
const auditLogger = createLogger({
  level: 'info',
  format: fileFormat,
  transports: [
    new transports.DailyRotateFile({
      filename: path.join(logDir, 'audit-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '10m',
      maxFiles: '365d', // guarda 1 año de logs de auditoría
      format: fileFormat
    })
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

// Manejar errores no capturados
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

module.exports = {
  logger,
  securityLogger,
  auditLogger,
  logSecurity,
  logAudit
};
