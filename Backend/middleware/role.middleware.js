const { ADMIN_ROLE_IDS, CLIENT_ROLE_IDS, ADMIN_ROLE_NAMES, CLIENT_ROLE_NAMES } = require('../utils/role.util');

const normalizeString = (value) =>
  (value || '').toString().toLowerCase().trim();

const aliasRole = (role) => {
  const normalized = normalizeString(role);

  if (CLIENT_ROLE_NAMES.includes(normalized)) {
    return 'client';
  }

  if (ADMIN_ROLE_NAMES.includes(normalized)) {
    return 'admin';
  }

  return normalized;
};

const isAdminRoleId = (roleId) => ADMIN_ROLE_IDS.includes(Number(roleId));
const isClientRoleId = (roleId) => CLIENT_ROLE_IDS.includes(Number(roleId));

const authorizeRoles = (allowedRoles) => {
  return (req, res, next) => {
    const userRole = aliasRole(req.user?.role);
    const userRoleId = req.user?.roleId;

    if (!userRole) {
      return res.status(403).json({ message: 'No se detectó el rol del usuario' });
    }

    const normalizedAllowedRoles = allowedRoles.map(aliasRole);

    const hasAccess =
      normalizedAllowedRoles.includes(userRole) ||
      (normalizedAllowedRoles.includes('admin') && isAdminRoleId(userRoleId)) ||
      (normalizedAllowedRoles.includes('client') && isClientRoleId(userRoleId));

    if (!hasAccess) {
      return res.status(403).json({ message: 'Acceso no autorizado para este recurso' });
    }

    next();
  };
};

module.exports = { authorizeRoles };
