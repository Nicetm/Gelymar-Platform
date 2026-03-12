const express = require('express');
const { authenticateUser, checkAuth } = require('../middleware/auth');
const router = express.Router();

/**
 * Página de login
 */
router.get('/login', checkAuth, (req, res) => {
  res.sendFile(require('path').join(__dirname, '../public', 'login.html'));
});

/**
 * Procesar login
 */
router.post('/login', checkAuth, async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Usuario y contraseña son requeridos'
      });
    }

    const authResult = await authenticateUser(username, password);

    if (!authResult.success) {
      return res.status(401).json({
        success: false,
        message: authResult.message
      });
    }

    // Crear sesión
    req.session.userId = authResult.user.id;
    req.session.username = authResult.user.username;

    res.json({
      success: true,
      message: 'Login exitoso',
      user: authResult.user
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

/**
 * Logout
 */
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error cerrando sesión:', err);
      return res.status(500).json({
        success: false,
        message: 'Error cerrando sesión'
      });
    }
    res.json({
      success: true,
      message: 'Sesión cerrada exitosamente'
    });
  });
});

/**
 * Verificar estado de autenticación
 */
router.get('/status', (req, res) => {
  if (req.session && req.session.userId) {
    res.json({
      success: true,
      authenticated: true,
      user: {
        id: req.session.userId,
        username: req.session.username
      }
    });
  } else {
    res.json({
      success: true,
      authenticated: false
    });
  }
});

module.exports = router;
