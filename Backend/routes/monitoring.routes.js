// routes/monitoring.routes.js
const express = require('express');
const router = express.Router();
const monitoringService = require('../services/monitoring.service');
const logger = require('../utils/logger');

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