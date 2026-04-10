const OrdersPage = {
  init() {
    const btn = document.getElementById('orders-search-btn');
    if (btn) btn.onclick = () => this.search();
    document.querySelectorAll('#orders-search-pc, #orders-search-oc, #orders-search-factura, #orders-search-name').forEach(el => {
      el.onkeydown = (e) => { if (e.key === 'Enter') this.search(); };
    });
  },

  async search() {
    const pc = document.getElementById('orders-search-pc')?.value?.trim();
    const oc = document.getElementById('orders-search-oc')?.value?.trim();
    const factura = document.getElementById('orders-search-factura')?.value?.trim();
    const name = document.getElementById('orders-search-name')?.value?.trim();
    const tbody = document.getElementById('orders-tbody');
    const status = document.getElementById('orders-status');
    const btn = document.getElementById('orders-search-btn');
    const btnText = btn ? btn.innerHTML : '';

    if (!pc && !oc && !factura && !name) {
      if (status) { status.textContent = 'Complete al menos un campo'; status.className = 'status-warning'; }
      return;
    }

    if (btn) { btn.innerHTML = '<span class="spinner"></span>Buscando...'; btn.classList.add('loading'); }
    if (status) { status.textContent = 'Buscando...'; status.className = 'status-info'; }
    if (tbody) tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:20px;color:#6b7280;">Buscando...</td></tr>';

    const params = new URLSearchParams();
    if (pc) params.set('pc', pc);
    if (oc) params.set('oc', oc);
    if (factura) params.set('factura', factura);
    if (name) params.set('name', name);

    try {
      const rows = await API.get(`/api/orders/search?${params.toString()}`);

      if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:20px;color:#6b7280;">Sin resultados</td></tr>';
        if (status) { status.textContent = 'Sin resultados'; status.className = 'status-warning'; }
        return;
      }

      tbody.innerHTML = rows.map(r => `<tr>
        <td>${r.id}</td>
        <td><strong>${r.pc || ''}</strong></td>
        <td>${r.oc || ''}</td>
        <td>${r.factura || '-'}</td>
        <td>${r.name || ''}</td>
        <td><span class="badge badge-${r.status_id === 2 ? 'success' : r.status_id === 1 ? 'warning' : 'default'}">${r.status_id ?? ''}</span></td>
        <td style="max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${r.path || ''}">${r.path || ''}</td>
        <td>${r.is_visible_to_client ? '✅' : '❌'}</td>
        <td><button class="btn btn-sm" onclick='OrdersPage.openEdit(${JSON.stringify(r).replace(/'/g, "&#39;")})'>✏️</button></td>
      </tr>`).join('');

      if (status) { status.textContent = `${rows.length} resultado(s)`; status.className = 'status-success'; }
    } catch (err) {
      if (tbody) tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:20px;color:#dc2626;">Error: ' + err.message + '</td></tr>';
      if (status) { status.textContent = 'Error: ' + err.message; status.className = 'status-error'; }
    } finally {
      if (btn) { btn.innerHTML = btnText; btn.classList.remove('loading'); }
    }
  },

  openEdit(row) {
    document.getElementById('edit-file-id').value = row.id;
    document.getElementById('edit-file-info').textContent = `ID: ${row.id} | PC: ${row.pc} | ${row.name || ''}`;
    document.getElementById('edit-status-id').value = row.status_id ?? '';
    document.getElementById('edit-path').value = row.path || '';
    document.getElementById('edit-visible').value = row.is_visible_to_client ? '1' : '0';
    document.getElementById('edit-fecha-generacion').value = row.fecha_generacion ? row.fecha_generacion.slice(0, 16) : '';
    document.getElementById('edit-fecha-envio').value = row.fecha_envio ? row.fecha_envio.slice(0, 16) : '';
    document.getElementById('edit-fecha-reenvio').value = row.fecha_reenvio ? row.fecha_reenvio.slice(0, 16) : '';
    document.getElementById('orders-modal').classList.remove('hidden');
  },

  closeModal() { document.getElementById('orders-modal').classList.add('hidden'); },

  async saveEdit() {
    const id = document.getElementById('edit-file-id').value;
    const info = document.getElementById('edit-file-info').textContent;

    const confirmed = await confirmAction(
      '¿Guardar cambios?',
      `Estás a punto de modificar el registro:\n${info}`,
      'warning',
      { confirmButtonText: 'Sí, guardar', cancelButtonText: 'Cancelar' }
    );
    if (!confirmed) return;

    const saveBtn = document.querySelector('#orders-modal .btn-primary');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Guardando...'; }
    try {
      await API.put(`/api/orders/files/${id}`, {
        status_id: parseInt(document.getElementById('edit-status-id').value) || null,
        path: document.getElementById('edit-path').value,
        is_visible_to_client: parseInt(document.getElementById('edit-visible').value),
        fecha_generacion: document.getElementById('edit-fecha-generacion').value || null,
        fecha_envio: document.getElementById('edit-fecha-envio').value || null,
        fecha_reenvio: document.getElementById('edit-fecha-reenvio').value || null
      });
      this.closeModal();
      this.search();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Guardar'; }
    }
  }
};
