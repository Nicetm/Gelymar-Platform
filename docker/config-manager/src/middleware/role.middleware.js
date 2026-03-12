const UserModel = require('../models/user.model');

class RoleMiddleware {
  constructor() {
    this.userModel = new UserModel();
  }

  // Middleware para verificar roles
  requireRole(requiredRoles) {
    return async (req, res, next) => {
      try {
        // Verificar si el usuario está autenticado
        if (!req.session || !req.session.userId) {
          return res.status(401).json({
            success: false,
            message: 'Acceso no autorizado'
          });
        }

        // Obtener información del usuario
        const user = await this.userModel.getUserById(req.session.userId);
        
        if (!user) {
          return res.status(401).json({
            success: false,
            message: 'Usuario no encontrado'
          });
        }

        // Verificar si el usuario está activo
        if (!user.is_active) {
          return res.status(403).json({
            success: false,
            message: 'Usuario inactivo'
          });
        }

        // Convertir requiredRoles a array si es string
        const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];

        // Verificar si el usuario tiene el rol requerido
        if (!roles.includes(user.role)) {
          return res.status(403).json({
            success: false,
            message: 'Permisos insuficientes',
            required: roles,
            current: user.role
          });
        }

        // Agregar información del usuario a la request
        req.user = user;
        next();
      } catch (error) {
        console.error('Error en middleware de roles:', error);
        res.status(500).json({
          success: false,
          message: 'Error verificando permisos'
        });
      }
    };
  }

  // Middleware para verificar permisos específicos
  requirePermission(requiredPermission) {
    return async (req, res, next) => {
      try {
        // Verificar si el usuario está autenticado
        if (!req.session || !req.session.userId) {
          return res.status(401).json({
            success: false,
            message: 'Acceso no autorizado'
          });
        }

        // Obtener información del usuario
        const user = await this.userModel.getUserById(req.session.userId);
        
        if (!user) {
          return res.status(401).json({
            success: false,
            message: 'Usuario no encontrado'
          });
        }

        // Verificar si el usuario está activo
        if (!user.is_active) {
          return res.status(403).json({
            success: false,
            message: 'Usuario inactivo'
          });
        }

        // Los administradores tienen todos los permisos
        if (user.role === 'admin') {
          req.user = user;
          return next();
        }

        // Verificar permisos específicos
        let permissions = {};
        try {
          permissions = JSON.parse(user.permissions || '{}');
        } catch (error) {
          console.error('Error parseando permisos del usuario:', error);
        }

        // Verificar si el usuario tiene el permiso requerido
        if (!permissions[requiredPermission]) {
          return res.status(403).json({
            success: false,
            message: 'Permiso insuficiente',
            required: requiredPermission,
            current: permissions
          });
        }

        // Agregar información del usuario a la request
        req.user = user;
        next();
      } catch (error) {
        console.error('Error en middleware de permisos:', error);
        res.status(500).json({
          success: false,
          message: 'Error verificando permisos'
        });
      }
    };
  }

  // Middleware para verificar múltiples permisos (todos requeridos)
  requireAllPermissions(requiredPermissions) {
    return async (req, res, next) => {
      try {
        // Verificar si el usuario está autenticado
        if (!req.session || !req.session.userId) {
          return res.status(401).json({
            success: false,
            message: 'Acceso no autorizado'
          });
        }

        // Obtener información del usuario
        const user = await this.userModel.getUserById(req.session.userId);
        
        if (!user) {
          return res.status(401).json({
            success: false,
            message: 'Usuario no encontrado'
          });
        }

        // Verificar si el usuario está activo
        if (!user.is_active) {
          return res.status(403).json({
            success: false,
            message: 'Usuario inactivo'
          });
        }

        // Los administradores tienen todos los permisos
        if (user.role === 'admin') {
          req.user = user;
          return next();
        }

        // Verificar permisos específicos
        let permissions = {};
        try {
          permissions = JSON.parse(user.permissions || '{}');
        } catch (error) {
          console.error('Error parseando permisos del usuario:', error);
        }

        // Verificar si el usuario tiene todos los permisos requeridos
        const missingPermissions = requiredPermissions.filter(permission => !permissions[permission]);

        if (missingPermissions.length > 0) {
          return res.status(403).json({
            success: false,
            message: 'Permisos insuficientes',
            required: requiredPermissions,
            missing: missingPermissions,
            current: permissions
          });
        }

        // Agregar información del usuario a la request
        req.user = user;
        next();
      } catch (error) {
        console.error('Error en middleware de permisos múltiples:', error);
        res.status(500).json({
          success: false,
          message: 'Error verificando permisos'
        });
      }
    };
  }

  // Middleware para verificar al menos uno de los permisos
  requireAnyPermission(requiredPermissions) {
    return async (req, res, next) => {
      try {
        // Verificar si el usuario está autenticado
        if (!req.session || !req.session.userId) {
          return res.status(401).json({
            success: false,
            message: 'Acceso no autorizado'
          });
        }

        // Obtener información del usuario
        const user = await this.userModel.getUserById(req.session.userId);
        
        if (!user) {
          return res.status(401).json({
            success: false,
            message: 'Usuario no encontrado'
          });
        }

        // Verificar si el usuario está activo
        if (!user.is_active) {
          return res.status(403).json({
            success: false,
            message: 'Usuario inactivo'
          });
        }

        // Los administradores tienen todos los permisos
        if (user.role === 'admin') {
          req.user = user;
          return next();
        }

        // Verificar permisos específicos
        let permissions = {};
        try {
          permissions = JSON.parse(user.permissions || '{}');
        } catch (error) {
          console.error('Error parseando permisos del usuario:', error);
        }

        // Verificar si el usuario tiene al menos uno de los permisos requeridos
        const hasPermission = requiredPermissions.some(permission => permissions[permission]);

        if (!hasPermission) {
          return res.status(403).json({
            success: false,
            message: 'Permisos insuficientes',
            required: requiredPermissions,
            current: permissions
          });
        }

        // Agregar información del usuario a la request
        req.user = user;
        next();
      } catch (error) {
        console.error('Error en middleware de permisos alternativos:', error);
        res.status(500).json({
          success: false,
          message: 'Error verificando permisos'
        });
      }
    };
  }

  // Middleware para verificar si el usuario es propietario del recurso
  requireOwnership(resourceIdParam = 'id') {
    return async (req, res, next) => {
      try {
        // Verificar si el usuario está autenticado
        if (!req.session || !req.session.userId) {
          return res.status(401).json({
            success: false,
            message: 'Acceso no autorizado'
          });
        }

        // Obtener información del usuario
        const user = await this.userModel.getUserById(req.session.userId);
        
        if (!user) {
          return res.status(401).json({
            success: false,
            message: 'Usuario no encontrado'
          });
        }

        // Los administradores pueden acceder a todo
        if (user.role === 'admin') {
          req.user = user;
          return next();
        }

        // Verificar si el usuario es propietario del recurso
        const resourceId = req.params[resourceIdParam];
        
        if (resourceId && resourceId !== user.id.toString()) {
          return res.status(403).json({
            success: false,
            message: 'Solo puedes acceder a tus propios recursos'
          });
        }

        // Agregar información del usuario a la request
        req.user = user;
        next();
      } catch (error) {
        console.error('Error en middleware de propiedad:', error);
        res.status(500).json({
          success: false,
          message: 'Error verificando propiedad del recurso'
        });
      }
    };
  }

  // Función helper para verificar roles
  hasRole(user, requiredRoles) {
    const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
    return roles.includes(user.role);
  }

  // Función helper para verificar permisos
  hasPermission(user, requiredPermission) {
    if (user.role === 'admin') {
      return true;
    }

    let permissions = {};
    try {
      permissions = JSON.parse(user.permissions || '{}');
    } catch (error) {
      return false;
    }

    return permissions[requiredPermission] === true;
  }

  // Función helper para obtener permisos del usuario
  getUserPermissions(user) {
    if (user.role === 'admin') {
      return {
        containers: { read: true, write: true, delete: true },
        config: { read: true, write: true, delete: true },
        users: { read: true, write: true, delete: true },
        system: { read: true, write: true, delete: true },
        audit: { read: true, write: true, delete: true }
      };
    }

    let permissions = {};
    try {
      permissions = JSON.parse(user.permissions || '{}');
    } catch (error) {
      return {};
    }

    return permissions;
  }
}

module.exports = RoleMiddleware;
