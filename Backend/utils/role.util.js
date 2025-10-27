const ADMIN_ROLE_IDS = [1, 3];
const CLIENT_ROLE_IDS = [2];

const ADMIN_ROLE_NAMES = ['admin', 'administrador', 'seller', 'ventas', 'vendedor'];
const CLIENT_ROLE_NAMES = ['client', 'cliente'];

const normalizeString = (value) =>
  (value || '').toString().toLowerCase().trim();

const normalizeRole = (roleName, roleId) => {
  const roleIdNumber = Number(roleId);
  const normalizedName = normalizeString(roleName);

  if (ADMIN_ROLE_IDS.includes(roleIdNumber)) {
    return 'admin';
  }

  if (CLIENT_ROLE_IDS.includes(roleIdNumber)) {
    return 'client';
  }

  if (ADMIN_ROLE_NAMES.includes(normalizedName)) {
    return 'admin';
  }

  if (CLIENT_ROLE_NAMES.includes(normalizedName)) {
    return 'client';
  }

  return normalizedName || 'client';
};

module.exports = {
  normalizeRole,
  ADMIN_ROLE_IDS,
  CLIENT_ROLE_IDS,
  ADMIN_ROLE_NAMES,
  CLIENT_ROLE_NAMES,
};
