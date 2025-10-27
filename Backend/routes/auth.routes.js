// /routes/auth.routes.js
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middleware/auth.middleware');
const userService = require('../services/user.service');
const { authValidations } = require('../middleware/validation.middleware');

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
router.post('/login', authValidations.login, authController.login);
router.get('/2fa/setup', authController.setup2FA);
router.get('/2fa/status', authController.check2FAStatus);
router.get('/me', authMiddleware, async (req, res) => {
    try {
        const user = await userService.findUserByEmailOrUsername(req.user.email);
        
        // Buscar el customer_id usando el RUT (email del usuario)
        let customer_id = null;
        if (req.user.role === 'client') {
            customer_id = await userService.findCustomerIdByRut(req.user.email);
        }
        
        res.json({
            id: req.user.id,
            email: req.user.email,
            full_name: user.full_name,
            phone: user.phone,
            country: user.country,
            city: user.city,
            role: req.user.role,
            role_id: req.user.roleId,
            role_cfg: crypto.createHash('md5').update(String(req.user.roleId)).digest('hex'),
            role_name: req.user.roleName || req.user.role,
            change_pw: user.change_pw,
            customer_id: customer_id
        });
    } catch (error) {
        console.error('Error en me:', error);
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

module.exports = router;
