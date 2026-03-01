function setupSocketReadyFlag() {
  if (typeof window === 'undefined') return;

  window.socketIoReady = typeof io !== 'undefined';

  if (!window.socketIoReady) {
    window.addEventListener('load', () => {
      window.socketIoReady = typeof io !== 'undefined';
      if (!window.socketIoReady) {
        console.error('Socket.io no se pudo cargar');
      }
    });
  }
}

function applyThemePreference() {
  if (typeof window === 'undefined') return;

  const storedTheme = localStorage.getItem('color-theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const shouldUseDark = storedTheme === 'dark' || (!storedTheme && prefersDark);

  document.documentElement.classList.toggle('dark', shouldUseDark);
}


function getApiBaseFallback() {
  if (typeof window === 'undefined') return '';
  const origin = window.location.origin;
  return origin.includes(':4321') ? origin.replace(':4321', ':3000') : origin;
}

function clearClientStorage() {
  try {
    const preserveKeys = new Set(['rememberMe', 'rememberedRut', 'rememberedEmail']);
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && !preserveKeys.has(key)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  } catch (error) {
    console.warn('No se pudo limpiar localStorage:', error);
  }
  try {
    sessionStorage.clear();
  } catch (error) {
    console.warn('No se pudo limpiar sessionStorage:', error);
  }
  if (typeof document !== 'undefined') {
    document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  }
}

function resolveApiBase(base) {
  if (!base || typeof window === 'undefined') return base || '';
  try {
    const parsed = new URL(base, window.location.origin);
    if (parsed.hostname === 'backend') {
      return `${window.location.protocol}//${window.location.hostname}:3000`;
    }
    return parsed.toString();
  } catch {
    return base;
  }
}

function createLogoutHandler() {
  return async function logout() {
    try {
      const token = localStorage.getItem('token');

      if (token) {
        const apiBase =
          window.apiBase ||
          getApiBaseFallback();

        try {
          await fetch(`${apiBase}/api/auth/logout`, {
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

      clearClientStorage();
      window.location.href = '/authentication/sign-in';
    } catch (error) {
      console.error('Error en logout:', error);
      clearClientStorage();
      window.location.href = '/authentication/sign-in';
    }
  };
}

function decodeToken(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload || null;
  } catch (error) {
    console.error('Error checking token:', error);
    return null;
  }
}

function setupTokenWatcher(apiBase) {
  if (typeof window === 'undefined') return;

  const logout = createLogoutHandler();
  const resolvedApiBase = resolveApiBase(apiBase || window.apiBase || getApiBaseFallback());

  function checkTokenExpiration() {
    const token = localStorage.getItem('token');
    if (!token) return;

    const payload = decodeToken(token);
    if (!payload?.exp) return;

    const expirationTime = payload.exp * 1000;
    const currentTime = Date.now();
    const timeUntilExpiration = expirationTime - currentTime;
    const fiveMinutes = 5 * 60 * 1000;

    const modal = document.getElementById('tokenWarningModal');

    if (timeUntilExpiration <= fiveMinutes && timeUntilExpiration > 0) {
      modal?.classList.remove('hidden');
    } else if (timeUntilExpiration <= 0) {
      logout();
    }
  }

  const onDomReady = () => {
    const logoutBtn = document.getElementById('logoutNow');
    const extendBtn = document.getElementById('extendSession');
    const modal = document.getElementById('tokenWarningModal');

    if (!logoutBtn || !extendBtn || !modal) return;

    const refreshToken = async () => {
      try {
        const response = await fetch(`${resolvedApiBase}/api/auth/refresh`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        });

        const data = await response.json();

        if (response.ok && data.token) {
          localStorage.setItem('token', data.token);
          // Refrescar cookie para que SSR/fetches que lean cookie sigan autenticados
          document.cookie = `token=${data.token}; path=/; SameSite=Strict; max-age=3600`;
          modal.classList.add('hidden');
        } else {
          logout();
        }
      } catch (error) {
        console.error('Error al renovar token:', error);
        logout();
      }
    };

    logoutBtn.addEventListener('click', logout);
    extendBtn.addEventListener('click', refreshToken);

    checkTokenExpiration();
    setInterval(checkTokenExpiration, 60_000);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onDomReady, { once: true });
  } else {
    onDomReady();
  }
}

export function initLayoutCommon(config = {}) {
  const {
    apiBase = '',
    frontendBase = '',
  } = config;

  if (typeof window === 'undefined') return;

  try {
    const shouldClear = sessionStorage.getItem('logout_on_close') === '1';
    if (shouldClear) {
      const path = window.location.pathname || '';
      const isAuthPage = path.startsWith('/authentication');
      if (isAuthPage) {
        clearClientStorage();
      } else {
        let sameOriginReferrer = false;
        if (document.referrer) {
          try {
            sameOriginReferrer = new URL(document.referrer).origin === window.location.origin;
          } catch {
            sameOriginReferrer = false;
          }
        }
        if (!sameOriginReferrer) {
          clearClientStorage();
        }
      }
      sessionStorage.removeItem('logout_on_close');
    }
  } catch (error) {
    console.warn('No se pudo validar cierre anterior:', error);
  }

  window.addEventListener('beforeunload', () => {
    try {
      sessionStorage.setItem('logout_on_close', '1');
    } catch (error) {
      console.warn('No se pudo marcar cierre:', error);
    }
  });

  if (apiBase) {
    window.apiBase = resolveApiBase(apiBase);
  }
  if (frontendBase) {
    window.frontendBase = frontendBase;
  }

  applyThemePreference();
  setupSocketReadyFlag();
  setupTokenWatcher(resolveApiBase(apiBase || window.apiBase || getApiBaseFallback()));

  // no initial spinner
}
