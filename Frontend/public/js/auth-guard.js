export function initAuthGuard(config = {}) {
  if (typeof window === 'undefined') {
    return;
  }

  const { requiredRole } = config;

  const validateToken = () => {
    const token = localStorage.getItem('token');

    if (!token) {
      window.location.href = '/authentication/sign-in';
      return;
    }

    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Token malformado');
      }

      const payloadBase64 = parts[1];
      const payload = JSON.parse(atob(payloadBase64));

      if (!payload?.id || (!payload?.rut && !payload?.email)) {
        throw new Error('Token sin datos requeridos');
      }

      if (payload?.exp) {
        const expirationTime = payload.exp * 1000;
        if (Date.now() >= expirationTime) {
          throw new Error('Token expirado');
        }
      }

      if (requiredRole) {
        const payloadRole = payload.role || payload.roles || null;
        if (!payloadRole) {
          throw new Error('Token sin información de rol');
        }
      }
    } catch (error) {
      console.error('[AuthGuard] Token inválido:', error?.message || error);
      localStorage.removeItem('token');
      window.location.href = '/authentication/sign-in';
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', validateToken, { once: true });
  } else {
    validateToken();
  }
}
