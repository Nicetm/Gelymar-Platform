// public/js/tokenWatcher.js
let timeoutId;
let expireTimeoutId;

export function startTokenWatcher({ minutesBefore, onExpireSoon, onExpired }) {
  clearTimeout(timeoutId);
  clearTimeout(expireTimeoutId);

  const token = localStorage.getItem('token');
  if (!token) {
    return;
  }

  try {
    const [, payloadBase64] = token.split('.');
    const payload = JSON.parse(atob(payloadBase64));
    const exp = payload.exp * 1000;
    const now = Date.now();
    const warningTime = exp - minutesBefore * 60 * 1000;
    const msUntilWarning = warningTime - now;

    if (msUntilWarning <= 0) {
      onExpireSoon?.();
      expireTimeoutId = setTimeout(() => {
        onExpired();
      }, minutesBefore * 60 * 1000);
    } else {
      timeoutId = setTimeout(() => {
        onExpireSoon?.();
        expireTimeoutId = setTimeout(() => {
          onExpired();
        }, minutesBefore * 60 * 1000);
      }, msUntilWarning);
    }
  } catch (err) {
    console.error('🔍 TokenWatcher: Error al analizar el token:', err);
  }
}

export function stopTokenWatcher() {
  clearTimeout(timeoutId);
  clearTimeout(expireTimeoutId);
}


