import { 
  qs, 
  showNotification
} from './utils.js';

async function buildErrorFromResponse(response, fallbackMessage = '') {
  let payload = null;
  try {
    payload = await response.json();
  } catch (err) {
    // ignore parse errors
  }
  const message = payload?.message || fallbackMessage || `HTTP ${response.status}: ${response.statusText}`;
  const error = new Error(message);
  if (payload?.code) {
    error.code = payload.code;
  }
  error.status = response.status;
  error.payload = payload;
  return error;
}

const getMessage = (value) =>
  (typeof value === 'string' && value.length > 0 ? value : '');

function formatDateShort(dateString) {
  if (!dateString) return '-';
  try {
    const trimmed = String(dateString).trim();
    const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      const [, yyyy, mm, dd] = isoMatch;
      return `${dd}/${mm}/${yyyy}`;
    }
    const dmyMatch = trimmed.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})/);
    if (dmyMatch) {
      const [, dd, mm, yyyy] = dmyMatch;
      return `${dd}/${mm}/${yyyy}`;
    }
    const date = new Date(trimmed);
    if (Number.isNaN(date.getTime())) return '-';
    const day = String(date.getUTCDate()).padStart(2, '0');
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const year = date.getUTCFullYear();
    return `${day}/${month}/${year}`;
  } catch (error) {
    return '-';
  }
}

let carpetas = {};
let messagesFolders = {};
let foldersAccessDenied = false;
let backendMessages = {};

const formatMessage = (template, params = {}) => {
  if (!template) return '';
  return Object.entries(params).reduce(
    (result, [key, value]) => result.replace(new RegExp(`{${key}}`, 'g'), value),
    template
  );
};

function showModal(selector) {
  const modal = document.querySelector(selector);
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
}

function hideModal(selector) {
  const modal = document.querySelector(selector);
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

function setupModalClose(modalSelector, closeSelector) {
  const modal = document.querySelector(modalSelector);
  const closeBtn = document.querySelector(closeSelector);

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      hideModal(modalSelector);
    });
  }

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        hideModal(modalSelector);
      }
    });
  }
}

function getFolderSectionContext() {
  const section = document.getElementById('folderSection');
  const basePath = section?.dataset?.basePath || '/admin';
  const clientsPath = section?.dataset?.clientsPath || `${basePath}/clients`;
  const documentsPath = section?.dataset?.documentsPath || `${clientsPath}/documents/view`;
  const apiBase = window.apiBase || section?.dataset?.apiBase;
  const fileServer = section?.dataset?.fileServer;
  const folderUuid = section?.dataset?.uuid;
  const folderId = section?.dataset?.folderId;

  return { section, basePath, clientsPath, documentsPath, apiBase, fileServer, folderUuid, folderId };
}

// ===== SISTEMA DE CACHÉ =====
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos en milisegundos

function getFoldersCacheKeys(uuid) {
  const safeId = uuid || 'all';
  return {
    dataKey: `folders_cache_${safeId}`,
    timestampKey: `folders_cache_timestamp_${safeId}`
  };
}

function isFoldersCacheValid(uuid) {
  const { timestampKey } = getFoldersCacheKeys(uuid);
  const timestamp = localStorage.getItem(timestampKey);
  if (!timestamp) return false;
  return Date.now() - parseInt(timestamp, 10) < CACHE_DURATION;
}

function saveFoldersToCache(uuid, data) {
  const { dataKey, timestampKey } = getFoldersCacheKeys(uuid);
  localStorage.setItem(dataKey, JSON.stringify(data));
  localStorage.setItem(timestampKey, Date.now().toString());
}

function loadFoldersFromCache(uuid) {
  const { dataKey } = getFoldersCacheKeys(uuid);
  const cached = localStorage.getItem(dataKey);
  return cached ? JSON.parse(cached) : null;
}

function clearFoldersCache(uuid) {
  const { dataKey, timestampKey } = getFoldersCacheKeys(uuid);
  localStorage.removeItem(dataKey);
  localStorage.removeItem(timestampKey);
}

