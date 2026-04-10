const App = {
  contentEl: null,
  currentEnv: localStorage.getItem('active-env') || 'dev',
  user: null,

  async init() {
    this.contentEl = document.getElementById('main-content');
    window.addEventListener('hashchange', () => this.route());

    // Check if DB is configured before requiring login
    try {
      const res = await fetch('/api/environment/status');
      const status = await res.json();
      if (!status.configured) {
        // Show settings without auth
        const shell = document.getElementById('app-shell');
        const loginPage = document.getElementById('login-page');
        if (shell) shell.classList.remove('hidden');
        if (loginPage) loginPage.classList.add('hidden');
        window.location.hash = '#/settings';
        this.route();
        return;
      }
    } catch {}

    if (!API.getToken()) {
      window.location.hash = '#/login';
    } else {
      this.loadUser();
      if (!window.location.hash || window.location.hash === '#/') {
        window.location.hash = '#/orders';
      }
    }
    this.route();
  },

  async loadUser() {
    try {
      const data = await API.get('/api/auth/me');
      this.user = data.user;
      this.updateHeader();
    } catch { /* redirect handled by api */ }
  },

  async loadEnv() {
    if (!API.getToken()) return;
    try {
      const data = await API.get('/api/environment/current');
      this.currentEnv = data.environment;
      this.updateEnvBadge();
    } catch {}
  },

  updateHeader() {
    const el = document.getElementById('user-name');
    if (el && this.user) el.textContent = this.user.fullName || this.user.rut || '';
  },

  updateEnvBadge() {
    const badge = document.getElementById('env-badge');
    if (!badge) return;
    badge.textContent = this.currentEnv === 'prod' ? 'PRODUCCIÓN' : 'DESARROLLO';
    badge.className = 'env-badge ' + (this.currentEnv === 'prod' ? 'env-prod' : 'env-dev');
  },

  async switchEnv(env) {
    try {
      await API.post('/api/environment/switch', { environment: env });
      this.currentEnv = env;
      localStorage.setItem('active-env', env);
      this.updateEnvBadge();
    } catch (err) {
      alert('Error cambiando ambiente: ' + err.message);
    }
  },

  logout() {
    API.clearToken();
    this.user = null;
    window.location.hash = '#/login';
  },

  async route() {
    const hash = window.location.hash.slice(1) || '/login';
    const isLoggedIn = !!API.getToken();

    // Toggle shell visibility
    const shell = document.getElementById('app-shell');
    const loginPage = document.getElementById('login-page');

    if ((hash === '/login' || !isLoggedIn) && hash !== '/settings') {
      if (shell) shell.classList.add('hidden');
      if (loginPage) {
        loginPage.classList.remove('hidden');
        // Load login view if not already loaded
        if (!loginPage.innerHTML.trim()) {
          try {
            const res = await fetch('views/login.html');
            loginPage.innerHTML = await res.text();
          } catch {}
        }
      }
      if (typeof LoginPage !== 'undefined') LoginPage.init();
      return;
    }

    if (shell) shell.classList.remove('hidden');
    if (loginPage) loginPage.classList.add('hidden');
    if (isLoggedIn) this.loadEnv();

    // Sync env selector with current env
    const envSelect = document.getElementById('env-select');
    if (envSelect) envSelect.value = this.currentEnv;
    this.updateEnvBadge();

    // Update active nav
    document.querySelectorAll('.sidebar a').forEach(a => {
      a.classList.toggle('active', a.getAttribute('href') === '#' + hash);
    });

    // Load view
    const viewMap = {
      '/orders': { html: 'views/orders.html', init: () => typeof OrdersPage !== 'undefined' && OrdersPage.init() },
      '/orphans': { html: 'views/orphans.html', init: () => typeof OrphansPage !== 'undefined' && OrphansPage.init() },
      '/broadcast': { html: 'views/broadcast.html', init: () => typeof BroadcastPage !== 'undefined' && BroadcastPage.init() },
      '/docker': { html: 'views/docker-logs.html', init: () => typeof DockerLogsPage !== 'undefined' && DockerLogsPage.init() },
      '/pm2': { html: 'views/pm2-logs.html', init: () => typeof PM2LogsPage !== 'undefined' && PM2LogsPage.init() },
      '/database': { html: 'views/db-browser.html', init: () => typeof DBBrowserPage !== 'undefined' && DBBrowserPage.init() },
      '/settings': { html: 'views/settings.html', init: () => typeof SettingsPage !== 'undefined' && SettingsPage.init() }
    };

    const view = viewMap[hash];
    if (view && this.contentEl) {
      try {
        const res = await fetch(view.html);
        this.contentEl.innerHTML = await res.text();
        // Force focus back to content area
        this.contentEl.click();
        view.init();
      } catch {
        this.contentEl.innerHTML = '<p>Error cargando vista</p>';
      }
    }
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
