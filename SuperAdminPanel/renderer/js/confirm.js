/**
 * Custom confirm dialog — adapted from Frontend/public/js/utils.js confirmAction
 * Uses SuperAdminPanel styles (no Tailwind)
 */
const confirmAction = (title, message, type = 'warning', options = {}) => {
  return new Promise((resolve) => {
    const {
      confirmButtonText = 'Sí, continuar',
      cancelButtonText = 'Cancelar',
      loadingText = 'Procesando...',
      onConfirm = null
    } = options;

    const icons = {
      warning: `<svg width="48" height="48" fill="none" stroke="#d97706" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"/>
      </svg>`,
      error: `<svg width="48" height="48" fill="none" stroke="#dc2626" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>`,
      info: `<svg width="48" height="48" fill="none" stroke="#3b82f6" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>`,
      success: `<svg width="48" height="48" fill="none" stroke="#16a34a" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>`
    };

    const btnColors = { warning: '#d97706', error: '#dc2626', info: '#3b82f6', success: '#16a34a' };
    const btnHover = { warning: '#b45309', error: '#b91c1c', info: '#2563eb', success: '#15803d' };
    const color = btnColors[type] || btnColors.warning;
    const hover = btnHover[type] || btnHover.warning;

    const overlay = document.createElement('div');
    overlay.id = 'customConfirmOverlay';
    Object.assign(overlay.style, {
      position: 'fixed', inset: '0', background: 'rgba(0,0,0,0.45)',
      backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', zIndex: '300', padding: '16px'
    });

    overlay.innerHTML = `
      <div id="confirmBox" style="background:#fff;border-radius:10px;box-shadow:0 12px 32px rgba(0,0,0,0.18);
        max-width:400px;width:100%;transform:scale(0.95);opacity:0;transition:transform .25s ease,opacity .25s ease;">
        <div style="padding:28px 24px 24px;text-align:center;">
          <div id="confirmIcon" style="margin-bottom:14px;">${icons[type] || icons.warning}</div>
          <h3 id="confirmTitle" style="font-size:16px;font-weight:600;color:#111827;margin-bottom:6px;">${title}</h3>
          <p id="confirmMsg" style="font-size:13px;color:#6b7280;margin-bottom:20px;">${message}</p>
          <div id="confirmBtns" style="display:flex;gap:8px;justify-content:flex-end;">
            <button id="confirmCancelBtn" class="btn btn-secondary">${cancelButtonText}</button>
            <button id="confirmAcceptBtn" class="btn" style="background:${color};color:#fff;">${confirmButtonText}</button>
          </div>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    const box = document.getElementById('confirmBox');
    requestAnimationFrame(() => { box.style.transform = 'scale(1)'; box.style.opacity = '1'; });

    // hover effect on accept btn
    const acceptBtn = document.getElementById('confirmAcceptBtn');
    acceptBtn.onmouseenter = () => { acceptBtn.style.background = hover; };
    acceptBtn.onmouseleave = () => { acceptBtn.style.background = color; };

    const animateOut = (cb) => {
      box.style.transform = 'scale(0.95)';
      box.style.opacity = '0';
      setTimeout(() => { overlay.remove(); cb(); }, 250);
    };

    const showLoading = () => {
      document.getElementById('confirmIcon').innerHTML =
        `<svg width="48" height="48" viewBox="0 0 24 24" style="animation:spin 1s linear infinite;">
          <circle cx="12" cy="12" r="10" stroke="#d1d5db" stroke-width="4" fill="none"/>
          <path fill="#3b82f6" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
        </svg>`;
      document.getElementById('confirmTitle').textContent = loadingText;
      document.getElementById('confirmMsg').textContent = '';
      document.getElementById('confirmBtns').innerHTML = '';
    };

    const handleCancel = () => animateOut(() => resolve(false));

    const handleAccept = async () => {
      if (onConfirm && typeof onConfirm === 'function') {
        showLoading();
        try { await onConfirm(); } catch (e) { console.error('confirmAction onConfirm error:', e); }
        animateOut(() => resolve(true));
      } else {
        animateOut(() => resolve(true));
      }
    };

    document.getElementById('confirmCancelBtn').addEventListener('click', handleCancel);
    acceptBtn.addEventListener('click', handleAccept);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) handleCancel(); });
    const onEsc = (e) => { if (e.key === 'Escape') { handleCancel(); document.removeEventListener('keydown', onEsc); } };
    document.addEventListener('keydown', onEsc);
  });
};
