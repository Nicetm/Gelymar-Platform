export function initSignIn(config = {}) {
  const {
    apiPublic = '',
    apiBase = '',
    adminAppUrl = '',
    clientAppUrl = '',
    sellerAppUrl = '',
    appContext = 'both',
    recaptchaSiteKey = '',
  } = config;

  let otpShown = false;
  const normalizedAppContext = (appContext || 'both').toLowerCase();

  const resolveApiOrigin = () => {
    const configuredBase = apiPublic || apiBase || '';
    if (typeof window === 'undefined' || !configuredBase) {
      return configuredBase;
    }

    const currentOrigin = window.location.origin || '';
    const isHttpsPortal = currentOrigin.startsWith('https://');
    const isInternalPortal = normalizedAppContext === 'admin' || normalizedAppContext === 'seller';

    if (!isHttpsPortal || isInternalPortal) {
      return configuredBase;
    }

    try {
      const configuredUrl = new URL(configuredBase);
      const pointsToInternalHost =
        configuredUrl.hostname === '172.20.10.151' && configuredUrl.protocol === 'http:';

      if (pointsToInternalHost) {
        return currentOrigin.replace(/\/$/, '');
      }
    } catch {
      // Si no es una URL válida, continuamos con la lógica siguiente.
    }

    return configuredBase || currentOrigin.replace(/\/$/, '');
  };

  const normalizePortalUrl = (url = '', fallbackPath = '/', preferCurrentOrigin = false) => {
    const fallback = fallbackPath.startsWith('/') ? fallbackPath : `/${fallbackPath}`;
    const trimmed = url.trim();

    if (!trimmed) {
      return fallback;
    }

    if (typeof window === 'undefined') {
      return trimmed;
    }

    const currentOrigin = window.location.origin || '';
    const isHttpsPortal = currentOrigin.startsWith('https://');

    try {
      const parsed = new URL(trimmed, currentOrigin);
      const pointsToInternalHost =
        parsed.protocol === 'http:' &&
        (parsed.hostname === '172.20.10.151' || parsed.hostname === 'localhost');

      if (preferCurrentOrigin && isHttpsPortal && pointsToInternalHost) {
        return `${currentOrigin}${parsed.pathname}${parsed.search}${parsed.hash}`;
      }

      return parsed.toString();
    } catch {
      return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    }
  };

  const normalizedAdminUrl = normalizePortalUrl(adminAppUrl || '/admin/', '/admin/');
  let normalizedClientUrl = normalizePortalUrl(clientAppUrl || '/client/documents', '/client/documents', true);
  if (normalizedClientUrl && !normalizedClientUrl.includes('/client/documents')) {
    const hasTrailingSlash = normalizedClientUrl.endsWith('/');
    normalizedClientUrl = `${normalizedClientUrl}${hasTrailingSlash ? '' : '/'}documents`;
  }
  const normalizedSellerUrl = normalizePortalUrl(sellerAppUrl || '/seller/', '/seller/');
  const resolvedApiBase = resolveApiOrigin();

  const ADMIN_ROLE_NAMES = ['admin', 'administrador'];
  const SELLER_ROLE_NAMES = ['seller', 'ventas', 'vendedor'];
  const CLIENT_ROLE_NAMES = ['client', 'cliente'];

  const parseJsonResponse = async (response) => {
    const contentType = response.headers?.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return response.json();
    }

    const rawBody = await response.text();
    const error = new Error('Unexpected non-JSON response');
    error.status = response.status;
    error.bodySnippet = rawBody.slice(0, 200);
    throw error;
  };

  localStorage.removeItem('token');
  localStorage.removeItem('orders_cache');
  localStorage.removeItem('customers_cache');
  localStorage.removeItem('orders_cache_timestamp');
  localStorage.removeItem('customers_cache_timestamp');
  localStorage.removeItem('customersWithoutAccount');

  const isAbsoluteUrl = (url) => /^https?:\/\//i.test(url);

  const navigateTo = (targetUrl) => {
    if (!targetUrl) return;
    if (isAbsoluteUrl(targetUrl)) {
      window.location.href = targetUrl;
    } else {
      window.location.href = targetUrl.startsWith('/') ? targetUrl : `/${targetUrl}`;
    }
  };

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

  const resolveOrigin = (url) => {
    if (typeof window === 'undefined') {
      return '';
    }
    try {
      return new URL(url || '', window.location.origin).origin;
    } catch {
      return '';
    }
  };

  const showPortalMismatchMessage = (message) => {
    const msg = document.getElementById('loginMessage');
    if (!msg) return;
    msg.textContent = message;
    msg.classList.remove('hidden');
    msg.classList.remove('text-green-600', 'text-blue-600');
    msg.classList.add('text-red-500');
  };

  const clearSessionAfterMismatch = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userProfile');
    localStorage.removeItem('cfg');
    document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  };

  const ensureResetMessage = () => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('reset') === 'success') {
      const successEl = document.getElementById('resetSuccessMessage');
      successEl?.classList.remove('hidden');
    }
  };

  const ensureRecaptchaScript = () => {
    if (!recaptchaSiteKey) {
      return;
    }

    const existingScript = document.querySelector('script[src*="recaptcha/api.js"]');
    if (!existingScript) {
      const script = document.createElement('script');
      script.src = 'https://www.google.com/recaptcha/api.js';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    const formData = new FormData(e.target);
    const username = formData.get('username')?.trim() || '';
    const password = formData.get('password') || '';
    const otp = formData.get('otp')?.trim() || '';
    let captchaResponse = '';

    const msg = document.getElementById('loginMessage');
    if (!msg) {
      return;
    }

    if (recaptchaSiteKey) {
      if (!window.grecaptcha || typeof window.grecaptcha.getResponse !== 'function') {
        msg.textContent = 'Captcha is not ready yet. Please wait a moment and try again.';
        msg.classList.remove('hidden');
        msg.classList.remove('text-green-600');
        msg.classList.add('text-red-500');
        return;
      }

      captchaResponse = window.grecaptcha.getResponse();
      if (!captchaResponse) {
        msg.textContent = 'Please confirm you are not a robot';
        msg.classList.remove('hidden');
        msg.classList.remove('text-green-600');
        msg.classList.add('text-red-500');
        return;
      }
    }

    if (!username || !password) {
      msg.textContent = 'Please complete all required fields';
      msg.classList.remove('hidden');
      msg.classList.remove('text-green-600');
      msg.classList.add('text-red-500');
      return;
    }

    msg.classList.add('hidden');
    msg.textContent = 'Iniciando sesión...';
    msg.classList.remove('hidden');
    msg.classList.remove('text-red-500');
    msg.classList.add('text-blue-600');

    try {
      const res = await fetch(`${resolvedApiBase}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, otp, captchaResponse }),
      });

      let data;
      try {
        data = await parseJsonResponse(res);
      } catch (parseError) {
        console.error('Respuesta inesperada del servicio de login:', parseError);
        msg.textContent = 'Authentication service unavailable. Please try again later.';
        msg.classList.remove('hidden');
        msg.classList.remove('text-blue-600', 'text-green-600');
        msg.classList.add('text-red-500');
        return;
      }

      if (!res.ok) {
        if (
          (data.message?.toLowerCase().includes('2fa') ||
            data.message?.toLowerCase().includes('código 2fa')) &&
          !otpShown
        ) {
          otpShown = true;
          document.getElementById('otpContainer')?.classList.remove('hidden');

          try {
            const statusRes = await fetch(
              `${resolvedApiBase}/api/auth/2fa/status?username=${encodeURIComponent(username)}`
            );
            const { twoFAEnabled } = await parseJsonResponse(statusRes);

            if (!twoFAEnabled) {
              document.getElementById('qrContainer')?.classList.remove('hidden');
              const qrRes = await fetch(
                `${resolvedApiBase}/api/auth/2fa/setup?username=${encodeURIComponent(username)}`
              );
              const { qr } = await parseJsonResponse(qrRes);
              const qrImg = document.getElementById('qrImage');
              if (qrImg) {
                qrImg.src = qr;
              }
            }
          } catch (twoFaError) {
            console.error('Error obteniendo estado 2FA:', twoFaError);
          }

          msg.textContent = 'Please enter your 2FA code from the authenticator app.';
          msg.classList.remove('hidden');
          msg.classList.remove('text-red-500');
          msg.classList.add('text-green-600');
          return;
        }

        msg.textContent = data.message || 'Login failed';
        msg.classList.remove('hidden');
        msg.classList.remove('text-green-600');
        msg.classList.add('text-red-500');
        return;
      }

      localStorage.setItem('token', data.token);
      document.cookie = `token=${data.token}; path=/; SameSite=Strict`;

      try {
        const meRes = await fetch(`${resolvedApiBase}/api/auth/me`, {
          headers: { Authorization: `Bearer ${data.token}` },
        });

        if (meRes.ok) {
          const user = await parseJsonResponse(meRes);
          const userRole = inferUserRole(user);

          if (user.change_pw === 0) {
            localStorage.setItem('userRole', userRole);
            window.location.href = '/authentication/change-password';
            return;
          }

          localStorage.setItem('cfg', user.role_cfg);
          localStorage.setItem('userRole', userRole);

          const resolveRoleLabel = (role) => {
            if (role === 'admin') return 'Admin';
            if (role === 'seller') return 'Seller';
            if (role === 'client') return 'Client';
            return 'Guest';
          };

          const profilePayload = {
            fullName: user.full_name ?? '',
            roleName:
              user.role ||
              resolveRoleLabel(userRole),
            email: user.email ?? '',
            avatarPath: user.avatar_path || '',
            avatarUrl:
              !user.avatar_path && user.full_name
                ? `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                    user.full_name
                  )}&backgroundColor=4b5563&fontColor=ffffff`
                : '',
          };
          localStorage.setItem('userProfile', JSON.stringify(profilePayload));

          const isAdminContext = normalizedAppContext === 'admin';
          const isClientContext = normalizedAppContext === 'client';
          const isSellerContext = normalizedAppContext === 'seller';
          const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
          const adminOrigin = resolveOrigin(normalizedAdminUrl);
          const clientOrigin = resolveOrigin(normalizedClientUrl);
          const sellerOrigin = resolveOrigin(normalizedSellerUrl);
          const isAdminHost = adminOrigin && currentOrigin === adminOrigin;
          const isClientHost = clientOrigin && currentOrigin === clientOrigin;
          const isSellerHost = sellerOrigin && currentOrigin === sellerOrigin;

          const allowAdminAccess = isAdminContext || isAdminHost;
          const allowSellerAccess = isSellerContext || isSellerHost;
          const allowClientAccess = isClientContext || isClientHost;

          const sellerLandingUrl = (() => {
            const trimmed = normalizedSellerUrl.trim();
            const defaultLandingPath = '/seller/orders';
            if (!trimmed) {
              return defaultLandingPath;
            }
            if (isAbsoluteUrl(trimmed)) {
              try {
                const parsed = new URL(trimmed);
                const normalizedPath = parsed.pathname.replace(/\/+$/, '');
                if (normalizedPath === '/seller') {
                  return `${parsed.origin}${defaultLandingPath}`;
                }
                return trimmed;
              } catch {
                return trimmed;
              }
            }
            const normalizedPath = trimmed.replace(/\/+$/, '');
            return normalizedPath === '/seller' ? defaultLandingPath : trimmed;
          })();

          if (userRole === 'admin') {
            if (!allowAdminAccess) {
              clearSessionAfterMismatch();
              showPortalMismatchMessage(
                'Acceso de administracion disponible solo desde la intranet. Usa el portal interno.'
              );
              return;
            }
            navigateTo(normalizedAdminUrl);
          } else if (userRole === 'seller') {
            if (!allowSellerAccess) {
              clearSessionAfterMismatch();
              const mismatchMessage =
                isAdminContext || isAdminHost
                  ? 'Acceso de vendedores disponible solo desde el portal de vendedores. Usa la URL de vendedores.'
                  : 'Portal de clientes disponible solo para clientes. Usa la URL de vendedores.';
              showPortalMismatchMessage(mismatchMessage);
              return;
            }
            navigateTo(sellerLandingUrl);
          } else {
            if (!allowClientAccess) {
              clearSessionAfterMismatch();
              const mismatchMessage =
                isAdminContext || isAdminHost
                  ? 'Portal de clientes disponible en el dominio publico. Usa la URL de clientes.'
                  : 'Portal de vendedores disponible solo para vendedores. Usa la URL de clientes.';
              showPortalMismatchMessage(mismatchMessage);
              return;
            }
            navigateTo(normalizedClientUrl);
          }
        } else {
          msg.textContent = 'Error validando usuario';
          msg.classList.remove('hidden');
          msg.classList.add('text-red-500');
        }
      } catch (error) {
        console.error('Error obteniendo rol:', error);
        msg.textContent = 'Error validando usuario';
        msg.classList.remove('hidden');
        msg.classList.add('text-red-500');
      }
    } catch (err) {
      console.error('Error en login:', err);
      msg.textContent = 'Connection error';
      msg.classList.remove('hidden');
      msg.classList.add('text-red-500');
    } finally {
      if (recaptchaSiteKey && window.grecaptcha && typeof window.grecaptcha.reset === 'function') {
        window.grecaptcha.reset();
      }
    }
  };

  const setup = () => {
    ensureResetMessage();
    ensureRecaptchaScript();

    const form = document.getElementById('loginForm');
    if (!form) {
      return;
    }

    form.removeEventListener('submit', handleSubmit);
    form.addEventListener('submit', handleSubmit);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup, { once: true });
  } else {
    setup();
  }
}
