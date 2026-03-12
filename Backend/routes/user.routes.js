// routes/user.routes.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { userValidations } = require('../middleware/validation.middleware');
const authMiddleware = require('../middleware/auth.middleware');
const { authorizeRoles } = require('../middleware/role.middleware');

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Obtiene todos los usuarios
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de usuarios
 *       401:
 *         description: No autorizado
 */
router.get('/', authMiddleware, authorizeRoles(['admin']), userController.getAllUsers);

/**
 * @swagger
 * /api/users/profile:
 *   get:
 *     summary: Obtiene el perfil del usuario autenticado
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Perfil del usuario
 *       401:
 *         description: No autorizado
 */
router.get('/profile', authMiddleware, userController.getProfile);

/**
 * @swagger
 * /api/users/profile:
 *   put:
 *     summary: Actualiza el perfil del usuario autenticado
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               full_name:
 *                 type: string
 *               phone:
 *                 type: string
 *               country:
 *                 type: string
 *               city:
 *                 type: string
 *     responses:
 *       200:
 *         description: Perfil actualizado
 *       400:
 *         description: Datos inválidos
 *       401:
 *         description: No autorizado
 */
router.put('/profile', authMiddleware, userValidations.updateProfile, userController.updateProfile);

/**
 * @swagger
 * /api/users/avatar:
 *   post:
 *     summary: Sube un avatar para el usuario autenticado
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               avatar:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Avatar subido correctamente
 *       400:
 *         description: Archivo inválido
 *       401:
 *         description: No autorizado
 */
router.post('/avatar', authMiddleware, (req, res, next) => {
  userController.uploadAvatar(req, res, (err) => {
    if (err) {
      const code = err.code === 'LIMIT_FILE_SIZE' ? 'AVATAR_TOO_LARGE' : 'AVATAR_UPLOAD_ERROR';
      return res.status(400).json({
        message: err.message || 'Error al subir avatar',
        code
      });
    }
    return next();
  });
}, userController.handleAvatarUpload);

// Admin users (role_id = 1)
router.get('/admins', authMiddleware, authorizeRoles(['admin']), userController.getAdminUsers);
router.get('/admins/presence', authMiddleware, authorizeRoles(['admin']), userController.getAdminPresenceList);
router.post('/admins', authMiddleware, authorizeRoles(['admin']), userController.createAdminUser);
router.patch('/admins/:id', authMiddleware, authorizeRoles(['admin']), userController.updateAdminUser);
router.delete('/admins/:id', authMiddleware, authorizeRoles(['admin']), userController.deleteAdminUser);
router.post('/admins/:id/reset-password', authMiddleware, authorizeRoles(['admin']), userController.resetAdminPassword);

// Block/Unblock user
router.get('/blocked-status/:rut', authMiddleware, authorizeRoles(['admin']), userController.getBlockedStatus);
router.put('/block/:rut', authMiddleware, authorizeRoles(['admin']), userController.updateBlockedStatus);

module.exports = router;
