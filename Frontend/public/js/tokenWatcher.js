// public/js/tokenWatcher.js
let timeoutId;
let expireTimeoutId;

export function startTokenWatcher({ minutesBefore, onExpireSoon, onExpired }) {
  // console.log('🔍 TokenWatcher: Iniciando');
  clearTimeout(timeoutId);
  clearTimeout(expireTimeoutId);

  const token = localStorage.getItem('token');
  if (!token) {
    // console.log('🔍 TokenWatcher: No hay token');
    return;
  }

  try {
    const [, payloadBase64] = token.split('.');
    const payload = JSON.parse(atob(payloadBase64));
    const exp = payload.exp * 1000;
    const now = Date.now();
    const warningTime = exp - minutesBefore * 60 * 1000;
    const msUntilWarning = warningTime - now;

    // console.log('🔍 TokenWatcher: Token decodificado:', { exp, now, warningTime, msUntilWarning });
    // console.log('🔍 TokenWatcher: Payload:', payload);

    if (msUntilWarning <= 0) {
      // console.log('🔍 TokenWatcher: Token ya está por expirar, llamando onExpireSoon');
      onExpireSoon?.();
      expireTimeoutId = setTimeout(() => {
        // console.log('🔍 TokenWatcher: Token expirado, llamando onExpired');
        onExpired();
      }, minutesBefore * 60 * 1000);
    } else {
      // console.log('🔍 TokenWatcher: Programando warning en', msUntilWarning, 'ms');
      timeoutId = setTimeout(() => {
        // console.log('🔍 TokenWatcher: Llamando onExpireSoon');
        onExpireSoon?.();
        expireTimeoutId = setTimeout(() => {
          // console.log('🔍 TokenWatcher: Llamando onExpired');
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


