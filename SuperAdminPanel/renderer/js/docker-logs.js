const DockerLogsPage = {
  async init() {
    try {
      const containers = await API.get('/api/docker/containers');
      const sel = document.getElementById('docker-container-select');
      containers.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = `${c.name} (${c.image})`;
        sel.appendChild(opt);
      });
    } catch (err) {
      document.getElementById('docker-log-viewer').textContent = 'Error conectando a Docker: ' + err.message;
    }
  },

  async loadLogs() {
    const id = document.getElementById('docker-container-select').value;
    if (!id) return;
    const lines = document.getElementById('docker-lines').value || 200;
    const search = document.getElementById('docker-search').value || '';

    try {
      const data = await API.get(`/api/docker/containers/${id}/logs?lines=${lines}&search=${encodeURIComponent(search)}`);
      document.getElementById('docker-log-viewer').textContent = data.logs.join('\n');
    } catch (err) {
      document.getElementById('docker-log-viewer').textContent = 'Error: ' + err.message;
    }
  }
};
