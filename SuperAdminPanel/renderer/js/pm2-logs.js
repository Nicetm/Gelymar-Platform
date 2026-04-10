const PM2LogsPage = {
  async init() { await this.loadProcesses(); },

  async loadProcesses() {
    try {
      const procs = await API.get('/api/pm2/processes');
      const tbody = document.getElementById('pm2-tbody');
      tbody.innerHTML = procs.map(p => {
        const isError = p.status === 'errored' || p.status === 'stopped';
        const badge = isError ? 'badge-error' : 'badge-success';
        return `<tr${isError ? ' style="background:#fee2e2"' : ''}>
          <td>${p.name}</td>
          <td><span class="badge ${badge}">${p.status || 'unknown'}</span></td>
          <td>${p.cpu ?? '-'}%</td>
          <td>${p.memory ? (p.memory / 1024 / 1024).toFixed(1) + ' MB' : '-'}</td>
          <td>${p.restarts ?? 0}</td>
          <td><button class="btn btn-sm btn-primary" onclick="PM2LogsPage.loadLogs('${p.name}')">Logs</button></td>
        </tr>`;
      }).join('');
    } catch (err) {
      document.getElementById('pm2-tbody').innerHTML = `<tr><td colspan="6">Error: ${err.message}</td></tr>`;
    }
  },

  async loadLogs(name) {
    try {
      const data = await API.get(`/api/pm2/processes/${name}/logs?lines=200`);
      document.getElementById('pm2-log-name').textContent = name;
      document.getElementById('pm2-log-viewer').textContent = data.logs.join('\n');
      document.getElementById('pm2-log-card').style.display = 'block';
    } catch (err) {
      alert(err.message);
    }
  }
};
