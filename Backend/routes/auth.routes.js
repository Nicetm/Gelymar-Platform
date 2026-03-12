// /routes/auth.routes.js
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { container } = require('../config/container');
const { logger } = require('../utils/logger');
const userService = container.resolve('userService');
const { authValidations } = require('../middleware/validation.middleware');
const rateLimit = require('express-rate-limit');
const { t } = require('../i18n');

// Rate limiter estricto para login y 2FA (prevención de fuerza bruta)
const strictAuthLimiter = rateLimit({
  windowMs: 3 * 60 * 1000, // 3 minutos
  max: 5, // máximo 5 intentos
  message: (req) => ({ 
    message: t('rateLimit.too_many_auth_attempts', req.lang || 'es', { minutes: 3 })
  }),
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // No contar requests exitosos
});

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
router.post('/login', strictAuthLimiter, authValidations.login, authController.login);
router.get('/2fa/setup', strictAuthLimiter, authController.setup2FA);
router.get('/2fa/status', authController.check2FAStatus);
router.get('/me', authMiddleware, async (req, res) => {
    try {
        const user = await userService.getUserProfile(req.user.id);
        
        if (!user) {
            logger.error(`[AuthRoutes] getUserProfile returned null for user.id: ${req.user.id}`);
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }
        
        // Buscar el customer_id usando el RUT (email del usuario)
        let customer_id = null;
        if (req.user.role === 'client') {
            customer_id = await userService.findCustomerIdByRut(req.user.rut || req.user.email);
        }
        
        const response = {
            id: req.user.id,
            rut: req.user.rut || req.user.email,
            email: user.email || null,
            full_name: user.full_name,
            phone: user.phone,
            country: user.country,
            city: user.city,
            role: req.user.role,
            role_id: req.user.roleId,
            role_cfg: crypto.createHash('md5').update(String(req.user.roleId)).digest('hex'),
            role_name: req.user.roleName || req.user.role,
            change_pw: user.change_pw,
            customer_id: customer_id,
            avatar_path: user.avatar_path || null
        };
        
        res.json(response);
    } catch (error) {
        logger.error(`[AuthRoutes] Error en me: ${error.message}`, error.stack);
        res.status(500).json({ message: 'Error interno' });
    }
});

router.post('/refresh', authMiddleware.createAuthMiddleware({ allowExpired: true }), authController.refreshToken);
router.post('/change-password', authMiddleware, authValidations.changePassword, authController.changePassword);
router.post('/recover', authValidations.recoverPassword, authController.recoverPassword);
router.post('/reset-password', authValidations.resetPassword, authController.resetPassword);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Cierra la sesión del usuario
 *     tags: [Autenticación]
 *     responses:
 *       200:
 *         description: Sesión cerrada correctamente
 */
router.post('/logout', authMiddleware, authController.logout);

/**
 * @swagger
 * /api/auth/generate-token:
 *   post:
 *     summary: Genera un token JWT válido con usuario y contraseña
 *     tags: [Autenticación]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 description: Email del usuario (alternativo a username)
 *               username:
 *                 type: string
 *                 description: Username del usuario (alternativo a email)
 *               password:
 *                 type: string
 *                 description: Contraseña del usuario
 *             required:
 *               - password
 *     responses:
 *       200:
 *         description: Token generado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 token:
 *                   type: string
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: number
 *                     rut:
 *                       type: string
 *                     username:
 *                       type: string
 *                     role:
 *                       type: string
 *       401:
 *         description: Credenciales inválidas
 *       403:
 *         description: Cuenta bloqueada
 */
router.post('/generate-token', authController.generateToken);

module.exports = router;
