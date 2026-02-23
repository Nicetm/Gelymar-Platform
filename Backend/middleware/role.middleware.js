const {
  ADMIN_ROLE_IDS,
  SELLER_ROLE_IDS,
  CLIENT_ROLE_IDS,
  ADMIN_ROLE_NAMES,
  SELLER_ROLE_NAMES,
  CLIENT_ROLE_NAMES
} = require('../utils/role.util');
const { logger } = require('../utils/logger');

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

  if (SELLER_ROLE_NAMES.includes(normalized)) {
    return 'seller';
  }

  return normalized;
};

const isAdminRoleId = (roleId) => ADMIN_ROLE_IDS.includes(Number(roleId));
const isSellerRoleId = (roleId) => SELLER_ROLE_IDS.includes(Number(roleId));
const isClientRoleId = (roleId) => CLIENT_ROLE_IDS.includes(Number(roleId));

const authorizeRoles = (allowedRoles) => {
  return (req, res, next) => {
    const userRole = aliasRole(req.user?.role || req.user?.roleName || req.user?.role_name);
    const userRoleId = req.user?.roleId ?? req.user?.role_id ?? req.user?.roleID;

    if (!userRole) {
      logger.warn(`[authorizeRoles] rol no detectado path=${req.originalUrl || req.path} role=${req.user?.role || req.user?.roleName || 'N/A'} roleId=${req.user?.roleId ?? req.user?.role_id ?? 'N/A'}`);
      return res.status(403).json({ message: 'No se detectó el rol del usuario' });
    }

    const normalizedAllowedRoles = allowedRoles.map(aliasRole);

    const hasAccess =
      normalizedAllowedRoles.includes(userRole) ||
      (normalizedAllowedRoles.includes('admin') && isAdminRoleId(userRoleId)) ||
      (normalizedAllowedRoles.includes('seller') && isSellerRoleId(userRoleId)) ||
      (normalizedAllowedRoles.includes('client') && isClientRoleId(userRoleId));

    if (!hasAccess) {
      logger.warn(`[authorizeRoles] acceso denegado path=${req.originalUrl || req.path} role=${userRole} roleId=${userRoleId ?? 'N/A'} allowed=${normalizedAllowedRoles.join(',')}`);
      return res.status(403).json({ message: 'Acceso no autorizado para este recurso' });
    }

    next();
  };
};

module.exports = { authorizeRoles };
