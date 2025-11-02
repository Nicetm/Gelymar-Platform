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

function removeInitialSpinner() {
  const spinner = document.getElementById('globalSpinnerInit');
  if (spinner) spinner.remove();
}

function getApiBaseFallback() {
  if (typeof window === 'undefined') return '';
  const origin = window.location.origin;
  return origin.includes(':4321') ? origin.replace(':4321', ':3000') : origin;
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

      localStorage.removeItem('token');
      localStorage.removeItem('userRole');
      localStorage.removeItem('userEmail');
      document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      window.location.href = '/authentication/sign-in';
    } catch (error) {
      console.error('Error en logout:', error);
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
        const response = await fetch(`${apiBase}/api/auth/refresh`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        });

        const data = await response.json();

        if (response.ok && data.token) {
          localStorage.setItem('token', data.token);
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

  if (apiBase) {
    window.apiBase = apiBase;
  }
  if (frontendBase) {
    window.frontendBase = frontendBase;
  }

  applyThemePreference();
  setupSocketReadyFlag();
  setupTokenWatcher(apiBase || window.apiBase || getApiBaseFallback());

  const onDomReady = () => {
    removeInitialSpinner();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onDomReady, { once: true });
  } else {
    onDomReady();
  }
}
