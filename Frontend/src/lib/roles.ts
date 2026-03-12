type UserLike = {
  role?: string | null;
  role_id?: number | string | null;
};

const ADMIN_ROLE_IDS = new Set([1]);
const SELLER_ROLE_IDS = new Set([3]);
const CLIENT_ROLE_IDS = new Set([2]);

const ADMIN_ROLE_NAMES = new Set(['admin', 'administrador']);
const SELLER_ROLE_NAMES = new Set(['seller', 'ventas', 'vendedor']);
const CLIENT_ROLE_NAMES = new Set(['client', 'cliente']);

export const ROLE_LABELS = {
  admin: 'Admin',
  seller: 'Seller',
  client: 'Client',
} as const;

const normalizeRoleName = (value: unknown): string =>
  (value ?? '').toString().toLowerCase().trim();

export const inferUserRole = (user?: UserLike | null): string => {
  if (!user) {
    return 'client';
  }

  const roleId = Number(user.role_id);
  if (Number.isInteger(roleId)) {
    if (ADMIN_ROLE_IDS.has(roleId)) return 'admin';
    if (SELLER_ROLE_IDS.has(roleId)) return 'seller';
    if (CLIENT_ROLE_IDS.has(roleId)) return 'client';
  }

  const normalizedRole = normalizeRoleName(user.role);
  if (ADMIN_ROLE_NAMES.has(normalizedRole)) return 'admin';
  if (SELLER_ROLE_NAMES.has(normalizedRole)) return 'seller';
  if (CLIENT_ROLE_NAMES.has(normalizedRole)) return 'client';

  return normalizedRole || 'client';
};

export const resolveRoleLabel = (roleValue: string | null | undefined): string => {
  const normalized = normalizeRoleName(roleValue);
  if (normalized && ROLE_LABELS[normalized as keyof typeof ROLE_LABELS]) {
    return ROLE_LABELS[normalized as keyof typeof ROLE_LABELS];
  }
  return ROLE_LABELS.client;
};

export const isAdminRole = (user?: UserLike | null): boolean => inferUserRole(user) === 'admin';
export const isSellerRole = (user?: UserLike | null): boolean => inferUserRole(user) === 'seller';
export const isClientRole = (user?: UserLike | null): boolean => inferUserRole(user) === 'client';

