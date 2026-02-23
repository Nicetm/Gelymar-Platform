const ADMIN_ROLE_IDS = [1];
const SELLER_ROLE_IDS = [3];
const CLIENT_ROLE_IDS = [2];

const ADMIN_ROLE_NAMES = ['admin', 'administrador'];
const SELLER_ROLE_NAMES = ['seller', 'ventas', 'vendedor'];
const CLIENT_ROLE_NAMES = ['client', 'cliente'];

const normalizeString = (value) =>
  (value || '').toString().toLowerCase().trim();

const normalizeRole = (roleName, roleId) => {
  const roleIdNumber = Number(roleId);
  const normalizedName = normalizeString(roleName);

  if (ADMIN_ROLE_IDS.includes(roleIdNumber)) {
    return 'admin';
  }

  if (SELLER_ROLE_IDS.includes(roleIdNumber)) {
    return 'seller';
  }

  if (CLIENT_ROLE_IDS.includes(roleIdNumber)) {
    return 'client';
  }

  if (ADMIN_ROLE_NAMES.includes(normalizedName)) {
    return 'admin';
  }

  if (SELLER_ROLE_NAMES.includes(normalizedName)) {
    return 'seller';
  }

  if (CLIENT_ROLE_NAMES.includes(normalizedName)) {
    return 'client';
  }

  return normalizedName || 'client';
};

module.exports = {
  normalizeRole,
  ADMIN_ROLE_IDS,
  SELLER_ROLE_IDS,
  CLIENT_ROLE_IDS,
  ADMIN_ROLE_NAMES,
  SELLER_ROLE_NAMES,
  CLIENT_ROLE_NAMES,
};
