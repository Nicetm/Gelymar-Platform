// routes/monitoring.routes.js
const express = require('express');
const router = express.Router();
const { container } = require('../config/container');
const monitoringService = container.resolve('monitoringService');
const { logger } = require('../utils/logger');
const http = require('http');
const net = require('net');

/**
 * @route POST /api/monitoring/login
 * @desc Login para panel de monitoreo usando tabla monitoring
 * @access Público
 */
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ 
      success: false,
      message: 'Usuario y contraseña requeridos' 
    });
  }

  try {
    // Autenticar usuario
    const user = await monitoringService.authenticateUser(username, password);
    
    if (!user) {
      return res.status(401).json({ 
        success: false,
        message: 'Usuario o contraseña incorrectos' 
      });
    }

    // Generar token de sesión
    const sessionToken = monitoringService.generateSessionToken(user);

    res.json({
      success: true,
      token: sessionToken,
      user: {
        id: user.id,
        username: user.username,
        appTypes: user.appTypes
      }
    });

  } catch (error) {
    logger.error(`Error en login de monitoreo: ${error.message}`);
    res.status(500).json({ 
      success: false,
      message: 'Error interno del servidor' 
    });
  }
});

/**
 * @route POST /api/monitoring/verify
 * @desc Verificar token de sesión de monitoreo
 * @access Público
 */
router.post('/verify', async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ 
      success: false,
      message: 'Token requerido' 
    });
  }

  try {
    const session = monitoringService.verifySessionToken(token);
    
    if (!session) {
      return res.status(401).json({ 
        success: false,
        message: 'Token inválido o expirado' 
      });
    }

    res.json({
      success: true,
      user: {
        id: session.userId,
        username: session.username,
        appTypes: session.appTypes
      }
    });

  } catch (error) {
    logger.error(`Error verificando token de monitoreo: ${error.message}`);
    res.status(500).json({ 
      success: false,
      message: 'Error interno del servidor' 
    });
  }
});

/**
 * @route GET /api/monitoring/status
 * @desc Verificar estado de todos los servicios
 * @access Público
 */
router.get('/status', async (req, res) => {
  try {
    const services = {
      mysql: { port: 3306, host: 'mysql' },
      backend: { port: 3000, host: 'localhost' },
      frontend: { port: 2121, host: 'frontend' },
      fileserver: { port: 80, host: 'fileserver' },
      cronjob: { port: 9615, host: 'cron' },
      shell: { port: 80, host: 'monitoring' }
    };

    const status = {};

    for (const [serviceName, config] of Object.entries(services)) {
      try {
        if (serviceName === 'mysql') {
          // Para MySQL, verificar si el puerto está abierto
          const isOpen = await checkPort(config.host, config.port);
          status[serviceName] = isOpen ? 'online' : 'offline';
        } else {
          // Para servicios HTTP, hacer una petición
          const isOnline = await checkHttpService(config.host, config.port);
          status[serviceName] = isOnline ? 'online' : 'offline';
        }
      } catch (error) {
        logger.error(`Error checking ${serviceName}: ${error.message}`);
        status[serviceName] = 'offline';
      }
    }

    res.json({
      success: true,
      status
    });

  } catch (error) {
    logger.error(`Error verificando servicios: ${error.message}`);
    res.status(500).json({ 
      success: false,
      message: 'Error interno del servidor' 
    });
  }
});

// Función para verificar si un puerto está abierto
function checkPort(host, port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const timeout = 2000;

    socket.setTimeout(timeout);

    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });

    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });

    socket.connect(port, host);
  });
}

// Función para verificar servicios HTTP
function checkHttpService(host, port) {
  return new Promise((resolve) => {
    const options = {
      hostname: host,
      port: port,
      path: '/',
      method: 'GET',
      timeout: 3000
    };

    const req = http.request(options, (res) => {
      resolve(true);
    });

    req.on('error', () => {
      resolve(false);
    });

    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });

    req.end();
  });
}

/**
 * @route POST /api/monitoring/logout
 * @desc Cerrar sesión de monitoreo
 * @access Público
 */
router.post('/logout', async (req, res) => {
  const { token } = req.body;

  try {
    const closed = monitoringService.closeSession(token);
    
    res.json({ 
      success: true, 
      message: closed ? 'Sesión cerrada correctamente' : 'Sesión no encontrada' 
    });

  } catch (error) {
    logger.error(`Error en logout de monitoreo: ${error.message}`);
    res.status(500).json({ 
      success: false,
      message: 'Error interno del servidor' 
    });
  }
});

module.exports = router; 
