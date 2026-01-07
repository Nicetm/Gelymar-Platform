declare global {
  interface Window {
    apiBase?: string;
  }
}

type PriceRow = {
  orderId: number;
  pc: string;
  oc: string;
  factura: string;
  fecha: string;
  customer: string;
  itemId: number;
  product: string;
  itemCode: string;
  market: string;
  unitPrice: number;
  kgFacturados: number;
  currency: string;
};

type FilterOption = { id: number; name: string };

type PriceAnalysisResponse = {
  range: { startDate: string; endDate: string };
  filters: {
    products: FilterOption[];
    customers: FilterOption[];
    markets: string[];
    currencies: string[];
  };
  summary: {
    minPrice: number;
    maxPrice: number;
    avgPrice: number;
    totalKg: number;
    totalSales: number;
    totalRows: number;
    totalOrders: number;
  };
  rows: PriceRow[];
};

const apiBase = (window.apiBase || '').replace(/\/$/, '');
const token = localStorage.getItem('token') || '';

const productSelect = document.getElementById('price-product') as HTMLSelectElement | null;
const customerSelect = document.getElementById('price-customer') as HTMLSelectElement | null;
const marketSelect = document.getElementById('price-market') as HTMLSelectElement | null;
const currencySelect = document.getElementById('price-currency') as HTMLSelectElement | null;
const startInput = document.getElementById('price-start-date') as HTMLInputElement | null;
const endInput = document.getElementById('price-end-date') as HTMLInputElement | null;
const applyBtn = document.getElementById('price-apply');

const minEl = document.getElementById('price-min');
const maxEl = document.getElementById('price-max');
const avgEl = document.getElementById('price-avg');
const kgEl = document.getElementById('price-kg');
const salesEl = document.getElementById('price-sales');
const ordersEl = document.getElementById('price-orders');
const countEl = document.getElementById('price-count');
const rowsBody = document.getElementById('price-rows');

const formatDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatCurrency = (value: number, currency: string) => {
  if (!currency) {
    return new Intl.NumberFormat('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(value);
  }
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 4
  }).format(value);
};

const formatNumber = (value: number) =>
  new Intl.NumberFormat('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value);

const setDefaultDates = () => {
  const today = new Date();
  const start = new Date();
  start.setDate(today.getDate() - 29);
  if (startInput) startInput.value = formatDate(start);
  if (endInput) endInput.value = formatDate(today);
};

const buildUrl = () => {
  const params = new URLSearchParams();
  if (startInput?.value) params.set('start', startInput.value);
  if (endInput?.value) params.set('end', endInput.value);
  if (productSelect?.value) params.set('productId', productSelect.value);
  if (customerSelect?.value) params.set('customerId', customerSelect.value);
  if (marketSelect?.value) params.set('market', marketSelect.value);
  if (currencySelect?.value) params.set('currency', currencySelect.value);
  return `${apiBase}/api/orders/admin/price-analysis?${params.toString()}`;
};

const setOptions = (
  select: HTMLSelectElement | null,
  options: Array<{ value: string; label: string }>,
  defaultLabel = 'Todos'
) => {
  if (!select) return;
  const currentValue = select.value;
  const defaultOption = `<option value="">${defaultLabel}</option>`;
  const html = options.map((option) => `<option value="${option.value}">${option.label}</option>`).join('');
  select.innerHTML = `${defaultOption}${html}`;
  if (currentValue) {
    const restored = Array.from(select.options).find((opt) => opt.value === currentValue);
    if (restored) select.value = currentValue;
  }
};

const updateSummary = (summary: PriceAnalysisResponse['summary'], currency: string) => {
  const effectiveCurrency = currency || '';
  if (minEl) minEl.textContent = formatCurrency(summary.minPrice || 0, effectiveCurrency);
  if (maxEl) maxEl.textContent = formatCurrency(summary.maxPrice || 0, effectiveCurrency);
  if (avgEl) avgEl.textContent = formatCurrency(summary.avgPrice || 0, effectiveCurrency);
  if (kgEl) kgEl.textContent = formatNumber(summary.totalKg || 0);
  if (salesEl) salesEl.textContent = formatCurrency(summary.totalSales || 0, effectiveCurrency);
  if (ordersEl) ordersEl.textContent = formatNumber(summary.totalOrders || 0);
  if (countEl) countEl.textContent = `${summary.totalRows || 0} registros`;
};

const renderRows = (rows: PriceRow[]) => {
  if (!rowsBody) return;
  if (!rows.length) {
    rowsBody.innerHTML = `
      <tr>
        <td colspan="6" class="px-4 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
          Sin datos para este filtro
        </td>
      </tr>
    `;
    return;
  }

  rowsBody.innerHTML = rows
    .map((row) => {
      const dateLabel = row.fecha ? new Date(`${row.fecha}T00:00:00`).toLocaleDateString('es-CL') : '-';
      const market = row.market || '-';
      const productLabel = row.itemCode ? `${row.product} (${row.itemCode})` : row.product;
      return `
        <tr>
          <td class="px-4 py-3 text-sm text-gray-900 dark:text-white">${dateLabel}</td>
          <td class="px-4 py-3 text-sm text-gray-900 dark:text-white">${productLabel}</td>
          <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-300">${market}</td>
          <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-300">${row.customer}</td>
          <td class="px-4 py-3 text-right text-sm font-semibold text-gray-900 dark:text-white">${formatCurrency(
            row.unitPrice || 0,
            row.currency || ''
          )}</td>
          <td class="px-4 py-3 text-right text-sm text-gray-500 dark:text-gray-300">${formatNumber(
            row.kgFacturados || 0
          )}</td>
        </tr>
      `;
    })
    .join('');
};

const updateFilters = (data: PriceAnalysisResponse) => {
  setOptions(
    productSelect,
    data.filters.products.map((row) => ({ value: String(row.id), label: row.name }))
  );
  setOptions(
    customerSelect,
    data.filters.customers.map((row) => ({ value: String(row.id), label: row.name }))
  );
  setOptions(
    marketSelect,
    data.filters.markets.map((name) => ({ value: name, label: name }))
  );

  if (currencySelect) {
    const currencyOptions = data.filters.currencies.map((name) => ({ value: name, label: name }));
    const currentValue = currencySelect.value;
    const defaultOptions = [
      { value: 'USD', label: 'USD' },
      { value: 'EUR', label: 'EUR' },
      { value: '', label: 'Todas' }
    ];
    const merged = [...defaultOptions];
    currencyOptions.forEach((opt) => {
      if (!merged.find((item) => item.value === opt.value)) merged.push(opt);
    });
    currencySelect.innerHTML = merged
      .map((opt) => `<option value="${opt.value}">${opt.label}</option>`)
      .join('');
    if (currentValue) {
      const restored = Array.from(currencySelect.options).find((opt) => opt.value === currentValue);
      if (restored) currencySelect.value = currentValue;
    }
  }
};

const fetchData = async () => {
  if (!apiBase) return;

  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(buildUrl(), {
    headers,
    credentials: 'include'
  });

  if (!response.ok) return;

  const data = (await response.json()) as PriceAnalysisResponse;
  updateFilters(data);
  updateSummary(data.summary, currencySelect?.value || '');
  renderRows(data.rows || []);
};

const init = () => {
  setDefaultDates();
  fetchData();

  applyBtn?.addEventListener('click', fetchData);
};

document.addEventListener('DOMContentLoaded', init);
