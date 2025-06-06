/**
 * Middleware para validar el rol del usuario autenticado
 * Solo permite continuar si el rol está incluido en los roles permitidos
 *
 * @param {Array<string>} allowedRoles - Lista de roles autorizados (ej: ['admin'])
 */
const authorizeRoles = (allowedRoles) => {
  return (req, res, next) => {
    const userRole = req.user?.role?.toLowerCase().trim();
    console.log('🔐 Rol detectado:', userRole);
    console.log('🎯 Roles permitidos en esta ruta:', allowedRoles);

    if (!userRole) {
      return res.status(403).json({ message: 'No se detectó el rol del usuario' });
    }

    if (!allowedRoles.includes(userRole)) {
      console.log("🚫 No autorizado", { userRole, allowedRoles });
      return res.status(403).json({ message: 'Acceso no autorizado para este recurso' });
    }

    next();
  };
};

module.exports = { authorizeRoles };
