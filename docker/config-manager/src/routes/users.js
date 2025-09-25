const express = require('express');
const router = express.Router();
const UserModel = require('../models/user.model');
const RoleMiddleware = require('../middleware/role.middleware');
const AuditMiddleware = require('../middleware/audit.middleware');
const bcrypt = require('bcryptjs');

const userModel = new UserModel();
const roleMiddleware = new RoleMiddleware();
const auditMiddleware = new AuditMiddleware();

// Aplicar middleware de autenticación a todas las rutas
router.use(require('../middleware/auth').requireAuth);

// Obtener todos los usuarios (solo admin)
router.get('/', 
  roleMiddleware.requireRole('admin'),
  auditMiddleware.logAction('user_list', 'user'),
  async (req, res) => {
    try {
      const users = await userModel.getAllUsers();
      
      // Remover contraseñas de la respuesta
      const safeUsers = users.map(user => {
        const { password, ...safeUser } = user;
        return safeUser;
      });

      res.json({
        success: true,
        data: safeUsers
      });
    } catch (error) {
      console.error('Error obteniendo usuarios:', error);
      res.status(500).json({
        success: false,
        message: 'Error obteniendo usuarios',
        error: error.message
      });
    }
  }
);

// Obtener usuario por ID
router.get('/:id',
  roleMiddleware.requirePermission('users.read'),
  async (req, res) => {
    try {
      const userId = req.params.id;
      
      // Verificar si el usuario puede acceder a este recurso
      if (req.user.role !== 'admin' && req.user.id !== parseInt(userId)) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para acceder a este usuario'
        });
      }

      const user = await userModel.getUserById(userId);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }

      // Remover contraseña de la respuesta
      const { password, ...safeUser } = user;

      res.json({
        success: true,
        data: safeUser
      });
    } catch (error) {
      console.error('Error obteniendo usuario:', error);
      res.status(500).json({
        success: false,
        message: 'Error obteniendo usuario',
        error: error.message
      });
    }
  }
);

// Crear nuevo usuario (solo admin)
router.post('/',
  roleMiddleware.requireRole('admin'),
  auditMiddleware.logAction('user_create', 'user'),
  async (req, res) => {
    try {
      const {
        username,
        email,
        password,
        role = 'user',
        permissions = '{}',
        is_active = true
      } = req.body;

      // Validaciones
      if (!username || !email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Username, email y password son requeridos'
        });
      }

      // Verificar si el username ya existe
      const usernameExists = await userModel.usernameExists(username);
      if (usernameExists) {
        return res.status(400).json({
          success: false,
          message: 'El username ya existe'
        });
      }

      // Verificar si el email ya existe
      const emailExists = await userModel.emailExists(email);
      if (emailExists) {
        return res.status(400).json({
          success: false,
          message: 'El email ya existe'
        });
      }

      // Encriptar contraseña
      const hashedPassword = await bcrypt.hash(password, 10);

      // Crear usuario
      const userId = await userModel.createUser({
        username,
        email,
        password: hashedPassword,
        role,
        permissions,
        is_active
      });

      // Registrar acción de auditoría
      await auditMiddleware.logManualAction(req, 'user_create', 'user', userId, {
        username,
        email,
        role,
        is_active
      });

      res.status(201).json({
        success: true,
        data: { id: userId },
        message: 'Usuario creado exitosamente'
      });
    } catch (error) {
      console.error('Error creando usuario:', error);
      res.status(500).json({
        success: false,
        message: 'Error creando usuario',
        error: error.message
      });
    }
  }
);

// Actualizar usuario
router.put('/:id',
  roleMiddleware.requirePermission('users.write'),
  auditMiddleware.logAction('user_update', 'user'),
  async (req, res) => {
    try {
      const userId = req.params.id;
      
      // Verificar si el usuario puede actualizar este recurso
      if (req.user.role !== 'admin' && req.user.id !== parseInt(userId)) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para actualizar este usuario'
        });
      }

      const {
        username,
        email,
        role,
        permissions,
        is_active
      } = req.body;

      // Verificar si el usuario existe
      const existingUser = await userModel.getUserById(userId);
      if (!existingUser) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }

      // Verificar si el username ya existe (excluyendo el usuario actual)
      if (username && username !== existingUser.username) {
        const usernameExists = await userModel.usernameExists(username, userId);
        if (usernameExists) {
          return res.status(400).json({
            success: false,
            message: 'El username ya existe'
          });
        }
      }

      // Verificar si el email ya existe (excluyendo el usuario actual)
      if (email && email !== existingUser.email) {
        const emailExists = await userModel.emailExists(email, userId);
        if (emailExists) {
          return res.status(400).json({
            success: false,
            message: 'El email ya existe'
          });
        }
      }

      // Solo los admin pueden cambiar roles y permisos
      const updateData = { username, email };
      if (req.user.role === 'admin') {
        updateData.role = role;
        updateData.permissions = permissions;
        updateData.is_active = is_active;
      }

      // Actualizar usuario
      const updated = await userModel.updateUser(userId, updateData);

      if (!updated) {
        return res.status(500).json({
          success: false,
          message: 'Error actualizando usuario'
        });
      }

      // Registrar acción de auditoría
      await auditMiddleware.logManualAction(req, 'user_update', 'user', userId, updateData);

      res.json({
        success: true,
        message: 'Usuario actualizado exitosamente'
      });
    } catch (error) {
      console.error('Error actualizando usuario:', error);
      res.status(500).json({
        success: false,
        message: 'Error actualizando usuario',
        error: error.message
      });
    }
  }
);

