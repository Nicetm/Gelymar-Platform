export function initSellerProjections(config = {}) {
  if (typeof window === 'undefined') return;

  const resolveApiBase = (base) => {
    if (!base || typeof window === 'undefined') return base || '';
    try {
      const parsed = new URL(base, window.location.origin);
      if (parsed.hostname === 'backend') {
        return `${window.location.protocol}//${window.location.hostname}:3000`;
      }
      return parsed.toString();
    } catch {
      return base;
    }
  };

  const apiBase = resolveApiBase(config.apiBase || window.apiBase || '').replace(/\/$/, '');
  const token = localStorage.getItem('token');
  const translations = window.translations || {};
  const t = translations.projections || {};

  const clientSelect = document.getElementById('projectionClient');
  const productSelect = document.getElementById('projectionProduct');
  const startInput = document.getElementById('projectionStart');
  const endInput = document.getElementById('projectionEnd');
  const periodSelect = document.getElementById('projectionPeriod');
  const metricSelect = document.getElementById('projectionMetric');
  const currencySelect = document.getElementById('projectionCurrency');
  const baseYearSelect = document.getElementById('projectionBaseYear');
  const compareModeSelect = document.getElementById('projectionCompareMode');
  const forecastTypeSelect = document.getElementById('projectionForecastType');
  const cutoffModeSelect = document.getElementById('projectionCutoffMode');
  const growthInput = document.getElementById('projectionGrowth');
  const applyBtn = document.getElementById('projectionApply');

  const summaryCurrent = document.getElementById('summaryCurrent');
  const summaryLastYear = document.getElementById('summaryLastYear');
  const summaryYtdCurrent = document.getElementById('summaryYtdCurrent');
  const summaryYtdLastYear = document.getElementById('summaryYtdLastYear');
  const summaryProjection = document.getElementById('summaryProjection');
  const projectionInsight = document.getElementById('projectionInsight');
  const summaryCurrentLabel = document.getElementById('summaryCurrentLabel');
  const summaryLastYearLabel = document.getElementById('summaryLastYearLabel');
  const summaryYtdCurrentLabel = document.getElementById('summaryYtdCurrentLabel');
  const summaryYtdLastYearLabel = document.getElementById('summaryYtdLastYearLabel');
  const summaryProjectionLabel = document.getElementById('summaryProjectionLabel');
  const chartEl = document.getElementById('projectionChart');
  const loadingModal = document.getElementById('projectionLoadingModal');
  const loadingText = document.getElementById('projectionLoadingText');
  const loadingCancel = document.getElementById('projectionLoadingCancel');

  let chartInstance = null;
  let optionsAbort = null;
  let dataAbort = null;
  let loadingCount = 0;

  const formatNumber = (value, metric, currencyOverride = '') => {
    const numeric = Number(value || 0);
    if (metric === 'kg') {
      return `${numeric.toLocaleString('es-CL')} kg`;
    }
    const currency = currencyOverride || (metric === 'usd' ? 'USD' : metric === 'uf' ? 'UF' : '');
    if (currency) {
      if (currency.toUpperCase() === 'UF') {
        return `${numeric.toLocaleString('es-CL')} UF`;
      }
      return new Intl.NumberFormat('es-CL', { style: 'currency', currency }).format(numeric);
    }
    return numeric.toLocaleString('es-CL');
  };

  const toDisplayDate = (dateStr) => {
    if (!dateStr || typeof dateStr !== 'string') return '';
    const [year, month, day] = dateStr.split('-');
    if (!year || !month || !day) return '';
    return `${day}/${month}/${year}`;
  };

  const shiftYear = (dateStr, years = 1) => {
    const date = new Date(`${dateStr}T00:00:00`);
    date.setFullYear(date.getFullYear() - years);
    return date.toISOString().slice(0, 10);
  };

  const setSummary = (data, metric) => {
    if (!data?.summary) return;
    const useKg = metric === 'kg';
    const currencyCode = data.currency || currencySelect?.value || '';
    const currentVal = useKg ? data.summary.ytd_kg_current : data.summary.ytd_amt_current;
    const lastVal = useKg ? data.summary.ytd_kg_last : data.summary.ytd_amt_last;
    const ytdCurrentVal = currentVal;
    const ytdLastVal = lastVal;
    const forecastBase = useKg ? data.summary.forecast_kg_next_base : data.summary.forecast_amt_next_base;
    const forecastGrowth = useKg ? data.summary.forecast_kg_next_growth : data.summary.forecast_amt_next_growth;

    const hasComparableBase = data.summary.has_comparable_base !== false;
    summaryCurrent.textContent = formatNumber(currentVal, metric, currencyCode);
    summaryLastYear.textContent = hasComparableBase ? formatNumber(lastVal, metric, currencyCode) : (t.na || 'N/A');
    summaryYtdCurrent.textContent = formatNumber(ytdCurrentVal, metric, currencyCode);
    summaryYtdLastYear.textContent = hasComparableBase ? formatNumber(ytdLastVal, metric, currencyCode) : (t.na || 'N/A');
    summaryProjection.textContent = `${formatNumber(forecastBase, metric, currencyCode)} / ${formatNumber(forecastGrowth, metric, currencyCode)}`;

    if (projectionInsight) {
      const compareLabel = data.cutoffMode === 'FULL_YEAR'
        ? t.cutoffFullYear
        : data.cutoffMode === 'ROLLING_12M'
          ? t.cutoffRolling12m
          : t.cutoffYtd;
      const forecastLabel = data.forecastType || data.summary?.forecast_type_effective || t.forecastRunRate;
      const estValue = useKg ? data.summary.est_kg_current_year : data.summary.est_amt_current_year;
      const baseText = `${t.estimatedBase}: ${formatNumber(estValue, metric, currencyCode)}.`;
      const line = `${data.summary.message_sales || ''} ${t.howCalculated}: ${t.compareLabel} ${compareLabel}. ${t.forecastLabel} ${forecastLabel}. ${baseText}`;
      projectionInsight.textContent = line;
    }

    if (data.range) {
      const start = data.range.startDate;
      const end = data.range.endDate;
      const startLast = data.compareRange?.startDate || shiftYear(start, 1);
      const endLast = data.compareRange?.endDate || shiftYear(end, 1);
      const endYear = new Date(`${end}T00:00:00`).getFullYear();
      const ytdStart = `${endYear}-01-01`;
      const ytdStartLast = `${endYear - 1}-01-01`;
      const periodValue = periodSelect?.value || 'monthly';
      const periodLabel = periodValue === 'annual' ? t.periodAnnual
        : periodValue === 'quarterly' ? t.periodQuarterly
        : periodValue === 'rolling12m' ? t.periodRolling12m
        : periodValue === 'ytd' ? t.periodYtd
        : t.periodMonthly;

      if (summaryCurrentLabel) {
        summaryCurrentLabel.textContent = `${t.summaryCurrent} (${toDisplayDate(start)}–${toDisplayDate(end)}, ${periodLabel.toLowerCase()})`;
      }
      if (summaryLastYearLabel) {
        summaryLastYearLabel.textContent = `${t.summaryLastYear} (${toDisplayDate(startLast)}–${toDisplayDate(endLast)}, ${periodLabel.toLowerCase()})`;
      }
      if (summaryYtdCurrentLabel) {
        summaryYtdCurrentLabel.textContent = `${t.summaryYtdCurrent} (${toDisplayDate(ytdStart)}–${toDisplayDate(end)})`;
      }
      if (summaryYtdLastYearLabel) {
        summaryYtdLastYearLabel.textContent = `${t.summaryYtdLastYear} (${toDisplayDate(ytdStartLast)}–${toDisplayDate(endLast)})`;
      }
      if (summaryProjectionLabel) {
        const growthValue = Number(growthInput?.value || 0);
        const growthLabel = growthValue ? ` +${growthValue}%` : ' +0%';
        summaryProjectionLabel.textContent = `${t.summaryProjection} (0% /${growthLabel})`;
      }
    }
  };

  const renderChart = (data) => {
    if (!chartEl || !window.ApexCharts) return;
    const labels = data?.series?.labels || [];
    const current = data?.series?.current || [];
    const lastYear = data?.series?.lastYear || [];
    const projection = data?.series?.projection || [];

    const options = {
      chart: {
        type: 'line',
        height: 320,
        toolbar: { show: false }
      },
      stroke: {
        curve: 'smooth',
        width: 3
      },
      series: [
        { name: t.seriesCurrent, data: current },
        { name: t.seriesLastYear, data: lastYear },
        { name: t.seriesProjection, data: projection }
      ],
      xaxis: {
        categories: labels
      },
      yaxis: {
        labels: {
          formatter: (val) => formatNumber(val, metricSelect?.value || 'kg', currencySelect?.value || '')
        }
      },
      colors: ['#2563eb', '#9ca3af', '#10b981'],
      legend: { position: 'top' }
    };

    if (chartInstance) {
      chartInstance.updateOptions(options);
    } else {
      chartInstance = new window.ApexCharts(chartEl, options);
      chartInstance.render();
    }
  };

  const showLoading = (message) => {
    if (!loadingModal || !loadingText) return;
    loadingCount += 1;
    loadingText.textContent = message || t.loading;
    loadingModal.classList.remove('hidden');
    loadingModal.classList.add('flex');
  };

  const hideLoading = () => {
    if (!loadingModal) return;
    loadingCount = Math.max(loadingCount - 1, 0);
    if (loadingCount === 0) {
      loadingModal.classList.add('hidden');
      loadingModal.classList.remove('flex');
    }
  };

  const abortAll = () => {
    if (optionsAbort) {
      optionsAbort.abort();
      optionsAbort = null;
    }
    if (dataAbort) {
      dataAbort.abort();
      dataAbort = null;
    }
  };

  if (loadingCancel) {
    loadingCancel.addEventListener('click', () => {
      abortAll();
      loadingCount = 1;
      hideLoading();
    });
  }

  const setDefaultDates = () => {
    const today = new Date();
    const end = today.toISOString().slice(0, 10);
    const startDate = new Date(today);
    startDate.setFullYear(today.getFullYear() - 1);
    const start = startDate.toISOString().slice(0, 10);
    if (startInput && !startInput.value) startInput.value = start;
    if (endInput && !endInput.value) endInput.value = end;
    if (baseYearSelect && !baseYearSelect.value) {
      baseYearSelect.value = String(today.getFullYear());
    }
  };

  const populateBaseYears = () => {
    if (!baseYearSelect) return;
    const endDate = endInput?.value ? new Date(`${endInput.value}T00:00:00`) : new Date();
    const currentYear = endDate.getFullYear();
    baseYearSelect.innerHTML = '';
    for (let year = currentYear; year >= currentYear - 9; year -= 1) {
      const option = document.createElement('option');
      option.value = String(year);
      option.textContent = String(year);
      baseYearSelect.appendChild(option);
    }
    baseYearSelect.value = String(currentYear);
  };

  const buildQuery = () => {
    const params = new URLSearchParams();
    if (clientSelect?.value) params.set('customerRut', clientSelect.value);
    if (productSelect?.value) params.set('productId', productSelect.value);
    if (startInput?.value) params.set('startDate', startInput.value);
    if (endInput?.value) params.set('endDate', endInput.value);
    if (periodSelect?.value) params.set('period', periodSelect.value);
    if (metricSelect?.value) params.set('metric', metricSelect.value);
    if (metricSelect?.value === 'amount' && currencySelect?.value) {
      params.set('currency', currencySelect.value);
    }
    if (growthInput?.value) params.set('growth', growthInput.value);
    if (baseYearSelect?.value) params.set('baseYear', baseYearSelect.value);
    if (compareModeSelect?.value) params.set('compareMode', compareModeSelect.value);
    if (forecastTypeSelect?.value) params.set('forecastType', forecastTypeSelect.value);
    if (cutoffModeSelect?.value) params.set('cutoffMode', cutoffModeSelect.value);
    return params.toString();
  };

  const fetchOptions = async (customerRut = '', opts = {}) => {
    if (!apiBase || !token) return;
    const selectedCustomer = clientSelect?.value || '';
    const selectedProduct = productSelect?.value || '';
    const selectedCurrency = currencySelect?.value || '';
    const updateCustomers = opts.updateCustomers !== false;
    const updateProducts = opts.updateProducts !== false;
    const updateCurrencies = opts.updateCurrencies !== false;
    if (optionsAbort) {
      optionsAbort.abort();
    }
    optionsAbort = new AbortController();
    if (!opts.suppressLoading) {
      const loadingMessage = updateCustomers || updateCurrencies
        ? t.loadingClientsProducts
        : t.loadingProducts;
      showLoading(loadingMessage);
    }
    const params = customerRut ? `?customerRut=${encodeURIComponent(customerRut)}` : '';
    try {
      const response = await fetch(`${apiBase}/api/projections/options${params}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: optionsAbort.signal
      });
      if (!response.ok) return;
      const data = await response.json();
      if (clientSelect && updateCustomers) {
        clientSelect.innerHTML = `<option value="">${t.client}</option>`;
        (data.customers || []).forEach((customer) => {
          const option = document.createElement('option');
          option.value = customer.id;
          option.textContent = customer.name ? `${customer.name} (${customer.id})` : customer.id;
          clientSelect.appendChild(option);
        });
        if (selectedCustomer) {
          clientSelect.value = selectedCustomer;
        }
      }
      if (productSelect && updateProducts) {
        productSelect.innerHTML = `<option value="">${t.product}</option>`;
        (data.products || []).forEach((product) => {
          const option = document.createElement('option');
          option.value = product.id;
          option.textContent = product.name ? `${product.name} (${product.id})` : product.id;
          productSelect.appendChild(option);
        });
        if (selectedProduct) {
          productSelect.value = selectedProduct;
        }
      }
      if (currencySelect && updateCurrencies) {
        currencySelect.innerHTML = `<option value="">${t.currency}</option>`;
        (data.currencies || []).forEach((currency) => {
          const option = document.createElement('option');
          option.value = currency;
          option.textContent = currency;
          currencySelect.appendChild(option);
        });
        if (selectedCurrency) {
          currencySelect.value = selectedCurrency;
        } else if ((data.currencies || []).length > 0) {
          currencySelect.value = data.currencies[0];
        }
      }
    } catch (error) {
      if (error?.name !== 'AbortError') {
        console.error(t.loadOptionsError, error);
      }
    } finally {
      if (!opts.suppressLoading) {
        hideLoading();
      }
      optionsAbort = null;
    }
  };

  const fetchData = async (opts = {}) => {
    if (!apiBase || !token) return;
    if (dataAbort) {
      dataAbort.abort();
    }
    dataAbort = new AbortController();
    if (!opts.suppressLoading) {
      showLoading(t.loading);
    }
    const query = buildQuery();
    try {
      const response = await fetch(`${apiBase}/api/projections?${query}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: dataAbort.signal
      });
    if (!response.ok) return;
    const data = await response.json();
      if (currencySelect && data?.availableCurrencies?.length && !currencySelect.value) {
        currencySelect.value = data.availableCurrencies[0];
      }
    setSummary(data, metricSelect?.value || 'kg');
    renderChart(data);
    } catch (error) {
      if (error?.name !== 'AbortError') {
        console.error(t.loadDataError, error);
      }
    } finally {
      if (!opts.suppressLoading) {
        hideLoading();
      }
      dataAbort = null;
    }
  };

  if (clientSelect) {
    clientSelect.addEventListener('change', () => {
      fetchOptions(clientSelect.value, { updateCustomers: false, updateCurrencies: false });
    });
  }

  if (applyBtn) {
    applyBtn.addEventListener('click', () => {
      fetchData();
    });
  }

  setDefaultDates();
  populateBaseYears();
  const helpModal = document.getElementById('projectionHelpModal');
  const helpTitle = document.getElementById('projectionHelpTitle');
  const helpText = document.getElementById('projectionHelpText');
  const helpClose = document.getElementById('projectionHelpClose');
  const helpTargets = document.querySelectorAll('[data-help]');

  const openHelpModal = (title, text) => {
    if (!helpModal || !helpTitle || !helpText) return;
    helpTitle.textContent = title || '';
    helpText.textContent = text || '';
    helpModal.classList.remove('hidden');
    helpModal.classList.add('flex');
  };

  const closeHelpModal = () => {
    if (!helpModal) return;
    helpModal.classList.add('hidden');
    helpModal.classList.remove('flex');
  };

  helpTargets.forEach((el) => {
    el.addEventListener('click', () => {
      const text = el.getAttribute('data-help') || '';
      const title = el.getAttribute('data-help-title') || '';
      openHelpModal(title, text);
    });
  });

  if (helpClose) {
    helpClose.addEventListener('click', closeHelpModal);
  }
  if (helpModal) {
    helpModal.addEventListener('click', (event) => {
      if (event.target === helpModal) closeHelpModal();
    });
  }
  (async () => {
    showLoading(t.loading);
    try {
      await fetchOptions('', { suppressLoading: true, updateCustomers: true, updateProducts: true, updateCurrencies: true });
      await fetchData({ suppressLoading: true });
    } finally {
      hideLoading();
    }
  })();
}
