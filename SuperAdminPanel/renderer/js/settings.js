const SettingsPage = {
  config: null,

  async init() {
    try {
      const res = await fetch('/api/environment/config');
      this.config = await res.json();
      this.populate();
    } catch (err) { alert('Error cargando configuración: ' + err.message); }
  },

  populate() {
    const c = this.config;
    if (!c || !c.environments) return;

    const d = c.environments.dev || {};
    const p = c.environments.prod || {};

    this.setVal('cfg-dev-mysql-host', d.mysql?.host);
    this.setVal('cfg-dev-mysql-port', d.mysql?.port);
    this.setVal('cfg-dev-mysql-user', d.mysql?.user);
    this.setVal('cfg-dev-mysql-pass', d.mysql?.password);
    this.setVal('cfg-dev-mysql-db', d.mysql?.database);
    this.setVal('cfg-dev-sql-host', d.sqlserver?.host);
    this.setVal('cfg-dev-sql-port', d.sqlserver?.port);
    this.setVal('cfg-dev-sql-user', d.sqlserver?.user);
    this.setVal('cfg-dev-sql-pass', d.sqlserver?.password);
    this.setVal('cfg-dev-sql-db', d.sqlserver?.database);
    this.setVal('cfg-dev-docker', d.docker?.socketPath || d.docker?.host || '');
    this.setVal('cfg-dev-fileserver', d.fileserverRoot);
    this.setVal('cfg-dev-backend-url', d.backendUrl);

    this.setVal('cfg-prod-mysql-host', p.mysql?.host);
    this.setVal('cfg-prod-mysql-port', p.mysql?.port);
    this.setVal('cfg-prod-mysql-user', p.mysql?.user);
    this.setVal('cfg-prod-mysql-pass', p.mysql?.password);
    this.setVal('cfg-prod-mysql-db', p.mysql?.database);
    this.setVal('cfg-prod-sql-host', p.sqlserver?.host);
    this.setVal('cfg-prod-sql-port', p.sqlserver?.port);
    this.setVal('cfg-prod-sql-user', p.sqlserver?.user);
    this.setVal('cfg-prod-sql-pass', p.sqlserver?.password);
    this.setVal('cfg-prod-sql-db', p.sqlserver?.database);
    this.setVal('cfg-prod-docker', p.docker?.socketPath || p.docker?.host || '');
    this.setVal('cfg-prod-fileserver', p.fileserverRoot);
    this.setVal('cfg-prod-backend-url', p.backendUrl);

    this.setVal('cfg-jwt-secret', c.jwtSecret);
    this.setVal('cfg-pm2-container', c.pm2ContainerName);
    this.setVal('cfg-backend-url', c.backendUrl);
    this.setVal('cfg-fileserver-user', c.fileserverUser);
    this.setVal('cfg-fileserver-pass', c.fileserverPass);
  },

  setVal(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val ?? '';
  },

  getVal(id) { return document.getElementById(id)?.value || ''; },

  buildDockerConfig(val) {
    if (val.startsWith('tcp://') || val.startsWith('http')) return { host: val };
    return { socketPath: val || '/var/run/docker.sock' };
  },

  async save() {
    const cfg = {
      environments: {
        dev: {
          mysql: { host: this.getVal('cfg-dev-mysql-host'), port: parseInt(this.getVal('cfg-dev-mysql-port')) || 3306, user: this.getVal('cfg-dev-mysql-user'), password: this.getVal('cfg-dev-mysql-pass'), database: this.getVal('cfg-dev-mysql-db') },
          sqlserver: { host: this.getVal('cfg-dev-sql-host'), port: parseInt(this.getVal('cfg-dev-sql-port')) || 1433, user: this.getVal('cfg-dev-sql-user'), password: this.getVal('cfg-dev-sql-pass'), database: this.getVal('cfg-dev-sql-db') },
          docker: this.buildDockerConfig(this.getVal('cfg-dev-docker')),
          fileserverRoot: this.getVal('cfg-dev-fileserver'),
          backendUrl: this.getVal('cfg-dev-backend-url') || 'http://localhost:3000'
        },
        prod: {
          mysql: { host: this.getVal('cfg-prod-mysql-host'), port: parseInt(this.getVal('cfg-prod-mysql-port')) || 3306, user: this.getVal('cfg-prod-mysql-user'), password: this.getVal('cfg-prod-mysql-pass'), database: this.getVal('cfg-prod-mysql-db') },
          sqlserver: { host: this.getVal('cfg-prod-sql-host'), port: parseInt(this.getVal('cfg-prod-sql-port')) || 1433, user: this.getVal('cfg-prod-sql-user'), password: this.getVal('cfg-prod-sql-pass'), database: this.getVal('cfg-prod-sql-db') },
          docker: this.buildDockerConfig(this.getVal('cfg-prod-docker')),
          fileserverRoot: this.getVal('cfg-prod-fileserver'),
          backendUrl: this.getVal('cfg-prod-backend-url') || ''
        }
      },
      jwtSecret: this.getVal('cfg-jwt-secret'),
      backendUrl: this.getVal('cfg-backend-url') || 'http://localhost:3000',
      fileserverUser: this.getVal('cfg-fileserver-user') || 'admin',
      fileserverPass: this.getVal('cfg-fileserver-pass') || '',
      pm2ContainerName: this.getVal('cfg-pm2-container'),
      cronContainerName: this.getVal('cfg-pm2-container'),
      defaultLogLines: 200
    };

    try {
      await fetch('/api/environment/config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cfg) });
      try {
        await fetch('/api/environment/switch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ environment: 'dev' }) });
      } catch {}
      const alert = document.getElementById('settings-alert');
      if (alert) { alert.textContent = 'Configuración guardada. Redirigiendo al login...'; alert.classList.remove('hidden'); }
      setTimeout(() => { window.location.hash = '#/login'; }, 1500);
    } catch (err) { alert('Error: ' + err.message); }
  }
};