// Cambiar contraseña
router.put('/:id/password',
  roleMiddleware.requirePermission('users.write'),
  auditMiddleware.logAction('user_password_change', 'user'),
  async (req, res) => {
    try {
      const userId = req.params.id;
      const { currentPassword, newPassword } = req.body;

      // Verificar si el usuario puede cambiar la contraseña
      if (req.user.role !== 'admin' && req.user.id !== parseInt(userId)) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para cambiar esta contraseña'
        });
      }

      // Validaciones
      if (!newPassword) {
        return res.status(400).json({
          success: false,
          message: 'Nueva contraseña es requerida'
        });
      }

      // Obtener usuario
      const user = await userModel.getUserById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }

      // Verificar contraseña actual (solo si no es admin)
      if (req.user.role !== 'admin') {
        if (!currentPassword) {
          return res.status(400).json({
            success: false,
            message: 'Contraseña actual es requerida'
          });
        }

        const isValidPassword = await bcrypt.compare(currentPassword, user.password);
        if (!isValidPassword) {
          return res.status(400).json({
            success: false,
            message: 'Contraseña actual incorrecta'
          });
        }
      }

      // Encriptar nueva contraseña
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Actualizar contraseña
      const updated = await userModel.changePassword(userId, hashedPassword);

      if (!updated) {
        return res.status(500).json({
          success: false,
          message: 'Error cambiando contraseña'
        });
      }

      // Registrar acción de auditoría
      await auditMiddleware.logManualAction(req, 'user_password_change', 'user', userId, {
        changed_by: req.user.role === 'admin' ? 'admin' : 'self'
      });

      res.json({
        success: true,
        message: 'Contraseña cambiada exitosamente'
      });
    } catch (error) {
      console.error('Error cambiando contraseña:', error);
      res.status(500).json({
        success: false,
        message: 'Error cambiando contraseña',
        error: error.message
      });
    }
  }
);

// Eliminar usuario (solo admin)
router.delete('/:id',
  roleMiddleware.requireRole('admin'),
  auditMiddleware.logAction('user_delete', 'user'),
  async (req, res) => {
    try {
      const userId = req.params.id;

      // Verificar si el usuario existe
      const user = await userModel.getUserById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }

      // No permitir eliminar el propio usuario
      if (req.user.id === parseInt(userId)) {
        return res.status(400).json({
          success: false,
          message: 'No puedes eliminar tu propio usuario'
        });
      }

      // Eliminar usuario
      const deleted = await userModel.deleteUser(userId);

      if (!deleted) {
        return res.status(500).json({
          success: false,
          message: 'Error eliminando usuario'
        });
      }

      // Registrar acción de auditoría
      await auditMiddleware.logManualAction(req, 'user_delete', 'user', userId, {
        deleted_username: user.username,
        deleted_email: user.email
      });

      res.json({
        success: true,
        message: 'Usuario eliminado exitosamente'
      });
    } catch (error) {
      console.error('Error eliminando usuario:', error);
      res.status(500).json({
        success: false,
        message: 'Error eliminando usuario',
        error: error.message
      });
    }
  }
);

// Obtener estadísticas de usuarios (solo admin)
router.get('/stats/overview',
  roleMiddleware.requireRole('admin'),
  async (req, res) => {
    try {
      const stats = await userModel.getUserStats();

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error obteniendo estadísticas de usuarios:', error);
      res.status(500).json({
        success: false,
        message: 'Error obteniendo estadísticas de usuarios',
        error: error.message
      });
    }
  }
);

// Obtener usuarios por rol
router.get('/role/:role',
  roleMiddleware.requirePermission('users.read'),
  async (req, res) => {
    try {
      const role = req.params.role;
      const users = await userModel.getUsersByRole(role);

      // Remover contraseñas de la respuesta
      const safeUsers = users.map(user => {
        const { password, ...safeUser } = user;
        return safeUser;
      });

      res.json({
        success: true,
        data: safeUsers
      });
    } catch (error) {
      console.error('Error obteniendo usuarios por rol:', error);
      res.status(500).json({
        success: false,
        message: 'Error obteniendo usuarios por rol',
        error: error.message
      });
    }
  }
);

// Obtener usuarios activos
router.get('/active/list',
  roleMiddleware.requirePermission('users.read'),
  async (req, res) => {
    try {
      const users = await userModel.getActiveUsers();

      // Remover contraseñas de la respuesta
      const safeUsers = users.map(user => {
        const { password, ...safeUser } = user;
        return safeUser;
      });

      res.json({
        success: true,
        data: safeUsers
      });
    } catch (error) {
      console.error('Error obteniendo usuarios activos:', error);
      res.status(500).json({
        success: false,
        message: 'Error obteniendo usuarios activos',
        error: error.message
      });
    }
  }
);

// Obtener permisos del usuario actual
router.get('/me/permissions',
  async (req, res) => {
    try {
      const permissions = roleMiddleware.getUserPermissions(req.user);

      res.json({
        success: true,
        data: {
          user: {
            id: req.user.id,
            username: req.user.username,
            email: req.user.email,
            role: req.user.role
          },
          permissions
        }
      });
    } catch (error) {
      console.error('Error obteniendo permisos del usuario:', error);
      res.status(500).json({
        success: false,
        message: 'Error obteniendo permisos del usuario',
        error: error.message
      });
    }
  }
);

module.exports = router;
