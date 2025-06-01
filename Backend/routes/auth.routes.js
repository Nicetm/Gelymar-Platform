// /routes/auth.routes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middleware/auth.middleware');

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login de prueba
 *     tags: [Autenticación]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: JWT generado
 *       401:
 *         description: Credenciales inválidas
 */
router.post('/login', authController.login);
router.get('/2fa/setup', authController.setup2FA);
router.get('/2fa/status', authController.check2FAStatus);
router.get('/me', authMiddleware, (req, res) => {
    res.json({
      id: req.user.id,
      email: req.user.email,
      role: req.user.role
    });
  });


module.exports = router;
