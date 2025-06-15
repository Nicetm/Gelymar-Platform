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

// Formato general de los logs
const logFormat = format.printf(({ timestamp, level, message }) => {
  return `${timestamp} [${level.toUpperCase()}]: ${message}`;
});

// Transportes de archivo con rotación diaria
const dailyRotateFileTransport = new transports.DailyRotateFile({
  filename: path.join(logDir, 'app-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d' // guarda 14 días de logs
});

// Configuración del logger
const logger = createLogger({
  level: 'debug', // debug, info, warn, error
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat
  ),
  transports: [
    new transports.Console(),
    dailyRotateFileTransport
  ]
});

module.exports = logger;
