const LoginPage = {
  init() {
    const btn = document.getElementById('login-btn');
    const passInput = document.getElementById('login-pass');
    if (btn) btn.onclick = () => this.login();
    if (passInput) passInput.onkeydown = (e) => { if (e.key === 'Enter') this.login(); };
    this.loadRemembered();
  },

  async loadRemembered() {
    try {
      const res = await fetch('/api/environment/remembered');
      if (!res.ok) return;
      const data = await res.json();
      if (!data) return;
      const userEl = document.getElementById('login-user');
      const passEl = document.getElementById('login-pass');
      const envEl = document.getElementById('login-env');
      const remEl = document.getElementById('login-remember');
      if (userEl && data.user) userEl.value = data.user;
      if (passEl && data.pass) passEl.value = data.pass;
      if (envEl && data.env) envEl.value = data.env;
      if (remEl) remEl.checked = true;
    } catch {}
  },

  async saveRemembered(user, pass, env) {
    const remEl = document.getElementById('login-remember');
    try {
      if (remEl?.checked) {
        await fetch('/api/environment/remembered', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user, pass, env })
        });
      } else {
        await fetch('/api/environment/remembered', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(null)
        });
      }
    } catch {}
  },

  async login() {
    const username = document.getElementById('login-user')?.value?.trim();
    const password = document.getElementById('login-pass')?.value;
    const env = document.getElementById('login-env')?.value || 'dev';
    const errorEl = document.getElementById('login-error');

    if (!username || !password) {
      if (errorEl) { errorEl.textContent = 'Complete todos los campos'; errorEl.classList.remove('hidden'); }
      return;
    }

    const btn = document.getElementById('login-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Conectando...'; }

    try {
      await fetch('/api/environment/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ environment: env })
      });

      const data = await API.request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      });
      API.setToken(data.token);
      localStorage.setItem('active-env', env);
      await this.saveRemembered(username, password, env);
      App.currentEnv = env;
      App.updateEnvBadge();
      window.location.hash = '#/orders';
      App.loadUser();
    } catch (err) {
      if (errorEl) {
        const isDbError = err.message && err.message.includes('Configure un ambiente');
        if (isDbError) {
          errorEl.innerHTML = err.message + ' <a href="#/settings" style="color:#3b82f6;text-decoration:underline;">Ir a Configuración</a>';
        } else {
          errorEl.textContent = err.message;
        }
        errorEl.classList.remove('hidden');
      }
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Iniciar Sesión'; }
    }
  }
};
