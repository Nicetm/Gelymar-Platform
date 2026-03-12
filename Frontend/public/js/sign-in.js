export function initSignIn(config = {}) {
  const {
    apiPublic = '',
    apiBase = '',
    adminAppUrl = '',
    clientAppUrl = '',
    sellerAppUrl = '',
    appContext = 'both',
    recaptchaSiteKey = '',
    recaptchaEnabled = true,
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

  const normalizedAdminUrl = normalizePortalUrl(adminAppUrl || '/admin/orders', '/admin/orders');
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

  const translations = config.translations || {};
  const getText = (key, fallback, vars = {}) => {
    let value = translations?.comond?.[key] || fallback;
    Object.entries(vars).forEach(([k, v]) => {
      value = value.replace(`{${k}}`, String(v));
    });
    return value;
  };

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
  localStorage.removeItem('clientSearchFilter');
  localStorage.removeItem('userProfile');
  
  // Limpiar cachés de notificaciones
  localStorage.removeItem('adminNotificationsCache');
  localStorage.removeItem('adminNotificationsCacheTs');
  localStorage.removeItem('adminNotificationsCacheToken');
  
  // Limpiar todos los cachés de folders (patrón folders_cache_*)
  Object.keys(localStorage).forEach(key => {
    if (key.startsWith('folders_cache_')) {
      localStorage.removeItem(key);
    }
  });

  const isAbsoluteUrl = (url) => /^https?:\/\//i.test(url);

  const navigateTo = (targetUrl) => {
    if (!targetUrl) return;
    
    // Usar replace para evitar que el usuario vuelva atrás al login
    if (isAbsoluteUrl(targetUrl)) {
      window.location.replace(targetUrl);
    } else {
      window.location.replace(targetUrl.startsWith('/') ? targetUrl : `/${targetUrl}`);
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
    if (!recaptchaSiteKey || !recaptchaEnabled) {
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
    const rememberMe = formData.get('rememberMe') === 'on';
    let captchaResponse = '';

    const msg = document.getElementById('loginMessage');
    if (!msg) {
      return;
    }

    if (recaptchaSiteKey && recaptchaEnabled) {
      if (!window.grecaptcha || typeof window.grecaptcha.getResponse !== 'function') {
        msg.textContent = getText('captcha_not_ready', 'Captcha is not ready yet. Please wait and try again.');
        msg.classList.remove('hidden');
        msg.classList.remove('text-green-600');
        msg.classList.add('text-red-500');
        return;
      }

      captchaResponse = window.grecaptcha.getResponse();
      if (!captchaResponse) {
        msg.textContent = getText('captcha_required', 'Please confirm you are not a robot');
        msg.classList.remove('hidden');
        msg.classList.remove('text-green-600');
        msg.classList.add('text-red-500');
        return;
      }
    }

    if (!username || !password) {
      msg.textContent = getText('required_fields', 'Please complete all required fields');
      msg.classList.remove('hidden');
      msg.classList.remove('text-green-600');
      msg.classList.add('text-red-500');
      return;
    }

    const rutPattern = /^\d{7,8}-[0-9kK]$/;
    if (!rutPattern.test(username)) {
      msg.textContent = getText('invalid_rut', 'RUT must be numbers, a hyphen, and one digit or letter. e.g., 15060791-4');
      msg.classList.remove('hidden');
      msg.classList.remove('text-green-600');
      msg.classList.add('text-red-500');
      return;
    }

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn ? submitBtn.textContent : '';
    const originalBtnHtml = submitBtn ? submitBtn.innerHTML : '';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.classList.add('inline-flex', 'items-center', 'justify-center', 'gap-2');
      submitBtn.innerHTML = `
        <svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
        </svg>
        <span>${getText('signing_in', 'Signing in...')}</span>
      `;
      submitBtn.classList.add('opacity-70', 'cursor-not-allowed');
    }

    msg.classList.add('hidden');
    msg.textContent = getText('signing_in', 'Signing in...');
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
        msg.textContent = getText('auth_unavailable', 'Authentication service unavailable. Please try again later.');
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

          msg.textContent = getText('enter_2fa', 'Please enter your 2FA code from the authenticator app.');
          msg.classList.remove('hidden');
          msg.classList.remove('text-red-500');
          msg.classList.add('text-green-600');
          return;
        }

        if (data?.error === 'ACCOUNT_BLOCKED') {
          msg.textContent = getText('account_blocked', 'Your account has been blocked due to failed attempts. Please contact an administrator.');
        } else if (typeof data?.remainingAttempts === 'number') {
          msg.textContent = getText(
            'login_attempts_remaining',
            'Invalid credentials. {count} attempts remaining.',
            { count: data.remainingAttempts }
          );
        } else {
          msg.textContent = data.message || getText('login_failed', 'Invalid credentials');
        }
        msg.classList.remove('hidden');
        msg.classList.remove('text-green-600');
        msg.classList.add('text-red-500');
        return;
      }

      localStorage.setItem('token', data.token);
      
      // Setear cookie con SameSite=Lax para que se envíe en navegaciones
      const maxAge = 60 * 60; // 1 hora
      document.cookie = `token=${data.token}; path=/; SameSite=Lax; max-age=${maxAge}`;
      
      console.log('[DEBUG] Token saved to localStorage:', localStorage.getItem('token') ? 'YES' : 'NO');
      console.log('[DEBUG] Cookie set:', document.cookie.includes('token=') ? 'YES' : 'NO');
      console.log('[DEBUG] Redirect URL from backend:', data.redirectUrl);
      
      if (rememberMe) {
        localStorage.setItem('rememberedRut', username);
        localStorage.setItem('rememberMe', '1');
      } else {
        localStorage.removeItem('rememberedRut');
        localStorage.removeItem('rememberMe');
      }

      try {
        const meRes = await fetch(`${resolvedApiBase}/api/auth/me`, {
          headers: { Authorization: `Bearer ${data.token}` },
        });

        console.log('[DEBUG] /api/auth/me response status:', meRes.status, meRes.ok);

        if (meRes.ok) {
          const user = await parseJsonResponse(meRes);
          console.log('[DEBUG] User data received:', user);

          if (user.change_pw === 0) {
            console.log('[DEBUG] User needs to change password, redirecting...');
            localStorage.setItem('userRole', inferUserRole(user));
            window.location.replace('/authentication/change-password');
            return;
          }

          localStorage.setItem('cfg', user.role_cfg);
          localStorage.setItem('userRole', inferUserRole(user));

          const resolveRoleLabel = (role) => {
            if (role === 'admin') return 'Admin';
            if (role === 'seller') return 'Seller';
            if (role === 'client') return 'Client';
            return 'Guest';
          };

          const profilePayload = {
            fullName: user.full_name ?? '',
            roleName: user.role || resolveRoleLabel(inferUserRole(user)),
            rut: user.rut ?? user.email ?? '',
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
          if (profilePayload.rut) {
            localStorage.setItem('userRut', profilePayload.rut);
          }
          if (profilePayload.email) {
            localStorage.setItem('userEmail', profilePayload.email);
          }

          // Usar la URL de redirección del backend
          const redirectTarget = data.redirectUrl || '/admin/orders';
          console.log('[DEBUG] Final redirect target:', redirectTarget);
          navigateTo(redirectTarget);
        } else {
          console.error('[DEBUG] /api/auth/me failed with status:', meRes.status);
          msg.textContent = 'Error validando usuario';
          msg.classList.remove('hidden');
          msg.classList.add('text-red-500');
        }
      } catch (error) {
        console.error('Error obteniendo rol:', error);
        msg.textContent = getText('login_failed', 'Invalid credentials');
        msg.classList.remove('hidden');
        msg.classList.add('text-red-500');
      }
    } catch (err) {
      console.error('Error en login:', err);
      msg.textContent = getText('connection_error', 'Connection error');
      msg.classList.remove('hidden');
      msg.classList.add('text-red-500');
    } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnHtml || originalBtnText;
      submitBtn.classList.remove('inline-flex', 'items-center', 'justify-center', 'gap-2');
      submitBtn.classList.remove('opacity-70', 'cursor-not-allowed');
    }
      if (recaptchaSiteKey && recaptchaEnabled && window.grecaptcha && typeof window.grecaptcha.reset === 'function') {
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

    const rememberedRut = localStorage.getItem('rememberedRut') || '';
    const rememberMe = localStorage.getItem('rememberMe') === '1';
    const usernameInput = document.getElementById('username');
    const rememberMeInput = document.getElementById('rememberMe');
    if (usernameInput && rememberedRut) {
      usernameInput.value = rememberedRut;
    }
    if (rememberMeInput) {
      rememberMeInput.checked = rememberMe;
    }

    const passwordInput = document.getElementById('password');
    const togglePasswordBtn = document.getElementById('togglePasswordBtn');
    const togglePasswordIcon = document.getElementById('togglePasswordIcon');
    const togglePasswordIconOff = document.getElementById('togglePasswordIconOff');
    if (passwordInput && togglePasswordBtn) {
      const labelShow = togglePasswordBtn.dataset.labelShow || 'Show password';
      const labelHide = togglePasswordBtn.dataset.labelHide || 'Hide password';
      togglePasswordBtn.addEventListener('click', () => {
        const isVisible = passwordInput.type === 'text';
        passwordInput.type = isVisible ? 'password' : 'text';
        togglePasswordIcon?.classList.toggle('hidden', !isVisible);
        togglePasswordIconOff?.classList.toggle('hidden', isVisible);
        togglePasswordBtn.setAttribute('aria-label', isVisible ? labelShow : labelHide);
      });
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
