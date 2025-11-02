import { 
  qs, 
  showNotification, 
  formatDateShort
} from './utils.js';

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
    window.location.href = '/admin/clients';
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
  return `${amount.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${mappedUnit}`;
}

// Función para formatear precio unitario
function formatUnitPrice(amount) {
  return `$${amount.toFixed(4).replace(',', '.')}`;
}

// Función para formatear total
function formatTotal(amount) {
  const safeAmount = parseNumber(amount);
  const formattedAmount = safeAmount.toLocaleString('es-CL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return `$${formattedAmount}`;
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

// Función para abrir modal de items (mover fuera de initFoldersScript)
async function openItemsModal(orderPc, orderOc, factura) {
  const itemsModal = document.getElementById('itemsModal');
  const itemsOrderTitle = document.getElementById('itemsOrderTitle');
  const itemsTableBody = document.getElementById('itemsTableBody');

  if (!itemsModal || !itemsOrderTitle || !itemsTableBody) return;

  try {
    // Cargar items de la orden
    const token = localStorage.getItem('token');
    const apiBase = window.apiBase;

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
      throw new Error('Error al cargar los items de la orden');
    }

    const items = await response.json();
    const normalizedItems = Array.isArray(items) ? items : [];
    const hasFactura = factura && factura !== 'null';
    
    // Actualizar header del modal
    document.getElementById('itemsInitials').textContent = 'IT';
    document.getElementById('itemsOrderTitle').textContent = `Orden: ${orderOc}`;
    document.getElementById('itemsOrderSubtitle').textContent = 'Lista de Items';
    
    // Renderizar tabla de items
    if (itemsTableBody) {
      const currency = normalizedItems[0]?.currency || 'CLP';
      if (normalizedItems.length === 0) {
        itemsTableBody.innerHTML = `
          <tr>
            <td colspan="5" class="px-6 py-4 text-center text-xs text-gray-500 dark:text-gray-400">
              ${window.translations?.carpetas?.noItemsFound || 'No se encontraron items para esta orden'}
            </td>
          </tr>
        `;
      } else {
        itemsTableBody.innerHTML = normalizedItems.map(item => {
          const rawQuantity = hasFactura ? item.kg_facturados : item.kg_solicitados;
          const quantity = parseNumber(rawQuantity);
          const unitPrice = parseNumber(item.unit_price);
          const total = quantity * unitPrice;
          const unit = item.unidad_medida || 'KG';

          return `
            <tr class="hover:bg-gray-50 dark:hover:bg-gray-800 transition">
              <td class="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">${item.item_code || 'N/A'}</td>
              <td class="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">${item.item_name || 'N/A'}</td>
              <td class="px-6 py-4 text-sm text-center text-gray-900 dark:text-gray-100">${formatQuantity(quantity, unit)}</td>
              <td class="px-6 py-4 text-sm text-center text-gray-900 dark:text-gray-100">${formatUnitPrice(unitPrice)}</td>
              <td class="px-6 py-4 text-sm text-center font-semibold text-gray-900 dark:text-gray-100">${formatTotal(total)}</td>
            </tr>
          `;
        }).join('');
      }
    }

    // Calcular y mostrar totales
    const totalItems = document.getElementById('totalItems');
    const totalQuantity = document.getElementById('totalQuantity');
    const totalValue = document.getElementById('totalValue');
    const totalGastoAdicional = document.getElementById('totalGastoAdicional');

    const totalItemsCount = normalizedItems.length;

    const totalQuantitySum = normalizedItems.reduce((sum, item) => {
      const rawQuantity = hasFactura ? item.kg_facturados : item.kg_solicitados;
      const quantity = parseNumber(rawQuantity);
      return sum + quantity;
    }, 0);

    const totalValueSum = normalizedItems.reduce((sum, item) => {
      const rawQuantity = hasFactura ? item.kg_facturados : item.kg_solicitados;
      const quantity = parseNumber(rawQuantity);
      const price = parseNumber(item.unit_price);
      return sum + (quantity * price);
    }, 0);

    const currency = normalizedItems[0]?.currency || 'CLP';
    const unit = normalizedItems[0]?.unidad_medida || 'KG';
    const rawGastoAdicionalFactura = normalizedItems[0]?.gasto_adicional_flete_factura;
    const shouldUseFacturaExpense = hasFactura && rawGastoAdicionalFactura !== null && rawGastoAdicionalFactura !== undefined && rawGastoAdicionalFactura !== '';
    const rawGastoAdicional = shouldUseFacturaExpense ? rawGastoAdicionalFactura : normalizedItems[0]?.gasto_adicional_flete;
    const gastoAdicional = parseNumber(rawGastoAdicional);

    if (totalItems) totalItems.textContent = totalItemsCount;
    if (totalQuantity) totalQuantity.textContent = formatQuantity(totalQuantitySum, unit);
    if (totalValue) totalValue.textContent = formatCurrency(totalValueSum, currency);
    if (totalGastoAdicional) totalGastoAdicional.textContent = formatCurrency(gastoAdicional, currency);

    // Mostrar modal
    itemsModal.classList.remove('hidden');
    itemsModal.classList.add('flex');
    
  } catch (error) {
    console.error('Error cargando items para modal:', error);
    // Mostrar notificación de error si está disponible
    if (typeof showNotification === 'function') {
      showNotification('Error al cargar items de la orden', 'error');
    }
  }
}

// Función para cargar traducciones (usar las que vienen del servidor)
async function loadTranslations(lang, section) {
  try {
    // Las traducciones ya vienen del servidor, no necesitamos cargarlas dinámicamente
    // Si necesitamos traducciones específicas, usar las que están en window.translations
    if (window.translations && window.translations[section]) {
      return window.translations[section];
    }
    
    // Fallback con traducciones básicas
    const fallbackTranslations = {
      messages: {
        loading: 'Cargando...',
        error: 'Error',
        success: 'Éxito',
        confirm: 'Confirmar',
        cancel: 'Cancelar'
      },
      carpetas: {
        title: 'Carpetas',
        customers: 'Clientes',
        name: 'Nombre',
        created: 'Creado',
        updated: 'Actualizado',
        actions: 'Acciones'
      }
    };
    
    return fallbackTranslations[section] || {};
  } catch (err) {
    console.warn('Fallo carga traducción:', err);
    return {};
  }
}

export async function initFoldersScript() {
  // Obtener apiBase desde las variables de entorno
  const apiBase = window.apiBase || section?.dataset.apiBase;
  
  // Cargar traducciones
  const currentLang = localStorage.getItem('lang') || 'en';
  const messages = await loadTranslations(currentLang, 'messages');
  const t = await loadTranslations(currentLang, 'carpetas');

  // Configurar event listeners de modales
  setupModalEventListeners();

  const tableBody = qs('foldersTableBody');
  const searchInput = qs('searchInput');
  const itemsPerPageSelect = qs('itemsPerPageSelect');
  const prevPageBtn = qs('prevPageBtn');
  const nextPageBtn = qs('nextPageBtn');
  const pageIndicator = qs('pageIndicator');
  const section = qs('folderSection');
  const uuID = section?.dataset?.uuid;

  let allFolders = [];
  let filteredFolders = [];
  let currentPage = 1;
  let itemsPerPage = parseInt(itemsPerPageSelect?.value || '10', 10);
  let currentSort = { column: null, direction: 'asc' };

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
        zIndex: '10',
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

  function renderFolderRow(folder) {
    const displayCustomerName = folder.customer_name || clientName || '-';
    const escapedCustomerNameAttr = displayCustomerName.replace(/"/g, '&quot;');
    const encodedCustomerName = encodeURIComponent(displayCustomerName);
    const safePcAttr = (folder.pc || '').toString().replace(/"/g, '&quot;');
    const safeOcAttr = (folder.oc || '').toString().replace(/"/g, '&quot;');
    const safeFacturaAttr = (folder.factura || '').toString().replace(/"/g, '&quot;');
    const documentsUrl = `/admin/clients/documents/view/${folder.customer_uuid}?f=${folder.id}&pc=${folder.pc}&c=${encodedCustomerName}`;

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
        <td class="px-6 py-4 items-center gap-3 border-b border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">${folder.medio_envio_factura || '-'}</td>
        <td class="px-6 py-4 items-center gap-3 border-b border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">${folder.factura || '-'}</td>
        <td class="px-6 py-4 items-center gap-3 border-b border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">${formatDateShort(folder.fecha_factura)}</td>
        <td class="px-6 py-4 items-center gap-3 border-b border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">${formatDateShort(folder.fecha_etd)}</td>
        <td class="px-6 py-4 items-center gap-3 border-b border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">${formatDateShort(folder.fecha_eta)}</td>
        <td class="px-6 py-4 items-center gap-3 border-b border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">${folder.incoterm || '-'}</td>
        <td class="px-6 py-4 items-center gap-3 border-b border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">${folder.puerto_destino || '-'}</td>
        <td class="px-6 py-4 items-center gap-3 border-b border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">
          <a href="${documentsUrl}"
             class="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline">
            ${window.translations?.carpetas?.viewDocuments || 'ver documentos'}
          </a>
        </td>
        <td class="sticky right-0 bg-gray-50 dark:bg-gray-700 z-10 px-6 py-4 min-w-[120px] overflow-visible">
          <div class="flex justify-center gap-3 relative">
            <div class="relative">
              <a href="#" class="items-list-btn text-gray-900 dark:text-white hover:text-green-500 transition"
                 data-order-pc="${safePcAttr}" data-order-oc="${safeOcAttr}" data-factura="${safeFacturaAttr}"
                 data-tooltip="${window.translations?.carpetas?.tooltipViewItems || 'Ver lista de items'}"
                 aria-label="${window.translations?.carpetas?.tooltipViewItems || 'Ver lista de items'}">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16"/>
                </svg>
              </a>
            </div>
            <div class="relative">
              <a href="#" class="expand-items-btn text-gray-900 dark:text-white hover:text-green-500 transition"
                 data-order-pc="${safePcAttr}" data-order-oc="${safeOcAttr}" data-factura="${safeFacturaAttr}"
                 data-tooltip="${window.translations?.carpetas?.tooltipExpandItems || 'Expandir items en tabla'}"
                 aria-label="${window.translations?.carpetas?.tooltipExpandItems || 'Expandir items en tabla'}">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
                </svg>
              </a>
            </div>
            <div class="relative">
              <a href="#" class="order-detail-btn text-gray-900 dark:text-white hover:text-green-500 transition"
                 data-order-id="${folder.id}" data-order-pc="${safePcAttr}" data-order-oc="${safeOcAttr}"
                 data-tooltip="${window.translations?.carpetas?.tooltipOrderDetails || 'Ver detalles de orden'}"
                 aria-label="${window.translations?.carpetas?.tooltipOrderDetails || 'Ver detalles de orden'}">
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
      tableBody.innerHTML = `
        <tr class="bg-white dark:bg-gray-900">
          <td colspan="13" class="px-6 py-8 text-center text-gray-500">
            ${window.translations?.carpetas?.emptyState || 'No se encontraron carpetas'}
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
      pageIndicator.textContent = `Page ${displayCurrent} of ${totalPages}`;
    }

    setupFloatingTooltips(tableBody);
  }

  /**
   * Función para ordenar las carpetas
   */
  function sortFolders(column, direction) {
    if (!column) return;

    const dateColumns = new Set(['fecha', 'fecha_factura', 'fecha_etd', 'fecha_eta']);
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
          return folder.medio_envio_factura ?? '';
        case 'factura':
          return folder.factura ?? '';
        case 'fecha_factura':
          return folder.fecha_factura ?? '';
        case 'fecha_etd':
          return folder.fecha_etd ?? '';
        case 'fecha_eta':
          return folder.fecha_eta ?? '';
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
    const res = await fetch(`${apiBase}/api/directories/${uuID}`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`
      }
    });
    const folders = await res.json();

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
          folder.fecha_eta
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
  /**
   * Funcionalidad del modal de items
   */
  const itemsModal = document.getElementById('itemsModal');
  const closeItemsModalBtn = document.getElementById('closeItemsModalBtn');

  /**
   * Función para obtener las iniciales del nombre
   */
  function getInitials(name) {
    if (!name) return 'IT';
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  /**
   * Función para formatear moneda
   */
  function formatCurrency(amount, currency = 'CLP') {
    const currencyMap = {
      'USD': 'USD',
      'US': 'USD',
      'UF': 'CLF',
      'CLP': 'CLP',
      'PESO': 'CLP'
    };
    
    const mappedCurrency = currencyMap[currency] || currency;
    
    const formatted = new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: mappedCurrency,
      minimumFractionDigits: 4,
      maximumFractionDigits: 4
    }).format(amount);
    
    // Agregar espacio después del código de moneda y asegurar USD
    return formatted.replace(/([A-Z]{2,3})\$/, '$1 $').replace('US $', 'USD $');
  }

  /**
   * Función para formatear cantidad con unidad
   */
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
    return `${amount.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${mappedUnit}`;
  }

  /**
   * Función para formatear precio unitario
   */
  function formatUnitPrice(amount) {
    return `$${amount.toFixed(4).replace(',', '.')}`;
  }

  /**
   * Función para formatear total
   */
  function formatTotal(amount) {
    const parts = amount.toFixed(4).split('.');
    const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `$${integerPart},${parts[1]}`;
  }

  /**
   * Función para cargar items de una orden
   */
  async function loadOrderItems(orderId, oc, clientName) {
    try {
      const token = localStorage.getItem('token');
      // Obtener el PC de la fila
      const row = document.querySelector(`tr[data-id="${orderId}"]`);
      const pc = row?.cells[0]?.textContent?.trim() || '';
      
      const response = await fetch(`${apiBase}/api/orders/${pc}/${oc}/items`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Error al cargar los items de la orden');
      }

      const items = await response.json();
      
      // Actualizar header del modal
      document.getElementById('itemsInitials').textContent = getInitials(clientName);
      document.getElementById('itemsOrderTitle').textContent = `${window.translations?.carpetas?.order || 'Orden'}: ${oc}`;
      document.getElementById('itemsOrderSubtitle').textContent = window.translations?.carpetas?.itemsList || 'Lista de Items';
      
      // Renderizar tabla de items
      const tableBody = document.getElementById('itemsTableBody');
      if (tableBody) {
        const currency = items[0]?.currency || 'CLP';
        tableBody.innerHTML = items.map(item => {
          const quantity = parseFloat(item.kg_solicitados) || 0;
          const unitPrice = parseFloat(item.unit_price) || 0;
          const total = quantity * unitPrice;
          const unit = item.unidad_medida || 'KG';
          
          return `
            <tr class="hover:bg-gray-50 dark:hover:bg-gray-800 transition">
              <td class="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">${item.item_code || 'N/A'}</td>
              <td class="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">${item.item_name || 'N/A'}</td>
              <td class="px-6 py-4 text-sm text-center text-gray-900 dark:text-gray-100">${formatQuantity(quantity, unit)}</td>
              <td class="px-6 py-4 text-sm text-center text-gray-900 dark:text-gray-100">${formatUnitPrice(unitPrice)}</td>
              <td class="px-6 py-4 text-sm text-center font-semibold text-gray-900 dark:text-gray-100">${formatTotal(total)}</td>
            </tr>
          `;
        }).join('');
      }

      // Calcular y mostrar totales
      const totalItems = items.length;
      
      const totalQuantity = items.reduce((sum, item) => {
        const quantity = parseFloat(item.kg_solicitados) || 0;
        return sum + quantity;
      }, 0);
      
      const totalValue = items.reduce((sum, item) => {
        const quantity = parseFloat(item.kg_solicitados) || 0;
        const price = parseFloat(item.unit_price) || 0;
        const itemTotal = quantity * price;
        return sum + itemTotal;
      }, 0);

      const currency = items[0]?.currency || 'CLP';
      const unit = items[0]?.unidad_medida || 'KG';
      document.getElementById('totalItems').textContent = totalItems;
      document.getElementById('totalQuantity').textContent = formatQuantity(totalQuantity, unit);
      document.getElementById('totalValue').textContent = formatCurrency(totalValue.toFixed(4), currency);

      // Mostrar el modal
      itemsModal.classList.remove('hidden');
      itemsModal.classList.add('flex');

    } catch (error) {
      console.error('Error loading order items:', error);
      showNotification('Error al cargar los items de la orden', 'error');
    }
  }

  /**
   * Función para cerrar el modal de items
   */
  function closeItemsModal() {
    itemsModal.classList.add('hidden');
    itemsModal.classList.remove('flex');
  }

  /**
   * Event listeners para el modal de items
   */
  if (closeItemsModalBtn) {
    closeItemsModalBtn.addEventListener('click', closeItemsModal);
  }

  // Cerrar modal al hacer clic fuera
  if (itemsModal) {
    itemsModal.addEventListener('click', (e) => {
      if (e.target === itemsModal) {
        closeItemsModal();
      }
    });
  }

  renderTable();

  // ===== MODAL DE DETALLES DE ORDEN =====
  const orderDetailModal = qs('orderDetailModal');
  const closeOrderDetailModalBtn = qs('closeOrderDetailModalBtn');

  /**
   * Función para cargar los detalles de una orden
   */
  async function loadOrderDetail(orderId, pc, oc) {
    try {     
      const response = await fetch(`${apiBase}/api/orders/${orderId}/detail`, {
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
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
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

      // Mostrar el modal
      orderDetailModal.classList.remove('hidden');
      orderDetailModal.classList.add('flex');

    } catch (error) {
      console.error('Error loading order detail:', error);
      showNotification('Error al cargar los detalles de la orden', 'error');
    }
  }

  /**
   * Función para cerrar el modal de detalles
   */
  function closeOrderDetailModal() {
    orderDetailModal.classList.add('hidden');
    orderDetailModal.classList.remove('flex');
  }

  /**
   * Event listeners para el modal de detalles
   */
  if (closeOrderDetailModalBtn) {
    closeOrderDetailModalBtn.addEventListener('click', closeOrderDetailModal);
  }

  // Cerrar modal al hacer clic fuera
  if (orderDetailModal) {
    orderDetailModal.addEventListener('click', (e) => {
      if (e.target === orderDetailModal) {
        closeOrderDetailModal();
      }
    });
  }

  // Función para expandir/contraer items de una orden
  async function toggleItemsExpansion(orderPc, orderOc, factura) {
    // Buscar la fila específica usando el botón que se hizo clic
    const expandBtn = document.querySelector(`[data-order-pc="${orderPc}"][data-order-oc="${orderOc}"].expand-items-btn`);
    const row = expandBtn?.closest('tr');
    if (!row) return;

    // Verificar si ya está expandido
    const existingExpandedRow = row.nextElementSibling;
    if (existingExpandedRow && existingExpandedRow.classList.contains('expanded-items-row')) {
      // Contraer
      existingExpandedRow.remove();
      // Cambiar icono a flecha hacia abajo
      expandBtn.querySelector('svg').innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>';
      return;
    }

    try {
      // Cargar items de la orden
      const token = localStorage.getItem('token');
      const apiBase = window.apiBase;

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
        throw new Error('Error al cargar los items de la orden');
      }

      const items = await response.json();
      
      // Crear fila expandida
      const expandedRow = document.createElement('tr');
      expandedRow.className = 'expanded-items-row bg-gray-50 dark:bg-gray-800';
      
      const expandedCell = document.createElement('td');
      expandedCell.colSpan = 13; // Ajustar según el número de columnas de la tabla de folders
      expandedCell.className = 'px-6 py-4';
      
      // Crear tabla de items
      const currency = items[0]?.currency || 'CLP';
      const itemsTable = `
        <div class="bg-white dark:bg-gray-700 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600">
          <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-600 flex justify-between items-center">
            <h4 class="text-sm font-medium text-gray-900 dark:text-gray-100">
              Items de Orden ${orderOc}
            </h4>
            <button class="close-expansion-btn text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition" data-order-pc="${orderPc}">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
              <thead class="bg-gray-50 dark:bg-gray-600">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Código</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Nombre</th>
                  <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Tipo</th>
                  <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Mercado</th>
                  <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">KG Solicitados</th>
                  <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">KG Despachados</th>
                  <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">KG Facturados</th>
                  <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Precio Unitario</th>
                  <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Total</th>
                </tr>
              </thead>
              <tbody class="bg-white dark:bg-gray-700 divide-y divide-gray-200 dark:divide-gray-600">
                ${items.map(item => {
                  const quantity = parseFloat(item.kg_solicitados) || 0;
                  const unitPrice = parseFloat(item.unit_price) || 0;
                  const total = quantity * unitPrice;
                  
                  return `
                    <tr class="hover:bg-gray-50 dark:hover:bg-gray-600 transition">
                      <td class="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">${item.item_code || 'N/A'}</td>
                      <td class="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">${item.item_name || 'N/A'}</td>
                      <td class="px-4 py-3 text-sm text-center text-gray-900 dark:text-gray-100">${item.tipo || 'N/A'}</td>
                      <td class="px-4 py-3 text-sm text-center text-gray-900 dark:text-gray-100">${item.mercado || 'N/A'}</td>
                      <td class="px-4 py-3 text-sm text-center text-gray-900 dark:text-gray-100">${formatQuantity(quantity, 'KG')}</td>
                      <td class="px-4 py-3 text-sm text-center text-gray-900 dark:text-gray-100">${formatQuantity(parseFloat(item.kg_despachados) || 0, 'KG')}</td>
                      <td class="px-4 py-3 text-sm text-center text-gray-900 dark:text-gray-100">${formatQuantity(parseFloat(item.kg_facturados) || 0, 'KG')}</td>
                      <td class="px-4 py-3 text-sm text-center text-gray-900 dark:text-gray-100">${formatUnitPrice(unitPrice)}</td>
                      <td class="px-4 py-3 text-sm text-center font-semibold text-gray-900 dark:text-gray-100">${formatTotal(total)}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
      
      expandedCell.innerHTML = itemsTable;
      expandedRow.appendChild(expandedCell);
      
      // Insertar después de la fila actual
      row.parentNode.insertBefore(expandedRow, row.nextSibling);
      
      // Cambiar icono a flecha hacia arriba
      expandBtn.querySelector('svg').innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7"/>';
      
    } catch (error) {
      console.error('Error cargando items para expansión:', error);
    }
  }

  // Función para cerrar expansión desde el botón X
  function closeItemsExpansion(orderPc) {
    // Buscar la fila expandida
    const expandedRow = document.querySelector('.expanded-items-row');
    if (expandedRow) {
      // Encontrar la fila anterior (la que tiene el botón)
      const originalRow = expandedRow.previousElementSibling;
      if (originalRow) {
        const expandBtn = originalRow.querySelector('.expand-items-btn');
        if (expandBtn) {
          // Cambiar icono a flecha hacia abajo
          expandBtn.querySelector('svg').innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>';
        }
      }
      // Remover la fila expandida
      expandedRow.remove();
    }
  }

  // Función helper para formatear cantidad
  function formatQuantity(quantity, unit) {
    if (quantity === 0 || isNaN(quantity)) return '0';
    return `${quantity.toLocaleString('es-ES')} ${unit}`;
  }

  // Función helper para formatear precio unitario
  function formatUnitPrice(price) {
    if (price === 0 || isNaN(price)) return '$0';
    return `$${price.toLocaleString('es-ES')}`;
  }

  // Función helper para formatear total
  function formatTotal(total) {
    if (total === 0 || isNaN(total)) return '$0';
    return `$${total.toLocaleString('es-ES')}`;
  }

  /**
   * Event listener para los botones "Detalles de la Orden"
   */
  document.addEventListener('click', (e) => {
    const orderDetailBtn = e.target.closest('.order-detail-btn');
    if (orderDetailBtn) {
      e.preventDefault();
      
      const orderId = orderDetailBtn.dataset.orderId;
      const row = orderDetailBtn.closest('tr');
      if (row) {
        const pc = row.cells[0]?.textContent?.trim() || ''; // PC
        const oc = row.cells[1]?.textContent?.trim() || ''; // OC
        
        loadOrderDetail(orderId, pc, oc);
      }
    }
  });


  /**
   * Event listeners para botones de cerrar expansión
   */
  document.addEventListener('click', (e) => {
    const closeBtn = e.target.closest('.close-expansion-btn');
    if (closeBtn) {
      e.preventDefault();
      const orderPc = closeBtn.dataset.orderPc;
      closeItemsExpansion(orderPc);
    }
  });

  // Función para abrir el modal de detalles de orden
  async function openOrderDetailModal(orderId, orderOc) {
    const orderDetailModal = document.getElementById('orderDetailModal');
    const orderDetailTitle = document.getElementById('orderDetailTitle');
    const orderDetailPc = document.getElementById('orderDetailPc');
    const orderDetailOc = document.getElementById('orderDetailOc');
    const orderDetailFechaEtd = document.getElementById('orderDetailFechaEtd');
    const orderDetailFechaEta = document.getElementById('orderDetailFechaEta');
    const orderDetailIncoterm = document.getElementById('orderDetailIncoterm');
    const orderDetailCertificados = document.getElementById('orderDetailCertificados');
    const orderDetailDireccionDestino = document.getElementById('orderDetailDireccionDestino');
    const orderDetailPuertoDestino = document.getElementById('orderDetailPuertoDestino');

    if (!orderDetailModal || !orderDetailTitle) return;

    // Actualizar título
    orderDetailTitle.textContent = `PC ${orderOc} - Detalles`;

    try {
      // Cargar detalles de la orden
      const token = localStorage.getItem('token');
      const apiBase = window.apiBase;
      const response = await fetch(`${apiBase}/api/orders/${orderId}/detail`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const orderDetail = await response.json();
  
      // Función para formatear fechas
      function formatDateToDDMMYYYY(dateString) {
        if (!dateString) return '-';
        try {
          const date = new Date(dateString);
          if (isNaN(date.getTime())) return '-';
          return date.toLocaleDateString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
          });
        } catch (error) {
          return '-';
        }
      }

      // Actualizar campos del modal
      orderDetailPc.textContent = orderDetail.pc || '-';
      orderDetailOc.textContent = orderDetail.oc || '-';
      orderDetailFechaEtd.textContent = formatDateToDDMMYYYY(orderDetail.fecha_etd);
      orderDetailFechaEta.textContent = formatDateToDDMMYYYY(orderDetail.fecha_eta);
      orderDetailIncoterm.textContent = orderDetail.incoterm || '-';
      orderDetailCertificados.textContent = orderDetail.certificados || '-';
      orderDetailDireccionDestino.textContent = orderDetail.direccion_destino || '-';
      orderDetailPuertoDestino.textContent = orderDetail.puerto_destino || '-';

      // Mostrar modal
      orderDetailModal.classList.remove('hidden');

    } catch (error) {
      console.error('Error cargando detalles de orden:', error);
      
      // Mostrar valores por defecto en caso de error
      orderDetailPc.textContent = '-';
      orderDetailOc.textContent = '-';
      orderDetailFechaEtd.textContent = '-';
      orderDetailFechaEta.textContent = '-';
      orderDetailIncoterm.textContent = '-';
      orderDetailCertificados.textContent = '-';
      orderDetailDireccionDestino.textContent = '-';
      orderDetailPuertoDestino.textContent = '-';

      orderDetailModal.classList.remove('hidden');
    }
  }

  /**
   * Event listeners para botones de detalles de orden
   */
  document.addEventListener('click', (e) => {
    const orderDetailBtn = e.target.closest('.order-detail-btn');
    if (orderDetailBtn) {
      e.preventDefault();
      
      const orderId = orderDetailBtn.dataset.orderId;
      const row = orderDetailBtn.closest('tr');
      if (row) {
        const pc = row.cells[0]?.textContent?.trim() || ''; // PC
        const oc = row.cells[1]?.textContent?.trim() || ''; // OC
        
        openOrderDetailModal(orderId, oc);
      }
    }
  });

  // Cargar los datos iniciales
  refreshFolders();

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

    // Event listeners para botones de expansión de items
    document.addEventListener('click', (e) => {
      const expandBtn = e.target.closest('.expand-items-btn');
      if (expandBtn) {
        e.preventDefault();
        const orderPc = expandBtn.dataset.orderPc;
        const orderOc = expandBtn.dataset.orderOc;
        const factura = expandBtn.dataset.factura;
        toggleItemsExpansion(orderPc, orderOc, factura);
      }
    });

    // Event listeners para botones de detalles de orden
    document.addEventListener('click', (e) => {
      const detailBtn = e.target.closest('.order-detail-btn');
      if (detailBtn) {
        e.preventDefault();
        const orderId = detailBtn.dataset.orderId;
        const orderOc = detailBtn.dataset.orderOc;
        openOrderDetailModal(orderId, orderOc);
      }
    });
  }
} 
