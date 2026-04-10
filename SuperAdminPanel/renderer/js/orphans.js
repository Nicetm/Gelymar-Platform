const OrphansPage = {
  orphans: [],
  emptyDirs: [],

  async init() { await this.loadSummary(); },

  async loadSummary() {
    try {
      const s = await API.get('/api/orphans/summary');
      const el = document.getElementById('orphans-stats');
      if (el) el.innerHTML = `
        <div class="stat-card"><div class="stat-value">${s.totalFiles}</div><div class="stat-label">Archivos en disco</div></div>
        <div class="stat-card"><div class="stat-value">${s.totalRecords}</div><div class="stat-label">Registros en BD</div></div>
        <div class="stat-card"><div class="stat-value">${s.orphans}</div><div class="stat-label">Huérfanos</div></div>
        <div class="stat-card"><div class="stat-value">${(s.spaceBytes / 1024 / 1024).toFixed(1)} MB</div><div class="stat-label">Espacio huérfanos</div></div>
        ${s.fileserverError ? `<div class="stat-card" style="border-color:#ef4444"><div class="stat-value" style="color:#ef4444;font-size:14px;">Error</div><div class="stat-label" style="color:#ef4444">${s.fileserverError}</div></div>` : ''}`;
    } catch (err) {
      const el = document.getElementById('orphans-stats');
      if (el) el.innerHTML = `<div class="stat-card" style="border-color:#ef4444"><div class="stat-value" style="color:#ef4444">Error</div><div class="stat-label">${err.message}</div></div>`;
    }
  },

  async scan() {
    const status = document.getElementById('orphans-scan-status');
    const tbody = document.getElementById('orphans-tbody');
    const btn = event?.target?.closest('.btn') || document.querySelector('[onclick*="OrphansPage.scan"]');
    const btnText = btn ? btn.innerHTML : '';
    if (btn) { btn.innerHTML = '<span class="spinner"></span>Escaneando...'; btn.classList.add('loading'); }
    if (status) status.textContent = 'Escaneando archivos...';
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:20px;color:#6b7280;">Escaneando...</td></tr>';

    try {
      this.orphans = await API.post('/api/orphans/scan');
      if (!this.orphans.length) {
        if (status) status.textContent = 'No se encontraron archivos huérfanos';
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:20px;color:#6b7280;">No se encontraron archivos huérfanos</td></tr>';
        return;
      }
      if (status) status.textContent = `${this.orphans.length} archivo(s) huérfano(s) encontrado(s)`;
      tbody.innerHTML = this.orphans.map((o, i) => `<tr>
        <td><input type="checkbox" data-idx="${i}" /></td>
        <td style="font-size:12px;word-break:break-all;">${o.path}</td>
        <td>${(o.size / 1024).toFixed(1)} KB</td>
      </tr>`).join('');
    } catch (err) {
      if (status) status.textContent = 'Error: ' + err.message;
      tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;padding:20px;color:#ef4444;">${err.message}</td></tr>`;
    } finally {
      if (btn) { btn.innerHTML = btnText; btn.classList.remove('loading'); }
    }
  },

  toggleAll(checked) {
    document.querySelectorAll('#orphans-tbody input[type=checkbox]').forEach(cb => cb.checked = checked);
  },

  async deleteSelected() {
    const selected = [];
    document.querySelectorAll('#orphans-tbody input[type=checkbox]:checked').forEach(cb => {
      const idx = parseInt(cb.dataset.idx);
      if (this.orphans[idx]) selected.push(this.orphans[idx].path);
    });
    if (!selected.length) return alert('Seleccione archivos');
    if (!confirm(`¿Eliminar ${selected.length} archivo(s)?`)) return;

    const status = document.getElementById('orphans-scan-status');
    if (status) status.textContent = `Eliminando ${selected.length} archivo(s)...`;

    try {
      const batchSize = 50;
      let deleted = 0;
      for (let i = 0; i < selected.length; i += batchSize) {
        const batch = selected.slice(i, i + batchSize);
        const results = await API.post('/api/orphans/delete', { paths: batch });
        deleted += results.filter(r => r.deleted).length;
        if (status) status.textContent = `Eliminando... ${deleted}/${selected.length}`;
      }
      if (status) status.textContent = `${deleted} de ${selected.length} archivo(s) eliminado(s)`;
      this.scan();
      this.loadSummary();
    } catch (err) {
      if (status) status.textContent = 'Error: ' + err.message;
    }
  },

  async scanEmptyDirs() {
    const status = document.getElementById('dirs-scan-status');
    const tbody = document.getElementById('empty-dirs-tbody');
    const btn = event?.target?.closest('.btn') || document.querySelector('[onclick*="OrphansPage.scanEmptyDirs"]');
    const btnText = btn ? btn.innerHTML : '';
    if (btn) { btn.innerHTML = '<span class="spinner"></span>Escaneando...'; btn.classList.add('loading'); }
    if (status) status.textContent = 'Escaneando directorios...';
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:20px;color:#6b7280;">Escaneando...</td></tr>';

    try {
      this.emptyDirs = await API.post('/api/orphans/scan-empty-dirs');
      if (!this.emptyDirs.length) {
        if (status) status.textContent = 'No se encontraron directorios vacíos';
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:20px;color:#6b7280;">No se encontraron directorios vacíos</td></tr>';
        return;
      }
      if (status) status.textContent = `${this.emptyDirs.length} directorio(s) vacío(s) encontrado(s)`;
      tbody.innerHTML = this.emptyDirs.map((d, i) => `<tr>
        <td><input type="checkbox" data-dir-idx="${i}" /></td>
        <td>${d.client}</td>
        <td style="font-size:12px;">${d.directory}</td>
        <td style="font-size:12px;word-break:break-all;">${d.path}</td>
      </tr>`).join('');
    } catch (err) {
      if (status) status.textContent = 'Error: ' + err.message;
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:20px;color:#ef4444;">${err.message}</td></tr>`;
    } finally {
      if (btn) { btn.innerHTML = btnText; btn.classList.remove('loading'); }
    }
  },

  toggleAllDirs(checked) {
    document.querySelectorAll('#empty-dirs-tbody input[type=checkbox]').forEach(cb => cb.checked = checked);
  },

  async deleteSelectedDirs() {
    const selected = [];
    document.querySelectorAll('#empty-dirs-tbody input[type=checkbox]:checked').forEach(cb => {
      const idx = parseInt(cb.dataset.dirIdx);
      if (this.emptyDirs[idx]) selected.push(this.emptyDirs[idx].path);
    });
    if (!selected.length) return alert('Seleccione directorios');
    if (!confirm(`¿Eliminar ${selected.length} directorio(s) vacío(s)?`)) return;

    const status = document.getElementById('dirs-scan-status');
    if (status) status.textContent = `Eliminando ${selected.length} directorio(s)...`;

    try {
      const batchSize = 50;
      let deleted = 0;
      for (let i = 0; i < selected.length; i += batchSize) {
        const batch = selected.slice(i, i + batchSize);
        const results = await API.post('/api/orphans/delete-empty-dirs', { paths: batch });
        deleted += results.filter(r => r.deleted).length;
        if (status) status.textContent = `Eliminando... ${deleted}/${selected.length}`;
      }
      if (status) status.textContent = `${deleted} de ${selected.length} directorio(s) eliminado(s)`;
      this.scanEmptyDirs();
      this.loadSummary();
    } catch (err) {
      if (status) status.textContent = 'Error: ' + err.message;
    }
  }
};
