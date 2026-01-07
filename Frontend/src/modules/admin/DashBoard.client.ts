import ApexCharts from 'apexcharts';

declare global {
  interface Window {
    apiBase?: string;
  }
}

type TopRow = { name: string; kg: number; sales: number };

type CurrencyPayload = {
  currency: string;
  rangeTotals: { sales: number; kg: number; orders: number };
  period: { weeklySales: number; monthlySales: number; annualSales: number };
  series: { groupBy: string; labels: string[]; sales: number[]; kg: number[] };
  summary: { avgTicket: number; avgKg: number };
  topProducts: TopRow[];
  topCustomers: TopRow[];
};

type DashboardResponse = {
  range: { startDate: string; endDate: string };
  today: string;
  metric: string;
  currencies: {
    USD: CurrencyPayload;
    EUR: CurrencyPayload;
  };
};

const apiBase = (window.apiBase || '').replace(/\/$/, '');
const token = localStorage.getItem('token');

const startInput = document.getElementById('sales-start-date') as HTMLInputElement | null;
const endInput = document.getElementById('sales-end-date') as HTMLInputElement | null;
const metricSelect = document.getElementById('sales-metric-type') as HTMLSelectElement | null;
const currencySelect = document.getElementById('sales-currency') as HTMLSelectElement | null;
const applyBtn = document.getElementById('sales-apply-range');

const weeklyEl = document.getElementById('weekly-sales');
const monthlyEl = document.getElementById('monthly-sales');
const annualEl = document.getElementById('annual-sales');
const rangeSalesEl = document.getElementById('range-sales');
const rangeLabelEl = document.getElementById('range-label');
const weeklyRangeEl = document.getElementById('weekly-range');
const monthlyRangeEl = document.getElementById('monthly-range');
const annualRangeEl = document.getElementById('annual-range');
const totalKgEl = document.getElementById('total-kg');
const totalOrdersEl = document.getElementById('total-orders');
const avgTicketEl = document.getElementById('avg-ticket');
const avgKgEl = document.getElementById('avg-kg');
const seriesGranularityEl = document.getElementById('series-granularity');
const chartEl = document.getElementById('sales-chart');
const topProductsBody = document.getElementById('top-products');
const topCustomersBody = document.getElementById('top-customers');

const formatDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDateLabel = (label: unknown): Date | null => {
  if (!label) return null;
  if (label instanceof Date) return label;
  if (typeof label === 'number') return new Date(label);
  if (typeof label !== 'string') return null;
  const trimmed = label.trim();
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/;
  const monthOnly = /^(\d{4})-(\d{2})$/;
  const dateTime = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/;

  let match = trimmed.match(dateOnly);
  if (match) {
    const [, year, month, day] = match;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  match = trimmed.match(monthOnly);
  if (match) {
    const [, year, month] = match;
    return new Date(Number(year), Number(month) - 1, 1);
  }

  match = trimmed.match(dateTime);
  if (match) {
    const [, year, month, day, hour, minute, second] = match;
    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second || 0)
    );
  }

  const normalized = trimmed.replace(' ', 'T');
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatLabel = (label: string | number | Date, groupBy: string) => {
  if (!label) return '';
  if (groupBy === 'month') {
    const monthDate = typeof label === 'string' ? parseDateLabel(`${label}-01`) : parseDateLabel(label);
    if (!monthDate) return String(label);
    return monthDate.toLocaleDateString('es-CL', { month: 'short', year: 'numeric' });
  }
  const date = parseDateLabel(label);
  if (!date) return String(label);
  return date.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' });
};

const formatRangeLabel = (start: Date, end: Date) => {
  const startLabel = start.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' });
  const endLabel = end.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' });
  return `${startLabel} - ${endLabel}`;
};

const getStartOfWeek = (date: Date) => {
  const day = date.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const start = new Date(date);
  start.setDate(date.getDate() - diff);
  return start;
};

const getEndOfWeek = (date: Date) => {
  const start = getStartOfWeek(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return end;
};

const currencyFormatter = (currency: string) => new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency,
  minimumFractionDigits: 0,
  maximumFractionDigits: 2
});

