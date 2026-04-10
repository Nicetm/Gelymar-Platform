const BroadcastPage = {
  init() {
    const titleInput = document.getElementById('broadcast-title');
    const messageInput = document.getElementById('broadcast-message');
    const typeSelect = document.getElementById('broadcast-type');

    const updatePreview = () => this.updatePreview();
    if (titleInput) titleInput.addEventListener('input', updatePreview);
    if (messageInput) messageInput.addEventListener('input', updatePreview);
    if (typeSelect) typeSelect.addEventListener('change', updatePreview);
  },

  updatePreview() {
    const title = document.getElementById('broadcast-title')?.value || 'Título';
    const message = document.getElementById('broadcast-message')?.value || 'Mensaje...';
    const type = document.getElementById('broadcast-type')?.value || 'info';
    const preview = document.getElementById('broadcast-preview');
    if (!preview) return;

    const colors = {
      info: { icon: '#3b82f6', btn: '#3b82f6' },
      warning: { icon: '#d97706', btn: '#d97706' },
      success: { icon: '#10b981', btn: '#10b981' }
    };
    const c = colors[type] || colors.info;

    const icons = {
      info: '<path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />',
      warning: '<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />',
      success: '<path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />'
    };

    preview.innerHTML = `
      <div style="background:white;border-radius:16px;padding:32px;max-width:400px;width:100%;box-shadow:0 8px 30px rgba(0,0,0,0.12);text-align:center;">
        <div style="margin-bottom:16px;">
          <svg style="width:48px;height:48px;color:${c.icon};" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">${icons[type]}</svg>
        </div>
        <h3 style="font-size:18px;font-weight:700;color:#1f2937;margin-bottom:8px;">${this.escapeHtml(title)}</h3>
        <p style="font-size:13px;color:#6b7280;line-height:1.6;margin-bottom:20px;white-space:pre-line;">${this.escapeHtml(message)}</p>
        <button style="padding:8px 24px;background:${c.btn};color:white;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:default;">Entendido</button>
      </div>
    `;
  },

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  async send() {
    const target = document.getElementById('broadcast-target')?.value;
    const type = document.getElementById('broadcast-type')?.value;
    const title = document.getElementById('broadcast-title')?.value?.trim();
    const message = document.getElementById('broadcast-message')?.value?.trim();
    const status = document.getElementById('broadcast-status');
    const btn = document.querySelector('[onclick*="BroadcastPage.send"]');

    if (!title || !message) {
      if (status) { status.textContent = 'Título y mensaje son requeridos'; status.style.color = '#dc2626'; }
      return;
    }

    const btnText = btn ? btn.innerHTML : '';
    if (btn) { btn.innerHTML = '<span class="spinner"></span>Enviando...'; btn.classList.add('loading'); }
    if (status) { status.textContent = 'Enviando...'; status.style.color = '#3b82f6'; }

    try {
      const res = await fetch('/api/broadcast/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API.getToken()}`
        },
        body: JSON.stringify({ target, title, message, type })
      });

      const data = await res.json();

      if (res.ok) {
        const targetNames = { admin: 'Administradores', seller: 'Vendedores', client: 'Clientes', all: 'Todos' };
        if (status) { status.textContent = `✅ Enviado a ${targetNames[target] || target}`; status.style.color = '#16a34a'; }
      } else {
        if (status) { status.textContent = `❌ ${data.message || 'Error'}`; status.style.color = '#dc2626'; }
      }
    } catch (err) {
      if (status) { status.textContent = `❌ ${err.message}`; status.style.color = '#dc2626'; }
    } finally {
      if (btn) { btn.innerHTML = btnText; btn.classList.remove('loading'); }
    }
  }
};
