const DBBrowserPage = {
  page: 1,
  editRow: null,

  init() {
    this.load();
  },

  async load() {
    const table = document.getElementById('db-table-select').value;
    const limit = document.getElementById('db-limit').value;
    const col = document.getElementById('db-filter-col').value.trim();
    const val = document.getElementById('db-filter-val').value.trim();

    let filters = {};
    if (col && val) filters[col] = val;

    try {
      const data = await API.get(`/api/database/${table}?page=${this.page}&limit=${limit}&filters=${encodeURIComponent(JSON.stringify(filters))}`);
      this.renderTable(data);
      this.renderPagination(data);
    } catch (err) { alert(err.message); }
  },

  renderTable(data) {
    if (!data.rows.length) {
      document.getElementById('db-thead').innerHTML = '';
      document.getElementById('db-tbody').innerHTML = '<tr><td>Sin resultados</td></tr>';
      return;
    }
    const cols = Object.keys(data.rows[0]);
    document.getElementById('db-thead').innerHTML = '<tr>' + cols.map(c => `<th>${c}</th>`).join('') + '<th>Acciones</th></tr>';
    document.getElementById('db-tbody').innerHTML = data.rows.map(r => {
      const cells = cols.map(c => `<td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r[c] ?? ''}</td>`).join('');
      return `<tr>${cells}<td><button class="btn btn-sm btn-primary" onclick='DBBrowserPage.openEdit(${JSON.stringify(r).replace(/'/g, "&#39;")})'>Editar</button></td></tr>`;
    }).join('');
  },

  renderPagination(data) {
    const el = document.getElementById('db-pagination');
    let html = '';
    if (data.page > 1) html += `<button onclick="DBBrowserPage.goPage(${data.page - 1})">← Anterior</button>`;
    html += `<span>Página ${data.page} de ${data.pages} (${data.total} registros)</span>`;
    if (data.page < data.pages) html += `<button onclick="DBBrowserPage.goPage(${data.page + 1})">Siguiente →</button>`;
    el.innerHTML = html;
  },

  goPage(p) { this.page = p; this.load(); },

  openEdit(row) {
    this.editRow = row;
    const fields = document.getElementById('db-edit-fields');
    fields.innerHTML = Object.entries(row).map(([k, v]) =>
      k === 'id' ? `<div class="form-group"><label>${k}</label><input value="${v}" disabled /></div>`
        : `<div class="form-group"><label>${k}</label><input data-field="${k}" value="${v ?? ''}" /></div>`
    ).join('');
    document.getElementById('db-modal').classList.remove('hidden');
  },

  closeModal() { document.getElementById('db-modal').classList.add('hidden'); },

  async saveEdit() {
    const table = document.getElementById('db-table-select').value;
    const data = {};
    document.querySelectorAll('#db-edit-fields input[data-field]').forEach(input => {
      data[input.dataset.field] = input.value;
    });

    try {
      await API.put(`/api/database/${table}/${this.editRow.id}`, data);
      this.closeModal();
      this.load();
    } catch (err) { alert(err.message); }
  }
};