async function loadFoldersWithCache(uuid, apiBase) {
  try {
    foldersAccessDenied = false;
    if (isFoldersCacheValid(uuid)) {
      const cachedData = loadFoldersFromCache(uuid);
      if (cachedData) {
        return cachedData;
      }
    }
    const token = localStorage.getItem('token');
    const response = await fetch(`${apiBase}/api/directories/${uuid}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) {
      const error = await buildErrorFromResponse(response);
      if (error?.status === 403) {
        foldersAccessDenied = true;
        return [];
      }
      throw error;
    }
    const folders = await response.json();
    saveFoldersToCache(uuid, folders);
    return folders;
  } catch (error) {
    if (error?.status === 403) {
      foldersAccessDenied = true;
      return [];
    }
    const cachedData = loadFoldersFromCache(uuid);
    if (cachedData) {
      return cachedData;
    }
    throw error;
  }
}

export function getCacheInfo(uuid) {
  const { dataKey, timestampKey } = getFoldersCacheKeys(uuid);
  const timestamp = localStorage.getItem(timestampKey);
  const age = timestamp ? Date.now() - parseInt(timestamp, 10) : null;
  return {
    exists: !!localStorage.getItem(dataKey),
    age: age,
    isValid: isFoldersCacheValid(uuid)
  };
}

export async function forceReloadFolders(uuid, apiBase) {
  clearFoldersCache(uuid);
  return await loadFoldersWithCache(uuid, apiBase);
}

// Función para formatear moneda
function formatCurrency(amount, currency = 'CLP') {
  const currencyMap = {
    'USD': 'USD',
    'US': 'USD',
    'UF': 'CLF',
    'CLP': 'CLP',
    'PESO': 'CLP'
  };
  
  const mappedCurrency = currencyMap[currency] || currency;
  const safeAmount = parseNumber(amount);
  const formattedAmount = safeAmount.toLocaleString('es-CL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return `${mappedCurrency} ${formattedAmount}`;
}
 
function navigateToClientsWithFilter(customerName) {
  try {
    localStorage.setItem('clientSearchFilter', customerName);
    const { clientsPath } = getFolderSectionContext();
    window.location.href = clientsPath;
  } catch (error) {
    console.error('Error navegando a clientes:', error);
    showNotification('Error al navegar a la página de clientes', 'error');
  }
}

// Función para formatear cantidad con unidad
function formatQuantity(amount, unit = 'KG') {
  const unitMap = {
    'KG': 'kg',
    'KILOGRAMOS': 'kg',
    'TON': 'ton',
    'TONELADAS': 'ton',
    'LITROS': 'L',
    'L': 'L',
    'UNIDADES': 'un',
    'UN': 'un'
  };
  
  const mappedUnit = unitMap[unit] || unit.toLowerCase();
  const numericAmount = Number(typeof amount === 'string' ? amount.replace(',', '.') : amount);
  const safeAmount = Number.isFinite(numericAmount) ? numericAmount : 0;
  return `${safeAmount.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${mappedUnit}`;
}

// Función para construir fila de carga
function buildLoadingRow(colspan, message) {
  const safeMessage = message || getMessage(messagesFolders.loading) || 'Cargando...';
  return `
    <tr class="bg-white dark:bg-gray-900">
      <td colspan="${colspan}" class="px-6 py-6 text-center text-gray-500 dark:text-gray-400">
        <div class="flex items-center justify-center">
          <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          ${safeMessage}
        </div>
      </td>
    </tr>
  `;
}

// Función para formatear precio unitario
function formatUnitPrice(amount, currency = 'CLP') {
  const numericAmount = Number(typeof amount === 'string' ? amount.replace(',', '.') : amount);
  const safeAmount = Number.isFinite(numericAmount) ? numericAmount : 0;
  const parts = safeAmount.toFixed(4).split('.');
  const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${currency} ${integerPart},${parts[1]}`;
}


// Función para formatear total
function formatTotal(amount, currency = 'CLP') {
  const numericAmount = Number(typeof amount === 'string' ? amount.replace(',', '.') : amount);
  const safeAmount = Number.isFinite(numericAmount) ? numericAmount : 0;
  const formattedAmount = safeAmount.toLocaleString('es-CL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return `${currency} ${formattedAmount}`;
}

function parseNumber(value, fallback = 0) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const normalized = value.replace(/\s+/g, '').replace(',', '.');
    const number = Number(normalized);
    return Number.isFinite(number) ? number : fallback;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

// Función para formatear números (usado en itemsModal)
function formatNumber(value) {
  const numeric = parseNumber(value, 0);
  return numeric.toLocaleString('es-CL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

// Función para abrir modal de items (mover fuera de initFoldersScript)
async function openItemsModal(orderPc, orderOc, factura) {
  const itemsModal = document.getElementById('itemsModal');
  const itemsOrderTitle = document.getElementById('itemsOrderTitle');
  const itemsTableBody = document.getElementById('itemsTableBody');
  const totalItems = document.getElementById('totalItems');
  const totalQuantity = document.getElementById('totalQuantity');
  const totalValue = document.getElementById('totalValue');
  const totalGastoAdicional = document.getElementById('totalGastoAdicional');

  if (!itemsModal || !itemsOrderTitle || !itemsTableBody) return;

  // Funciones de formato
  const parseNumber = (value, fallback = 0) => {
    const number = Number(typeof value === 'string' ? value.replace(',', '.') : value);
    return Number.isFinite(number) ? number : fallback;
  };

  const formatModalQuantity = (amount, unit = 'KG') => {
    const unitMap = {
      'KG': 'kg',
      'KILOGRAMOS': 'kg',
      'TON': 'ton',
      'TONELADAS': 'ton',
      'LITROS': 'L',
      'L': 'L',
      'UNIDADES': 'un',
      'UN': 'un'
    };
    const mappedUnit = typeof unit === 'string' ? (unitMap[unit] || unit.toLowerCase()) : 'kg';
    const safeAmount = parseNumber(amount);
    return `${safeAmount.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ${mappedUnit}`;
  };

  const formatUnitPrice = (amount, currency = 'CLP') => {
    const numericAmount = parseNumber(amount);
    const parts = numericAmount.toFixed(4).split('.');
    const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${currency} ${integerPart},${parts[1]}`;
  };

  const formatTotal = (amount, currency = 'CLP') => {
    const numericAmount = parseNumber(amount);
    const formattedAmount = numericAmount.toLocaleString('es-CL', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    return `${currency} ${formattedAmount}`;
  };

  const formatCurrency = (amount, currency = 'CLP') => {
    const currencyMap = {
      'USD': 'USD',
      'US': 'USD',
      'UF': 'CLF',
      'CLP': 'CLP',
      'PESO': 'CLP'
    };
    const mappedCurrency = currencyMap[currency] || currency;
    const numericAmount = parseNumber(amount);
    const formattedAmount = numericAmount.toLocaleString('es-CL', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    return `${mappedCurrency} ${formattedAmount}`;
  };

  try {
    // Cargar items de la orden
    const token = localStorage.getItem('token');
    const { apiBase: datasetApiBase } = getFolderSectionContext();
    const apiBase = window.apiBase || datasetApiBase;

    const safeOrderOc = orderOc ? encodeURIComponent(orderOc) : '';
    const safeFactura = factura && factura !== 'null' ? encodeURIComponent(factura) : '';

    // Usar endpoint diferente según si tiene factura o no
    const url = factura && factura !== 'null'
      ? `${apiBase}/api/orders/${orderPc}/${safeOrderOc}/${safeFactura}/items`
      : `${apiBase}/api/orders/${orderPc}/${safeOrderOc}/items`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) {
      throw await buildErrorFromResponse(response, 'Error al cargar los items de la orden');
    }

    const items = await response.json();

    // Mostrar modal
    itemsModal.classList.remove('hidden');
    itemsModal.classList.add('flex');
    itemsOrderTitle.textContent = `${carpetas.order}: ${orderOc || '-'}`;

    // Normalizar items
    const hasFacturaDisplay = factura && factura !== 'null';
    const normalizedItems = items.map(item => ({
      ...item,
      kg_solicitados: item.kg_solicitados ?? item.cantidad_solicitada ?? 0,
      kg_facturados: item.kg_facturados ?? item.cantidad_facturada ?? 0,
      kg_despachados: item.kg_despachados ?? item.cantidad_despachada ?? 0,
      unit_price: item.unit_price ?? item.precio_unitario ?? 0,
      currency: item.currency ?? item.moneda ?? 'CLP',
      unidad_medida: item.unidad_medida ?? item.unit ?? 'KG'
    }));

    // Ajustar header de cantidad según tenga factura o no
    const quantityHeader = itemsModal.querySelector('[data-column="quantity"]');
    if (quantityHeader) {
      const qtyHeaderText = hasFacturaDisplay
        ? (carpetas.quantityInvoiced || 'Quantity Invoiced')
        : (carpetas.quantityRequested || 'Quantity Requested');
      quantityHeader.textContent = qtyHeaderText;
    }

    // Renderizar items
    if (items && items.length > 0) {
      const currency = normalizedItems[0]?.currency || 'CLP';
      
      itemsTableBody.innerHTML = normalizedItems.map(item => {
        // Si no hay facturados, usar solicitados como respaldo
        const rawQuantity = hasFacturaDisplay
          ? (item.kg_facturados ?? item.kg_solicitados)
          : (item.kg_solicitados ?? item.kg_facturados);
        const quantity = parseNumber(rawQuantity);
        const unitPrice = parseNumber(item.unit_price);
        const total = quantity * unitPrice;
        const unit = item.unidad_medida || 'KG';
        
        return `
          <tr class="hover:bg-gray-50 dark:hover:bg-gray-800 transition">
            <td class="px-6 py-4 text-xs text-gray-900 dark:text-gray-100">${item.item_code || '-'}</td>
            <td class="px-6 py-4 text-xs text-gray-900 dark:text-gray-100">${item.item_name || '-'}</td>
            <td class="px-6 py-4 text-xs text-center text-gray-900 dark:text-gray-100">${formatModalQuantity(quantity, unit)}</td>
            <td class="px-6 py-4 text-xs text-center text-gray-900 dark:text-gray-100">${formatUnitPrice(unitPrice, currency)}</td>
            <td class="px-6 py-4 text-xs text-center font-semibold text-gray-900 dark:text-gray-100">${formatTotal(total, currency)}</td>
          </tr>
        `;
      }).join('');

      // Calcular y mostrar totales
      const totalItemsCount = normalizedItems.length;

      const totalQuantitySum = normalizedItems.reduce((sum, item) => {
        const rawQuantity = hasFacturaDisplay
          ? (item.kg_facturados ?? item.kg_solicitados)
          : (item.kg_solicitados ?? item.kg_facturados);
        const quantity = parseNumber(rawQuantity);
        return sum + quantity;
      }, 0);

      const totalValueSum = normalizedItems.reduce((sum, item) => {
        const rawQuantity = hasFacturaDisplay
          ? (item.kg_facturados ?? item.kg_solicitados)
          : (item.kg_solicitados ?? item.kg_facturados);
        const quantity = parseNumber(rawQuantity);
        const price = parseNumber(item.unit_price);
        return sum + (quantity * price);
      }, 0);

      const unit = normalizedItems[0]?.unidad_medida || 'KG';
      const rawGastoAdicionalFactura = normalizedItems[0]?.gasto_adicional_flete_factura;
      const shouldUseFacturaExpense = hasFacturaDisplay && rawGastoAdicionalFactura !== null && rawGastoAdicionalFactura !== undefined && rawGastoAdicionalFactura !== '';
      const rawGastoAdicional = shouldUseFacturaExpense ? rawGastoAdicionalFactura : normalizedItems[0]?.gasto_adicional_flete;
      const gastoAdicional = parseNumber(rawGastoAdicional);
      
      // Add additional cost to total value
      const totalValueWithAdditional = totalValueSum + gastoAdicional;
      
      if (totalItems) totalItems.textContent = totalItemsCount;
      if (totalQuantity) totalQuantity.textContent = formatModalQuantity(totalQuantitySum, unit);
      if (totalValue) totalValue.textContent = formatCurrency(totalValueWithAdditional, currency);
      if (totalGastoAdicional) totalGastoAdicional.textContent = formatCurrency(gastoAdicional, currency);
    } else {
      itemsTableBody.innerHTML = `
        <tr>
          <td colspan="5" class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
            ${carpetas.noItems || 'No hay items disponibles'}
          </td>
        </tr>
      `;
      
      if (totalItems) totalItems.textContent = '0';
      if (totalQuantity) totalQuantity.textContent = '-';
      if (totalValue) totalValue.textContent = '-';
      if (totalGastoAdicional) totalGastoAdicional.textContent = '-';
    }
  } catch (error) {
    console.error('Error al cargar items:', error);
    if (itemsTableBody) {
      itemsTableBody.innerHTML = `
        <tr>
          <td colspan="5" class="px-6 py-4 text-center text-sm text-red-600 dark:text-red-400">
            ${error.message || 'Error al cargar los items'}
          </td>
        </tr>
      `;
    }
  }
}

export async function initFoldersScript() {
  const { apiBase: datasetApiBase } = getFolderSectionContext();
  const resolvedApiBase = window.apiBase || datasetApiBase || '';
  const apiBase = resolvedApiBase;

  // Usar traducciones ya cargadas por Astro
  const translations = window.translations || {};
  const messages = translations.messages || {};
  carpetas = translations.carpetas || {};
  messagesFolders = messages.folders || messages.carpetas || {};
  backendMessages = messagesFolders.backend || {};

  const resolveBackendMessage = (code, fallback) => {
    if (code && backendMessages[code]) {
      return backendMessages[code];
    }
    return fallback;
  };

  // Configurar event listeners de modales
  setupModalEventListeners();

  const tableBody = qs('foldersTableBody');
  const searchInput = qs('searchInput');
  const itemsPerPageSelect = qs('itemsPerPageSelect');
  const prevPageBtn = qs('prevPageBtn');
  const nextPageBtn = qs('nextPageBtn');
  const pageIndicator = qs('pageIndicator');
  const exportBtn = qs('exportExcelBtn');
  const section = qs('folderSection');
  const uuID = section?.dataset?.uuid;

  if (!tableBody || !searchInput || !itemsPerPageSelect || !prevPageBtn || !nextPageBtn || !pageIndicator || !section) {
    console.error('Elementos necesarios no encontrados para el paginador de carpetas');
    return;
  }

  const getColSpan = () => {
    const table = tableBody?.closest('table');
    const headerCount = table?.querySelectorAll('thead th')?.length || 0;
    return headerCount || 1;
  };

  const getScrollBodyWidth = () => {
    const scrollBody = tableBody?.closest('[data-scroll-body]') || tableBody?.closest('.overflow-x-auto');
    return scrollBody?.clientWidth || 0;
  };

  const buildCenteredCell = (messageHtml, textClass = 'text-gray-500 dark:text-gray-400') => {
    const width = getScrollBodyWidth();
    const widthStyle = width ? `width: ${width}px;` : 'width: 100%;';
    return `
      <td colspan="${getColSpan()}" class="px-6 py-8 ${textClass}" style="position: sticky; left: 0;">
        <div class="flex justify-center text-center" style="${widthStyle}">
          ${messageHtml}
        </div>
      </td>
    `;
  };

  const loadingRow = document.getElementById('loadingRow');
  if (loadingRow) {
    const loadingMarkup = `
      <div class="flex items-center justify-center">
        <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        ${getMessage(carpetas.loading) || getMessage(messagesFolders.loading)}
      </div>
    `;
    loadingRow.innerHTML = buildCenteredCell(loadingMarkup);
  }

  let allFolders = [];
  let filteredFolders = [];
  let currentPage = 1;
  let itemsPerPage = parseInt(itemsPerPageSelect?.value || '10', 10);
  let currentSort = { column: null, direction: 'asc' };

  function setupStickyTableControls() {
    const containers = document.querySelectorAll('[data-scroll-sync]');
    if (!containers.length) return;

    containers.forEach(container => {
      const body = container.querySelector('[data-scroll-body]');
      const scrollbar = container.querySelector('[data-scrollbar]');
      const track = container.querySelector('[data-scrollbar-track]');
      const inner = container.querySelector('[data-scrollbar-inner]');
      const header = container.querySelector('[data-scroll-header]');
      const headerTrack = container.querySelector('[data-scroll-header-track]');
      const headerTable = headerTrack?.querySelector('table');

      if (!body || !scrollbar || !track || !inner || !header || !headerTrack || !headerTable) return;

      const table = body.querySelector('table');
      const thead = table?.querySelector('thead');

      if (thead && headerTable.children.length === 0) {
        headerTable.appendChild(thead.cloneNode(true));
      }

      const syncHeaderColumnWidths = () => {
        const sourceCells = thead?.querySelectorAll('th') || [];
        const cloneCells = headerTable.querySelectorAll('th');
        if (!sourceCells.length || !cloneCells.length) return;
        sourceCells.forEach((cell, index) => {
          const cloneCell = cloneCells[index];
          if (!cloneCell) return;
          const width = cell.getBoundingClientRect().width;
          cloneCell.style.width = `${width}px`;
        });
      };

      const updateSizes = () => {
        const rect = container.getBoundingClientRect();
        const scrollWidth = table ? table.scrollWidth : body.scrollWidth;
        inner.style.width = `${scrollWidth}px`;
        headerTable.style.width = `${scrollWidth}px`;
        const hasOverflow = scrollWidth > body.clientWidth + 1;
        const inView = rect.bottom > 0 && rect.top < window.innerHeight;

        if (!hasOverflow || !inView) {
          scrollbar.classList.add('hidden');
          scrollbar.classList.remove('sticky-scrollbar-floating');
          scrollbar.style.left = '';
          scrollbar.style.width = '';
          header.classList.add('hidden');
          header.classList.remove('sticky-scroll-header-floating');
          header.style.left = '';
          header.style.width = '';
          return;
        }

        scrollbar.classList.remove('hidden');

        if (rect.bottom > window.innerHeight) {
          scrollbar.classList.add('sticky-scrollbar-floating');
          scrollbar.style.left = `${Math.max(rect.left, 0)}px`;
          scrollbar.style.width = `${Math.max(rect.width, 0)}px`;
        } else {
          scrollbar.classList.remove('sticky-scrollbar-floating');
          scrollbar.style.left = '';
          scrollbar.style.width = '';
        }

        const shouldShowHeader = rect.top < 0 && rect.bottom > 0;
        header.classList.toggle('hidden', !shouldShowHeader);

        if (shouldShowHeader) {
          syncHeaderColumnWidths();
          header.classList.add('sticky-scroll-header-floating');
          header.style.left = `${Math.max(rect.left, 0)}px`;
          header.style.width = `${Math.max(rect.width, 0)}px`;
        } else {
          header.classList.remove('sticky-scroll-header-floating');
          header.style.left = '';
          header.style.width = '';
        }
      };

      const syncFromBody = () => {
        track.scrollLeft = body.scrollLeft;
        headerTrack.scrollLeft = body.scrollLeft;
      };

      const syncFromTrack = () => {
        body.scrollLeft = track.scrollLeft;
      };

      body.addEventListener('scroll', syncFromBody);
      track.addEventListener('scroll', syncFromTrack);
      headerTrack.addEventListener('scroll', () => {
        body.scrollLeft = headerTrack.scrollLeft;
      });

      const resizeObserver = new ResizeObserver(updateSizes);
      resizeObserver.observe(body);
      if (table) resizeObserver.observe(table);

      window.addEventListener('resize', updateSizes);
      window.addEventListener('scroll', updateSizes, true);
      updateSizes();
    });
  }

  const params = new URLSearchParams(window.location.search);
  const clientName = params.get('c');

  const floatingTooltipState = {
    el: null,
    currentTarget: null,
    removeTimeout: null,
    globalHandlersBound: false
  };

  function ensureFloatingTooltipElement() {
    if (!floatingTooltipState.el) {
      const tooltip = document.createElement('div');
      tooltip.setAttribute('role', 'tooltip');
      Object.assign(tooltip.style, {
        position: 'fixed',
        zIndex: '50',
        backgroundColor: '#047857',
        color: '#ffffff',
        padding: '6px 10px',
        borderRadius: '6px',
        fontSize: '12px',
        fontWeight: '500',
        lineHeight: '1.4',
        boxShadow: '0 8px 18px rgba(0, 0, 0, 0.25)',
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
        opacity: '0',
        transition: 'opacity 120ms ease',
        maxWidth: '320px',
        textAlign: 'center'
      });
      floatingTooltipState.el = tooltip;
    }
    return floatingTooltipState.el;
  }

  function ensureFloatingTooltipHandlers() {
    if (floatingTooltipState.globalHandlersBound) return;
    floatingTooltipState.globalHandlersBound = true;
    const hideOnChange = () => hideFloatingTooltip();
    window.addEventListener('scroll', hideOnChange, true);
    window.addEventListener('resize', hideOnChange, true);
    window.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        hideFloatingTooltip();
      }
    }, true);
  }

  function positionFloatingTooltip(target, tooltipEl) {
    const rect = target.getBoundingClientRect();
    const tooltipRect = tooltipEl.getBoundingClientRect();
    const spacing = 10;

    let top = rect.top - tooltipRect.height - spacing;
    if (top < spacing) {
      top = rect.bottom + spacing;
    }

    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
    left = Math.min(Math.max(spacing, left), viewportWidth - tooltipRect.width - spacing);

    tooltipEl.style.top = `${Math.round(top)}px`;
    tooltipEl.style.left = `${Math.round(left)}px`;
  }

  function showFloatingTooltip(target) {
    if (!target || !(target instanceof HTMLElement)) return;
    const text = target.getAttribute('data-tooltip');
    if (!text) return;

    ensureFloatingTooltipHandlers();
    clearTimeout(floatingTooltipState.removeTimeout);

    const tooltipEl = ensureFloatingTooltipElement();
    tooltipEl.textContent = text;

    if (!tooltipEl.isConnected) {
      document.body.appendChild(tooltipEl);
    }

    tooltipEl.style.opacity = '0';
    tooltipEl.style.visibility = 'hidden';

    requestAnimationFrame(() => {
      tooltipEl.style.visibility = 'visible';
      positionFloatingTooltip(target, tooltipEl);
      requestAnimationFrame(() => {
        tooltipEl.style.opacity = '1';
      });
    });

    floatingTooltipState.currentTarget = target;
  }

  function hideFloatingTooltip() {
    if (!floatingTooltipState.el) return;
    const tooltipEl = floatingTooltipState.el;
    tooltipEl.style.opacity = '0';
    floatingTooltipState.currentTarget = null;
    clearTimeout(floatingTooltipState.removeTimeout);
    floatingTooltipState.removeTimeout = window.setTimeout(() => {
      if (tooltipEl.parentElement) {
        tooltipEl.parentElement.removeChild(tooltipEl);
      }
      tooltipEl.style.visibility = 'hidden';
    }, 150);
  }

  function handleTooltipEnter(event) {
    showFloatingTooltip(event.currentTarget);
  }

  function handleTooltipLeave(event) {
    const target = event.currentTarget;
    if (floatingTooltipState.currentTarget === target) {
      if (event.type === 'mouseleave' && document.activeElement === target) {
        return;
      }
      hideFloatingTooltip();
    }
  }

  function setupFloatingTooltips(container) {
    if (!container) return;
    const tooltipTargets = container.querySelectorAll('[data-tooltip]');
    tooltipTargets.forEach(target => {
      target.addEventListener('mouseenter', handleTooltipEnter);
      target.addEventListener('mouseleave', handleTooltipLeave);
      target.addEventListener('focus', handleTooltipEnter);
      target.addEventListener('blur', handleTooltipLeave);
    });
  }

  function slugifyPath(text) {
    if (!text) return '';
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  function renderFolderRow(folder) {
    const displayCustomerName = folder.customer_name || clientName || '-';
    const escapedCustomerNameAttr = displayCustomerName.replace(/"/g, '&quot;');
    const safePcAttr = (folder.pc || '').toString().replace(/"/g, '&quot;');
    const safeOcAttr = (folder.oc || '').toString().replace(/"/g, '&quot;');
    const safeFacturaAttr = (folder.factura || '').toString().replace(/"/g, '&quot;');
    const { documentsPath } = getFolderSectionContext();
    const customerRut = folder.customer_rut || folder.customer_uuid || '';
    const pcValue = folder.pc || '';
    const ocValue = folder.oc || '';
    const companyValue = displayCustomerName || '';
    const facturaValue = folder.factura ?? '';
    const documentsUrl = `${documentsPath}/${encodeURIComponent(customerRut)}/${encodeURIComponent(pcValue)}/${slugifyPath(ocValue)}/${slugifyPath(companyValue)}/${encodeURIComponent(facturaValue)}`;
    const shippingMethod = (!folder.factura || folder.factura === 0 || folder.factura === '0')
      ? (folder.medio_envio_ov || '-')
      : (folder.medio_envio_factura || '-');

    return `
      <tr data-id="${folder.id}" class="hover:shadow-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition bg-white dark:bg-gray-900">
        <td class="px-6 py-4 items-center gap-3 border-b border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">
          <div class="flex items-center gap-2">
            <a href="${documentsUrl}"
              class="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline">
              <span>${folder.pc || '-'}</span>
            </a>
          </div>
        </td>
        <td class="px-6 py-4 items-center gap-3 border-b border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">${folder.oc || '-'}</td>
        <td class="px-4 py-3 break-all border-b border-gray-200 dark:border-gray-800">
          <button class="customer-name-btn text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline transition-colors cursor-pointer"
                  data-customer-name="${escapedCustomerNameAttr}">
            ${displayCustomerName}
          </button>
        </td>
        <td class="px-6 py-4 items-center gap-3 border-b border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">${formatDateShort(folder.fecha)}</td>
        <td class="px-6 py-4 items-center gap-3 border-b border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">${shippingMethod}</td>
        <td class="px-6 py-4 items-center gap-3 border-b border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">${folder.factura || '-'}</td>
        <td class="px-6 py-4 items-center gap-3 border-b border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">${formatDateShort(folder.fecha_factura)}</td>
        <td class="px-6 py-4 items-center gap-3 border-b border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">${formatDateShort(folder.fecha_etd)}</td>
        <td class="px-6 py-4 items-center gap-3 border-b border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">${formatDateShort(folder.fecha_eta)}</td>
        <td class="px-6 py-4 items-center gap-3 border-b border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">${formatDateShort(folder.fecha_etd_factura)}</td>
        <td class="px-6 py-4 items-center gap-3 border-b border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">${formatDateShort(folder.fecha_eta_factura)}</td>
        <td class="px-6 py-4 items-center gap-3 border-b border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">${folder.incoterm || '-'}</td>
        <td class="px-6 py-4 items-center gap-3 border-b border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">${folder.puerto_destino || '-'}</td>
        <td class="px-6 py-4 items-center gap-3 border-b border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">
          <a href="${documentsUrl}"
             class="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline">
            ${getMessage(carpetas.viewDocuments)}
          </a>
        </td>
        <td class="sticky right-0 bg-gray-50 dark:bg-gray-700 z-10 px-6 py-4 min-w-[120px] overflow-visible">
          <div class="flex justify-center gap-3 relative">
            <div class="relative">
              <a href="#" class="items-list-btn text-gray-900 dark:text-white hover:text-green-500 transition"
                 data-order-pc="${safePcAttr}" data-order-oc="${safeOcAttr}" data-factura="${safeFacturaAttr}"
                 data-tooltip="${getMessage(carpetas.tooltipViewItemsDetailed)}"
                 aria-label="${getMessage(carpetas.tooltipViewItemsDetailed)}">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16"/>
                </svg>
              </a>
            </div>
            <div class="relative">
              <a href="#" class="items-detail-modal-btn text-gray-900 dark:text-white hover:text-green-500 transition"
                 data-order-pc="${safePcAttr}" data-order-oc="${safeOcAttr}" data-factura="${safeFacturaAttr}"
                 data-tooltip="${getMessage(carpetas.tooltipViewItems)}"
                 aria-label="${getMessage(carpetas.tooltipViewItems)}">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>
                </svg>
              </a>
            </div>
            <div class="relative">
              <a href="#" class="order-detail-btn text-gray-900 dark:text-white hover:text-green-500 transition"
                 data-order-id="${folder.id}" data-order-pc="${safePcAttr}" data-order-oc="${safeOcAttr}"
                 data-tooltip="${getMessage(carpetas.tooltipOrderDetails)}"
                 aria-label="${getMessage(carpetas.tooltipOrderDetails)}">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </a>
            </div>
          </div>
        </td>
      </tr>
    `;
  }

  function renderTable() {
    if (!tableBody) return;

    hideFloatingTooltip();

    const totalItems = filteredFolders.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage) || 0;

    if (totalPages > 0 && currentPage > totalPages) {
      currentPage = totalPages;
    } else if (totalPages === 0) {
      currentPage = 1;
    }

    const start = (currentPage - 1) * itemsPerPage;
    const pageData = filteredFolders.slice(start, start + itemsPerPage);

    tableBody.innerHTML = '';

    
    if (pageData.length === 0) {
      if (foldersAccessDenied) {
        const scrollBody = tableBody.closest('[data-scroll-body]');
        const viewportWidth = scrollBody?.clientWidth || 0;
        tableBody.innerHTML = `
          <tr class="bg-white dark:bg-gray-900">
            <td colspan="15" class="px-6 py-8 text-gray-500" style="position: sticky; left: 0;">
              <div class="flex justify-center text-center" style="width: ${viewportWidth ? `${viewportWidth}px` : '100%'};">
                ${getMessage(carpetas.customerNotFound)}
              </div>
            </td>
          </tr>
        `;
        return;
      }
      tableBody.innerHTML = `
          <tr class="bg-white dark:bg-gray-900">
            <td colspan="15" class="px-6 py-8 text-center text-gray-500">
              ${getMessage(carpetas.noResults)}
          </td>
        </tr>
      `;
    } else {
      pageData.forEach(folder => {
        tableBody.insertAdjacentHTML('beforeend', renderFolderRow(folder));
      });
    }

    if (pageIndicator) {
      const displayCurrent = totalPages === 0 ? 0 : currentPage;
      const pageLabel = getMessage(carpetas.pageIndicator);
      const ofLabel = getMessage(carpetas.pageIndicatorSeparator);
      pageIndicator.textContent = pageLabel
        ? `${pageLabel} ${displayCurrent} ${ofLabel} ${totalPages}`
        : `${displayCurrent} ${ofLabel} ${totalPages}`;
    }

    setupFloatingTooltips(tableBody);
  }

  function exportToExcel() {
    const foldersToExport = filteredFolders.length > 0 ? filteredFolders : allFolders;

    if (foldersToExport.length === 0) {
      showNotification(getMessage(carpetas.exportEmpty), 'warning');
      return;
    }

    const headers = [
      getMessage(carpetas.name),
      getMessage(carpetas.oc),
      getMessage(carpetas.cliente),
      getMessage(carpetas.fechaIngreso),
      getMessage(carpetas.shippingMethod),
      getMessage(carpetas.factura),
      getMessage(carpetas.fechaFactura),
      getMessage(carpetas.etdOv),
      getMessage(carpetas.etaOv),
      getMessage(carpetas.etdFactura),
      getMessage(carpetas.etaFactura),
      getMessage(carpetas.incoterm),
      getMessage(carpetas.puertoDestino),
      getMessage(carpetas.documents)
    ];

    const data = foldersToExport.map(folder => {
      const customerRut = folder.customer_rut || folder.customer_uuid || '';
      const pcValue = folder.pc || '';
      const ocValue = folder.oc || '';
      const companyValue = folder.customer_name || clientName || '';
      const facturaValue = folder.factura ?? '';
      const documentsUrl = `${documentsPath}/${encodeURIComponent(customerRut)}/${encodeURIComponent(pcValue)}/${slugifyPath(ocValue)}/${slugifyPath(companyValue)}/${encodeURIComponent(facturaValue)}`;
      const shippingMethod = (!folder.factura || folder.factura === 0 || folder.factura === '0')
        ? (folder.medio_envio_ov || '')
        : (folder.medio_envio_factura || '');

      return [
        folder.pc || '',
        folder.oc || '',
        folder.customer_name || companyValue || '',
        formatDateShort(folder.fecha) || '',
        shippingMethod,
        folder.factura || '',
        formatDateShort(folder.fecha_factura) || '',
        formatDateShort(folder.fecha_etd) || '',
        formatDateShort(folder.fecha_eta) || '',
        formatDateShort(folder.fecha_etd_factura) || '',
        formatDateShort(folder.fecha_eta_factura) || '',
        folder.incoterm || '',
        folder.puerto_destino || '',
        documentsUrl
      ];
    });

    const BOM = '\uFEFF';
    const csvContent = BOM + [
      headers.join(';'),
      ...data.map(row => row.map(cell => {
        const text = cell?.toString?.() ?? '';
        const escapedCell = text.replace(/"/g, '""');
        return text.includes(';') ? `"${escapedCell}"` : escapedCell;
      }).join(';'))
    ].join('\r\n');

    const blob = new Blob([csvContent], {
      type: 'text/csv;charset=utf-8;header=present'
    });

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ordenes_cliente_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    const exportMessage = formatMessage(getMessage(carpetas.exportSuccess), {
      count: foldersToExport.length
    });
    showNotification(exportMessage, 'success');
  }

  setupStickyTableControls();

  /**
   * Función para ordenar las carpetas
   */
  function sortFolders(column, direction) {
    if (!column) return;

    const dateColumns = new Set([
      'fecha',
      'fecha_factura',
      'fecha_etd',
      'fecha_eta',
      'fecha_etd_factura',
      'fecha_eta_factura'
    ]);
    const localeCompareOptions = { numeric: true, sensitivity: 'base' };
    const multiplier = direction === 'desc' ? -1 : 1;

    const getComparableValue = (folder) => {
      switch (column) {
        case 'pc':
          return folder.pc ?? '';
        case 'oc':
          return folder.oc ?? '';
        case 'customer_name':
          return folder.customer_name ?? '';
        case 'fecha':
          return folder.fecha ?? '';
        case 'medio_envio_factura':
          return (!folder.factura || folder.factura === 0 || folder.factura === '0')
            ? (folder.medio_envio_ov ?? '')
            : (folder.medio_envio_factura ?? '');
        case 'factura':
          return folder.factura ?? '';
        case 'fecha_factura':
          return folder.fecha_factura ?? '';
        case 'fecha_etd':
          return folder.fecha_etd ?? '';
        case 'fecha_eta':
          return folder.fecha_eta ?? '';
        case 'fecha_etd_factura':
          return folder.fecha_etd_factura ?? '';
        case 'fecha_eta_factura':
          return folder.fecha_eta_factura ?? '';
        case 'incoterm':
          return folder.incoterm ?? '';
        case 'puerto_destino':
          return folder.puerto_destino ?? '';
        default:
          return '';
      }
    };

    filteredFolders.sort((aFolder, bFolder) => {
      const rawA = getComparableValue(aFolder);
      const rawB = getComparableValue(bFolder);

      if (dateColumns.has(column)) {
        const timeA = rawA ? new Date(rawA).getTime() : Number.NaN;
        const timeB = rawB ? new Date(rawB).getTime() : Number.NaN;

        const aInvalid = Number.isNaN(timeA);
        const bInvalid = Number.isNaN(timeB);

        if (aInvalid && bInvalid) return 0;
        if (aInvalid) return 1 * multiplier;
        if (bInvalid) return -1 * multiplier;

        if (timeA === timeB) return 0;
        return (timeA - timeB) * multiplier;
      }

      const aValue = rawA.toString().trim().toLowerCase();
      const bValue = rawB.toString().trim().toLowerCase();

      const aEmpty = aValue.length === 0;
      const bEmpty = bValue.length === 0;

      if (aEmpty || bEmpty) {
        if (aEmpty && bEmpty) return 0;
        return aEmpty ? 1 * multiplier : -1 * multiplier;
      }

      const comparison = aValue.localeCompare(bValue, undefined, localeCompareOptions);
      return comparison * multiplier;
    });

    renderTable();
  }

  /**
   * Función para actualizar los iconos de ordenamiento
   */
  function updateSortIcons(activeColumn, direction) {
    // Resetear todos los iconos
    document.querySelectorAll('.sort-icon').forEach(icon => {
      icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" d="M8 9l4-4 4 4m0 6l-4 4-4-4" />';
      icon.classList.remove('text-blue-600');
    });
    
    // Actualizar el icono activo
    if (activeColumn) {
      const activeHeader = document.querySelector(`[data-sort="${activeColumn}"]`);
      if (activeHeader) {
        const icon = activeHeader.querySelector('.sort-icon');
        if (icon) {
          icon.classList.add('text-blue-600');
          if (direction === 'asc') {
            icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7" />';
          } else {
            icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />';
          }
        }
      }
    }
  }

  // Inicializar la tabla
  async function refreshFolders() {
    const folders = await loadFoldersWithCache(uuID, resolvedApiBase);
    allFolders = Array.isArray(folders) ? folders : [];
    filterFolders({ resetPage: true });
  }

  function filterFolders({ resetPage = true } = {}) {
    const query = (searchInput?.value || '').toLowerCase().trim();

    if (!query) {
      filteredFolders = [...allFolders];
    } else {
      filteredFolders = allFolders.filter(folder => {
        const searchableText = [
          folder.pc,
          folder.oc,
          folder.customer_name,
          folder.medio_envio_factura,
          folder.factura,
          folder.incoterm,
          folder.puerto_destino,
          folder.certificados,
          folder.fecha,
          folder.fecha_factura,
          folder.fecha_etd,
          folder.fecha_eta,
          folder.fecha_etd_factura,
          folder.fecha_eta_factura
        ]
          .map(value => (value ?? '').toString().toLowerCase())
          .join(' ');

        return searchableText.includes(query);
      });
    }

    if (resetPage) {
      currentPage = 1;
    }

    if (currentSort.column) {
      sortFolders(currentSort.column, currentSort.direction);
    } else {
      renderTable();
    }
  }

  searchInput?.addEventListener('input', () => {
    filterFolders();
  });

  itemsPerPageSelect?.addEventListener('change', () => {
    itemsPerPage = parseInt(itemsPerPageSelect.value, 10) || 10;
    currentPage = 1;
    renderTable();
  });

  prevPageBtn?.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage -= 1;
      renderTable();
    }
  });

  nextPageBtn?.addEventListener('click', () => {
    const totalPages = Math.ceil(filteredFolders.length / itemsPerPage) || 0;
    if (totalPages > 0 && currentPage < totalPages) {
      currentPage += 1;
      renderTable();
    }
  });

  if (exportBtn) {
    exportBtn.addEventListener('click', exportToExcel);
  }

  document.addEventListener('click', (e) => {
    const customerNameBtn = e.target.closest('.customer-name-btn');
    if (customerNameBtn) {
      e.preventDefault();
      const customerName = customerNameBtn.dataset.customerName;
      if (customerName && customerName !== '-') {
        navigateToClientsWithFilter(customerName);
      }
    }
  });

  document.addEventListener('click', (e) => {
    const header = e.target.closest('th[data-sort]');
    if (!header) return;

    e.preventDefault();
    const column = header.dataset.sort;

    if (currentSort.column === column) {
      currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
      currentSort.column = column;
      currentSort.direction = 'asc';
    }

    sortFolders(currentSort.column, currentSort.direction);
    updateSortIcons(currentSort.column, currentSort.direction);
    currentPage = 1;
    renderTable();
  });
  // ===== MODAL DE DETALLES DE ORDEN =====
  async function loadOrderDetail(orderId, pc, oc) {
    try {     
      const response = await fetch(`${apiBase}/api/orders/${encodeURIComponent(orderId)}/detail`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });

      let orderDetail;

      if (response.ok) {
        orderDetail = await response.json();
      } else if (response.status === 404) {
        // Si no hay datos en order_detail, crear un objeto con datos básicos
        orderDetail = {
          pc: pc,
          oc: oc,
          fecha_etd: null,
          fecha_eta: null,
          incoterm: null,
          certificados: null,
          direccion_destino: null,
          puerto_destino: null,
          u_observaciones: null
        };
      } else {
        throw await buildErrorFromResponse(response);
      }

      // Actualizar el título del modal
      document.getElementById('orderDetailTitle').textContent = `PC: ${pc} - OC: ${oc}`;
      document.getElementById('orderDetailInitials').textContent = 'OD';

      // Función helper para mostrar valores
      const setValue = (elementId, value) => {
        const element = document.getElementById(elementId);
        if (element) {
          element.textContent = value || '-';
        } else {
          console.error(`Element not found: ${elementId}`);
        }
      };

      // Función helper para formatear fechas
      const formatDateValue = (dateString) => {
        if (!dateString) return '-';
        return formatDateShort(dateString);
      };

      // Actualizar los campos del modal
      setValue('orderDetailPc', orderDetail.pc);
      setValue('orderDetailOc', orderDetail.oc);
      setValue('orderDetailFechaEtd', formatDateValue(orderDetail.fecha_etd));
      setValue('orderDetailFechaEta', formatDateValue(orderDetail.fecha_eta));
      setValue('orderDetailIncoterm', orderDetail.incoterm);
      setValue('orderDetailCertificados', orderDetail.certificados);
      setValue('orderDetailDireccionDestino', orderDetail.direccion_destino);
      setValue('orderDetailPuertoDestino', orderDetail.puerto_destino);

      showModal('#orderDetailModal');

    } catch (error) {
      console.error('Error loading order detail:', error);
      showNotification(resolveBackendMessage(error.code, getMessage(messagesFolders.detailLoadError)), 'error');
    }
  }

  function buildItemsDetailTable(items) {
    const currency = items[0]?.currency || items[0]?.moneda || 'CLP';
    return `
      <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead class="bg-gray-100 dark:bg-gray-800 sticky top-0 z-10">
          <tr>
            <th class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">${getMessage(carpetas.itemCode)}</th>
            <th class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">${getMessage(carpetas.itemName)}</th>
            <th class="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">${getMessage(carpetas.tipo)}</th>
            <th class="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">${getMessage(carpetas.kgSolicitados)}</th>
            <th class="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">${getMessage(carpetas.kgDespachados)}</th>
            <th class="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">${getMessage(carpetas.kgFacturados)}</th>
            <th class="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">${getMessage(carpetas.fechaEtd)}</th>
            <th class="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">${getMessage(carpetas.fechaEta)}</th>
            <th class="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">${getMessage(carpetas.precioUnitario)}</th>
            <th class="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">${getMessage(carpetas.total)}</th>
          </tr>
        </thead>
        <tbody class="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800 text-xs">
          ${items.map(item => {
            const quantity = parseFloat(item.kg_solicitados) || 0;
            const unitPrice = parseFloat(item.unit_price) || 0;
            const total = quantity * unitPrice;
            return `
              <tr class="hover:bg-gray-50 dark:hover:bg-gray-600 transition">
                <td class="px-6 py-4 text-xs text-gray-900 dark:text-gray-100">${item.item_code || 'N/A'}</td>
                <td class="px-6 py-4 text-xs text-gray-900 dark:text-gray-100">${item.item_name || 'N/A'}</td>
                <td class="px-6 py-4 text-xs text-center text-gray-900 dark:text-gray-100">${item.tipo || 'N/A'}</td>
                <td class="px-6 py-4 text-xs text-center text-gray-900 dark:text-gray-100">${formatQuantity(quantity, 'KG')}</td>
                <td class="px-6 py-4 text-xs text-center text-gray-900 dark:text-gray-100">${formatQuantity(parseFloat(item.kg_despachados) || 0, 'KG')}</td>
                <td class="px-6 py-4 text-xs text-center text-gray-900 dark:text-gray-100">${formatQuantity(parseFloat(item.kg_facturados) || 0, 'KG')}</td>
                <td class="px-6 py-4 text-xs text-center text-gray-900 dark:text-gray-100 whitespace-nowrap">${item.fecha_etd ? new Date(item.fecha_etd).toLocaleDateString('es-CL') : '-'}</td>
                <td class="px-6 py-4 text-xs text-center text-gray-900 dark:text-gray-100 whitespace-nowrap">${item.fecha_eta ? new Date(item.fecha_eta).toLocaleDateString('es-CL') : '-'}</td>
                <td class="px-6 py-4 text-xs text-center text-gray-900 dark:text-gray-100">${formatUnitPrice(unitPrice, currency)}</td>
                <td class="px-6 py-4 text-xs text-center font-semibold text-gray-900 dark:text-gray-100">${formatTotal(total, currency)}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  }

  async function openItemsDetailModal(orderPc, orderOc, factura) {
    const detailModal = document.getElementById('itemsDetailModal');
    const detailTitle = document.getElementById('itemsDetailTitle');
    const detailContainer = document.getElementById('itemsDetailTableContainer');
    if (!detailModal || !detailContainer) return;

    if (detailTitle) {
      detailTitle.textContent = `${getMessage(carpetas.itemsOfOrder)} ${orderOc || '-'}`;
    }
    detailContainer.innerHTML = `
      <div class="bg-white dark:bg-gray-700 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600">
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead class="bg-gray-100 dark:bg-gray-800 sticky top-0 z-10">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">${getMessage(carpetas.itemCode)}</th>
                <th class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">${getMessage(carpetas.itemName)}</th>
                <th class="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">${getMessage(carpetas.tipo)}</th>
                <th class="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">${getMessage(carpetas.kgSolicitados)}</th>
                <th class="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">${getMessage(carpetas.kgDespachados)}</th>
                <th class="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">${getMessage(carpetas.kgFacturados)}</th>
                <th class="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">${getMessage(carpetas.fechaEtd)}</th>
                <th class="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">${getMessage(carpetas.fechaEta)}</th>
                <th class="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">${getMessage(carpetas.precioUnitario)}</th>
                <th class="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">${getMessage(carpetas.total)}</th>
              </tr>
            </thead>
            <tbody class="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800 text-xs">
              ${buildLoadingRow(10)}
            </tbody>
          </table>
        </div>
      </div>
    `;
    showModal('#itemsDetailModal');

    try {
      const token = localStorage.getItem('token');
      const apiBase = window.apiBase;
      const safeOrderOc = orderOc ? encodeURIComponent(orderOc) : '';
      const safeFactura = factura && factura !== 'null' ? encodeURIComponent(factura) : '';
      const url = factura && factura !== 'null'
        ? `${apiBase}/api/orders/${orderPc}/${safeOrderOc}/${safeFactura}/items`
        : `${apiBase}/api/orders/${orderPc}/${safeOrderOc}/items`;

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        throw await buildErrorFromResponse(response, 'Error al cargar los items de la orden');
      }

      const items = await response.json();
      if (detailTitle) {
        detailTitle.textContent = `${getMessage(carpetas.itemsOfOrder)} ${orderOc || '-'}`;
      }
      detailContainer.innerHTML = `
        <div class="bg-white dark:bg-gray-700 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600">
          <div class="overflow-x-auto">
            ${buildItemsDetailTable(items)}
          </div>
        </div>
      `;
    } catch (error) {
      console.error('Error cargando items para modal:', error);
      showNotification(resolveBackendMessage(error.code, getMessage(messagesFolders.itemsLoadError)), 'error');
      detailModal.classList.add('hidden');
      detailModal.classList.remove('flex');
    }
  }


  // Función helper para formatear cantidad
  function formatQuantity(quantity, unit) {
    const unitMap = {
      'KG': 'kg',
      'KILOGRAMOS': 'kg',
      'TON': 'ton',
      'TONELADAS': 'ton',
      'LITROS': 'L',
      'L': 'L',
      'UNIDADES': 'un',
      'UN': 'un'
    };
    
    const mappedUnit = unitMap[unit] || unit?.toLowerCase?.() || unit || '';
    const numericAmount = Number(typeof quantity === 'string' ? quantity.replace(',', '.') : quantity);
    const safeAmount = Number.isFinite(numericAmount) ? numericAmount : 0;
    return `${safeAmount.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${mappedUnit}`;
  }

  // Cargar los datos iniciales
  async function loadAndRenderFolders() {
    const loadingRow = document.getElementById('loadingRow');
    try {
      await refreshFolders();

      if (loadingRow) {
        loadingRow.remove();
      }
    } catch (error) {
      console.error('Error cargando carpetas:', error);
      if (loadingRow) {
        const errorMessage = resolveBackendMessage(error.code, getMessage(messagesFolders.loadError));
        const retryLabel = getMessage(messagesFolders.retry);
        loadingRow.innerHTML = buildCenteredCell(
          `${errorMessage} <button onclick="location.reload()" class="text-blue-500 hover:underline">${retryLabel}</button>`,
          'text-red-500'
        );
      }
    }
  }

  async function refreshData() {
    try {
      clearFoldersCache(uuID);
      await refreshFolders();
      renderTable();
      showNotification(getMessage(messagesFolders.dataRefreshed), 'success');
    } catch (error) {
      console.error('Error refrescando carpetas:', error);
      showNotification(resolveBackendMessage(error.code, getMessage(messagesFolders.refreshError)), 'error');
    }
  }

  function setupAutoRefresh() {
    const checkCacheExpiry = () => {
      if (!isFoldersCacheValid(uuID)) {
        refreshData();
      }
    };
    setInterval(checkCacheExpiry, 30 * 60 * 1000);
  }

  setupModalClose('#itemsModal', '#closeItemsModalBtn');
  setupModalClose('#itemsDetailModal', '#closeItemsDetailModalBtn');
  setupModalClose('#orderDetailModal', '#closeOrderDetailModalBtn');

  await loadAndRenderFolders();
  setupAutoRefresh();

  /**
   * Configurar event listeners para los modales
   */
  function setupModalEventListeners() {
    // Event listeners para botones de items
    document.addEventListener('click', (e) => {
      const itemsBtn = e.target.closest('.items-list-btn');
      if (itemsBtn) {
        e.preventDefault();
        const orderPc = itemsBtn.dataset.orderPc;
        const orderOc = itemsBtn.dataset.orderOc;
        const factura = itemsBtn.dataset.factura;
        openItemsModal(orderPc, orderOc, factura);
      }
    });

    document.addEventListener('click', (e) => {
      const detailBtn = e.target.closest('.items-detail-modal-btn');
      if (detailBtn) {
        e.preventDefault();
        const orderPc = detailBtn.dataset.orderPc;
        const orderOc = detailBtn.dataset.orderOc;
        const factura = detailBtn.dataset.factura;
        openItemsDetailModal(orderPc, orderOc, factura);
      }
    });

    // Event listeners para botones de detalles de orden
    document.addEventListener('click', (e) => {
      const detailBtn = e.target.closest('.order-detail-btn');
      if (detailBtn) {
        e.preventDefault();
        const orderId = detailBtn.dataset.orderId;
        const row = detailBtn.closest('tr');
        const pc = row?.cells[0]?.textContent?.trim() || '';
        const oc = row?.cells[1]?.textContent?.trim() || '';
        loadOrderDetail(orderId, pc, oc);
      }
    });
  }
} 