const numberFormatter = new Intl.NumberFormat('es-CL', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2
});

const setDefaultDates = () => {
  const today = new Date();
  const start = new Date();
  start.setDate(today.getDate() - 29);

  if (startInput) startInput.value = formatDate(start);
  if (endInput) endInput.value = formatDate(today);
};

const buildUrl = (start?: string, end?: string, metric?: string) => {
  const params = new URLSearchParams();
  if (start) params.set('start', start);
  if (end) params.set('end', end);
  if (metric) params.set('metric', metric);
  return `${apiBase}/api/orders/admin/dashboard/sales?${params.toString()}`;
};

const getChartColors = () => {
  const isDark = document.documentElement.classList.contains('dark');
  return {
    borderColor: isDark ? '#374151' : '#E5E7EB',
    labelColor: isDark ? '#9CA3AF' : '#6B7280',
    opacityFrom: isDark ? 0 : 0.45,
    opacityTo: isDark ? 0.2 : 0
  };
};

const buildChartOptions = (labels: string[], usdSeries: number[], eurSeries: number[]) => {
  const colors = getChartColors();
  return {
    chart: {
      height: 320,
      type: 'area',
      fontFamily: 'Inter, sans-serif',
      foreColor: colors.labelColor,
      toolbar: { show: false }
    },
    dataLabels: { enabled: false },
    grid: {
      show: true,
      borderColor: colors.borderColor,
      strokeDashArray: 2,
      padding: { left: 20, right: 10, bottom: 10 }
    },
    fill: {
      type: 'gradient',
      gradient: {
        opacityFrom: colors.opacityFrom,
        opacityTo: colors.opacityTo
      }
    },
    stroke: { width: 2 },
    series: [
      {
        name: 'Ventas USD',
        data: usdSeries,
        color: '#2563EB'
      },
      {
        name: 'Ventas EUR',
        data: eurSeries,
        color: '#EF4444'
      }
    ],
    xaxis: {
      categories: labels,
      labels: {
        style: { colors: colors.labelColor, fontSize: '12px' }
      },
      axisBorder: { color: colors.borderColor },
      axisTicks: { color: colors.borderColor }
    },
    yaxis: {
      labels: {
        formatter: (value: number) => numberFormatter.format(value)
      }
    },
    tooltip: {
      y: {
        formatter: (value: number) => numberFormatter.format(value)
      }
    }
  };
};

const renderTableRows = (rows: TopRow[], container: HTMLElement | null, emptyLabel: string, currency: string) => {
  if (!container) return;
  if (!rows.length) {
    container.innerHTML = `
      <tr>
        <td colspan="3" class="px-4 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
          ${emptyLabel}
        </td>
      </tr>
    `;
    return;
  }

  container.innerHTML = rows.map((row) => `
    <tr>
      <td class="px-4 py-3 text-sm text-gray-900 dark:text-white">${row.name}</td>
      <td class="px-4 py-3 text-right text-sm text-gray-500 dark:text-gray-300">${numberFormatter.format(row.kg)}</td>
      <td class="px-4 py-3 text-right text-sm font-semibold text-gray-900 dark:text-white">${currencyFormatter(currency).format(row.sales)}</td>
    </tr>
  `).join('');
};

let salesChart: ApexCharts | null = null;
let latestData: DashboardResponse | null = null;

const updateSummaryRanges = (today: string) => {
  const todayDate = parseDateLabel(today);
  if (!todayDate) return;

  const weekStart = getStartOfWeek(todayDate);
  const weekEnd = getEndOfWeek(todayDate);
  if (weeklyRangeEl) weeklyRangeEl.textContent = formatRangeLabel(weekStart, weekEnd);

  const monthStart = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1);
  const monthEnd = new Date(todayDate.getFullYear(), todayDate.getMonth() + 1, 0);
  if (monthlyRangeEl) monthlyRangeEl.textContent = formatRangeLabel(monthStart, monthEnd);

  const yearStart = new Date(todayDate.getFullYear(), 0, 1);
  const yearEnd = new Date(todayDate.getFullYear(), 11, 31);
  if (annualRangeEl) annualRangeEl.textContent = formatRangeLabel(yearStart, yearEnd);
};

