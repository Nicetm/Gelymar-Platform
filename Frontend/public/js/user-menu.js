export function initUserMenu(config = {}) {
  const {
    apiBase = '',
    fileServer = '',
  } = config;

  if (typeof window === 'undefined') return;

  const API_BASE = apiBase || window.apiBase || '';
  const FILE_SERVER = fileServer || window.fileServer || '';

  const translations = window.translations || {};
  const usermenu = translations.usermenu || {};
  const getMessage = (value) => (typeof value === 'string' ? value : '');

  const ADMIN_ROLE_NAMES = ['admin', 'administrador'];
  const SELLER_ROLE_NAMES = ['seller', 'ventas', 'vendedor'];
  const CLIENT_ROLE_NAMES = ['client', 'cliente'];

  const normalizeRoleName = (value) => (value || '').toString().toLowerCase().trim();

  const inferUserRole = (user = {}) => {
    const roleId = Number(user.role_id);
    const normalizedRole = normalizeRoleName(user.role);

    if (roleId === 1) return 'admin';
    if (roleId === 2) return 'client';
    if (roleId === 3) return 'seller';

    if (ADMIN_ROLE_NAMES.includes(normalizedRole)) return 'admin';
    if (SELLER_ROLE_NAMES.includes(normalizedRole)) return 'seller';
    if (CLIENT_ROLE_NAMES.includes(normalizedRole)) return 'client';

    return normalizedRole || 'client';
  };

  const roleLabels = {
    admin: getMessage(usermenu.role_admin),
    seller: getMessage(usermenu.role_seller),
    client: getMessage(usermenu.role_client),
  };

  const resolveRoleLabel = (roleKey) => {
    return roleLabels[roleKey] || getMessage(usermenu.role_guest);
  };

  const logoutButton = document.getElementById('logoutButton');
  const nameEl = document.querySelector('#userFullName');
  const roleEl = document.querySelector('#userRole');
  const rutEl = document.querySelector('#userRut');
  /** @type {HTMLImageElement|null} */
  const avatarEl = document.querySelector('#userAvatar');

  if (logoutButton) {
    logoutButton.addEventListener('click', async () => {
      try {
        const token = localStorage.getItem('token');

        if (token) {
          try {
            await fetch(`${API_BASE}/api/auth/logout`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
            });
          } catch (error) {
            console.error('Error calling logout endpoint:', error);
          }
        }

        localStorage.removeItem('token');
        localStorage.removeItem('userRole');
        localStorage.removeItem('userRut');
        localStorage.removeItem('userEmail');
        document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
        window.location.href = '/authentication/sign-in';
      } catch (err) {
        console.error('Error logging out:', err);
        window.location.href = '/authentication/sign-in';
      }
    });
  }

  if (!nameEl || !rutEl || !avatarEl || !roleEl) {
    return;
  }

  const applyUserProfile = (profile = {}) => {
    const {
      fullName,
      roleName,
      rut,
      avatarPath,
      avatarUrl,
    } = profile;

    if (fullName) {
      nameEl.textContent = fullName;
    }
    if (roleName) {
      roleEl.textContent = roleName;
    }
    if (rut) {
      rutEl.textContent = rut;
    }

    if (avatarPath) {
      avatarEl.src = `${FILE_SERVER}/${avatarPath}`;
    } else if (avatarUrl) {
      avatarEl.src = avatarUrl;
    } else if (fullName) {
      avatarEl.src = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(fullName)}&backgroundColor=4b5563&fontColor=ffffff`;
    }
  };

  const loadCachedProfile = () => {
    try {
      const cachedProfileRaw = localStorage.getItem('userProfile');
      if (cachedProfileRaw) {
        const cachedProfile = JSON.parse(cachedProfileRaw);
        applyUserProfile(cachedProfile);
      }
    } catch (error) {
      console.warn('[UserMenu] Error parsing cached user profile:', error);
    }
  };

  const fetchProfile = async () => {
    let clientToken =
      localStorage.getItem('token') ||
      localStorage.getItem('accessToken') ||
      localStorage.getItem('jwt') ||
      null;

    if (!clientToken) {
      const match = document.cookie.match(/(?:^|; )(?:token|accessToken|jwt)=([^;]+)/);
      clientToken = match ? decodeURIComponent(match[1]) : null;
    }

    if (!clientToken) return;

    try {
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        headers: clientToken ? { Authorization: `Bearer ${clientToken}` } : undefined,
      });

      if (!res.ok) return;

      const u = await res.json();

      const fullName = u.full_name ?? 'User';
      const userRole = inferUserRole(u);
      const roleNameClient = u.role ?? resolveRoleLabel(userRole);
      const rut = u.rut ?? u.email ?? '';
      const contactEmail = u.email ?? '';

      const profilePayload = {
        fullName,
        roleName: roleNameClient,
        rut,
        avatarPath: u.avatar_path || '',
        avatarUrl: !u.avatar_path && u.full_name
          ? `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(u.full_name)}&backgroundColor=4b5563&fontColor=ffffff`
          : '',
      };

      applyUserProfile(profilePayload);
      localStorage.setItem('userRole', userRole);
      localStorage.setItem('userProfile', JSON.stringify(profilePayload));
      if (rut) {
        localStorage.setItem('userRut', rut);
      }
      if (contactEmail) {
        localStorage.setItem('userEmail', contactEmail);
      }
    } catch (err) {
      console.error('Client-side user fetch failed:', err);
    }
  };

  const bootstrap = () => {
    loadCachedProfile();
    fetchProfile();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
  } else {
    bootstrap();
  }
}