const updateCurrencySection = (payload: CurrencyPayload, range: { startDate: string; endDate: string }) => {
  const formatter = currencyFormatter(payload.currency);

  if (weeklyEl) weeklyEl.textContent = formatter.format(payload.period.weeklySales || 0);
  if (monthlyEl) monthlyEl.textContent = formatter.format(payload.period.monthlySales || 0);
  if (annualEl) annualEl.textContent = formatter.format(payload.period.annualSales || 0);
  if (rangeSalesEl) rangeSalesEl.textContent = formatter.format(payload.rangeTotals.sales || 0);
  if (rangeLabelEl) rangeLabelEl.textContent = `${range.startDate} a ${range.endDate}`;

  if (totalKgEl) totalKgEl.textContent = numberFormatter.format(payload.rangeTotals.kg || 0);
  if (totalOrdersEl) totalOrdersEl.textContent = numberFormatter.format(payload.rangeTotals.orders || 0);

  if (avgTicketEl) avgTicketEl.textContent = formatter.format(payload.summary.avgTicket || 0);
  if (avgKgEl) avgKgEl.textContent = numberFormatter.format(payload.summary.avgKg || 0);

  if (seriesGranularityEl) {
    seriesGranularityEl.textContent = payload.series.groupBy === 'month' ? 'mes' : 'dia';
  }

  renderTableRows(payload.topProducts || [], topProductsBody, 'Sin datos', payload.currency);
  renderTableRows(payload.topCustomers || [], topCustomersBody, 'Sin datos', payload.currency);
};

const updateChart = (data: DashboardResponse) => {
  if (!chartEl) return;

  const usd = data.currencies.USD;
  const eur = data.currencies.EUR;
  const labelsSource = usd.series.labels.length ? usd : eur;
  const labels = labelsSource.series.labels.map((label) => formatLabel(label, labelsSource.series.groupBy));

  const usdSeries = usd.series.sales;
  const eurSeries = eur.series.sales;

  if (!salesChart) {
    salesChart = new ApexCharts(chartEl, buildChartOptions(labels, usdSeries, eurSeries));
    salesChart.render();
  } else {
    salesChart.updateOptions(buildChartOptions(labels, usdSeries, eurSeries));
  }
};

const applyCurrencySelection = () => {
  if (!latestData) return;
  const currency = currencySelect ? currencySelect.value : 'USD';
  const payload = currency === 'EUR' ? latestData.currencies.EUR : latestData.currencies.USD;
  updateCurrencySection(payload, latestData.range);
};

const updateDashboard = (data: DashboardResponse) => {
  latestData = data;
  updateSummaryRanges(data.today);
  updateChart(data);
  applyCurrencySelection();
};

const fetchDashboard = async () => {
  if (!apiBase || !token) return;
  const start = startInput ? startInput.value : '';
  const end = endInput ? endInput.value : '';
  const metric = metricSelect ? metricSelect.value : 'facturados';

  const response = await fetch(buildUrl(start, end, metric), {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    return;
  }

  const data = await response.json();
  updateDashboard(data);
};

const init = () => {
  setDefaultDates();
  fetchDashboard();

  if (applyBtn) {
    applyBtn.addEventListener('click', fetchDashboard);
  }

  currencySelect?.addEventListener('change', applyCurrencySelection);

  document.addEventListener('dark-mode', () => {
    if (salesChart && latestData) {
      const usd = latestData.currencies.USD;
      const eur = latestData.currencies.EUR;
      const labelsSource = usd.series.labels.length ? usd : eur;
      const labels = labelsSource.series.labels.map((label) => formatLabel(label, labelsSource.series.groupBy));
      salesChart.updateOptions(buildChartOptions(labels, usd.series.sales, eur.series.sales));
    }
  });
};

document.addEventListener('DOMContentLoaded', init);
