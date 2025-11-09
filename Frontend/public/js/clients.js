// public/js/clients.js
import { 
  qs, 
  showNotification, 
  confirmAction, 
  showSuccess, 
  showError,
  isValidEmail
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

function getClientSectionContext() {
  const section = document.getElementById('clientSection');
  const basePath = section?.dataset?.basePath || '/admin';
  const foldersPath = section?.dataset?.foldersPath || `${basePath}/clients/folders/view`;
  const datasetApiBase = section?.dataset?.apiBase;
  const apiBase = datasetApiBase || window.apiBase || '';

  return { section, basePath, foldersPath, apiBase };
}

// Funciones de modal que no están en utils.js
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

// ===== SISTEMA DE CACHÉ =====
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos en milisegundos
const CACHE_KEY = 'customers_cache';
const CACHE_TIMESTAMP_KEY = 'customers_cache_timestamp';

function isCacheValid() {
  const timestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY);
  if (!timestamp) return false;
  return Date.now() - parseInt(timestamp) < CACHE_DURATION;
}

function saveToCache(data) {
  localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  localStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString());
}

function loadFromCache() {
  const cached = localStorage.getItem(CACHE_KEY);
  return cached ? JSON.parse(cached) : null;
}

function clearCache() {
  localStorage.removeItem(CACHE_KEY);
  localStorage.removeItem(CACHE_TIMESTAMP_KEY);
}

export async function loadCustomersWithCache() {
  try {
    if (isCacheValid()) {
      const cachedData = loadFromCache();
      if (cachedData) {
        return cachedData;
      }
    }
    const token = localStorage.getItem('token');
    const { apiBase } = getClientSectionContext();
    const resolvedApiBase = apiBase || window.apiBase;
    const response = await fetch(`${resolvedApiBase}/api/customers`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) {
      throw await buildErrorFromResponse(response);
    }
    const customers = await response.json();
    saveToCache(customers);
    return customers;
  } catch (error) {
    console.error('Error cargando clientes:', error);
    const cachedData = loadFromCache();
    if (cachedData) {
      return cachedData;
    }
    throw error;
  }
}

export async function forceReloadCustomers() {
  clearCache();
  return await loadCustomersWithCache();
}

export function getCacheInfo() {
  const timestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY);
  const age = timestamp ? Date.now() - parseInt(timestamp) : null;
  return {
    exists: !!localStorage.getItem(CACHE_KEY),
    age: age,
    isValid: isCacheValid()
  };
}

// ===== FUNCIONES PRINCIPALES =====

export async function initClientsScript() {
  const { basePath, foldersPath, apiBase: datasetApiBase } = getClientSectionContext();
  const resolvedApiBase = window.apiBase || datasetApiBase || '';
  
  // Usar traducciones ya cargadas por Astro
  const translations = window.translations || {};
  const messages = translations.messages || {};
  const clientes = translations.clientes || {};
  const messagesClients = messages.clients || {};
  const backendMessages = messagesClients.backend || {};
  const formMessages = messagesClients.form || {};
  const profileTexts = clientes.profile || {};
  const contactsModalTexts = clientes.contactsModal || {};
  const contactsPlaceholders = contactsModalTexts.placeholders || {};
  const changePasswordTexts = clientes.changePassword || {};
  const clientesForm = clientes.form || {};

  const formatMessage = (template, params = {}) => {
    if (typeof template !== 'string') return '';
    return Object.keys(params).reduce((acc, key) => {
      const value = params[key];
      return acc.replace(new RegExp(`{${key}}`, 'g'), value != null ? value : '');
    }, template);
  };

  const resolveBackendMessage = (code, fallback) => {
    if (code && backendMessages[code]) {
      return backendMessages[code];
    }
    return fallback;
  };

  const getMessage = (value, fallback) => (typeof value === 'string' && value.length > 0 ? value : fallback);
  
  // Verificar que todos los elementos necesarios existan
  const searchInput = qs('searchInput');
  const itemsPerPageSelect = qs('itemsPerPageSelect');
  const prevPageBtn = qs('prevPageBtn');
  const nextPageBtn = qs('nextPageBtn');
  const pageIndicator = qs('pageIndicator');
  const tableBody = qs('customersTableBody');
  const exportBtn = qs('exportExcelBtn');
  const filterWithOrders = qs('filterWithOrders');
  
  // Verificar que los elementos críticos existan
  if (!tableBody || !searchInput || !itemsPerPageSelect || !prevPageBtn || !nextPageBtn || !pageIndicator) {
    console.error('Elementos necesarios no encontrados para el paginador');
    return;
  }

  // Variables de estado
  let allCustomers = [];
  let filteredCustomers = [];
  let currentPage = 1;
  let itemsPerPage = parseInt(itemsPerPageSelect.value, 10);
  let currentSort = { column: null, direction: 'asc' };

  // Función para renderizar una fila de cliente
  function renderCustomerRow(customer) {
    const encodedName = encodeURIComponent(customer.name || '');
    const { foldersPath } = getClientSectionContext();
    const folderUrl = `${foldersPath}/${customer.uuid}?c=${encodedName}`;
    return `
      <tr data-id="${customer.id}" class="hover:shadow-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition bg-white dark:bg-gray-900">
        <td class="px-6 py-4 items-center gap-3 border-b border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">${customer.name || '-'}</td>
        <td class="px-6 py-4 items-center gap-3 border-b border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">${customer.rut || '-'}</td>
        <td class="px-6 py-4 items-center gap-3 border-b border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">${customer.email || '-'}</td>
        <td class="px-6 py-4 items-center gap-3 border-b border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">${customer.phone || '-'}</td>
        <td class="px-6 py-4 items-center gap-3 border-b border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">${customer.country || '-'}</td>
        <td class="px-6 py-4 items-center gap-3 border-b border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">${customer.city || '-'}</td>
        <td class="px-6 py-4 text-center gap-3 border-b border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">${customer.order_count || 0}</td>
        <td class="sticky right-0 bg-gray-50 dark:bg-gray-700 z-10 px-6 py-4 min-w-[120px] overflow-visible border-b border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">
          <div class="flex justify-center gap-3 relative">
            <div class="relative">
              <a id="orderViewBtn" href="${folderUrl}" class="orederView text-gray-900 dark:text-white hover:text-green-500 transition"
                 data-tooltip="${window.translations?.clientes?.view_orders || 'View orders'}"
                 aria-label="${window.translations?.clientes?.view_orders || 'View orders'}">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              </a>
            </div>
            <div class="relative">
              <a id="contactsViewBtn" href="#" data-uuid="${customer.uuid}" data-name="${customer.name}" class="contactsView text-gray-900 dark:text-white hover:text-green-500 transition manage-contacts-btn"
                 data-tooltip="${window.translations?.clientes?.manage_contacts || 'Manage contacts'}"
                 aria-label="${window.translations?.clientes?.manage_contacts || 'Manage contacts'}">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
              </a>
            </div>
            <div class="relative">
              <a id="changePasswordViewBtn" href="#" data-uuid="${customer.uuid}" data-name="${customer.name}" class="changePasswordView text-gray-900 dark:text-white hover:text-green-500 transition change-password-btn"
                 data-tooltip="${window.translations?.clientes?.change_password || 'Change password'}"
                 aria-label="${window.translations?.clientes?.change_password || 'Change password'}">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
              </a>
            </div>
          </div>
        </td>
      </tr>
    `;
  }

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
        zIndex: '9999',
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

  // Función para cargar y renderizar clientes
  async function loadAndRenderCustomers() {
    try {
      // Cargar datos usando el caché
      allCustomers = await loadCustomersWithCache();
      
      // Aplicar filtros si están activos
      filterCustomers();
      
      // Remover la fila de carga
      const loadingRow = document.getElementById('loadingRow');
      if (loadingRow) {
        loadingRow.remove();
      }
      
      // Renderizar la tabla
      renderTable();
      
    } catch (error) {
      console.error('Error cargando clientes:', error);
      
      // Mostrar mensaje de error
      const loadingRow = document.getElementById('loadingRow');
      if (loadingRow) {
        const errorMessage = resolveBackendMessage(error.code, getMessage(messagesClients.loadError, 'Error loading customers.'));
        loadingRow.innerHTML = `
          <td colspan="8" class="px-6 py-8 text-center text-red-500">
            ${errorMessage} <button onclick="location.reload()" class="text-blue-500 hover:underline">${getMessage(clientes.retry, 'Retry')}</button>
          </td>
        `;
      }
    }
  }

  // Función para refrescar datos
  async function refreshData() {
    try {
      // Limpiar cache y recargar datos
      clearCache();
      allCustomers = await loadCustomersWithCache();
      
      // Aplicar filtros si están activos
      filterCustomers();
      
      // Re-renderizar la tabla
      renderTable();
      
      // Mostrar notificación de éxito
      showNotification(getMessage(messagesClients.dataRefreshed, 'Data refreshed automatically'), 'success');
      
    } catch (error) {
      console.error('Error refrescando datos:', error);
      showNotification(resolveBackendMessage(error.code, getMessage(messagesClients.refreshError, 'Error refreshing data')), 'error');
    }
  }

  // Auto-refresh cuando el caché expire
  function setupAutoRefresh() {
    const checkCacheExpiry = () => {
      if (!isCacheValid()) {
        refreshData();
      }
    };

    // Verificar cada minuto si el caché ha expirado
    setInterval(checkCacheExpiry, 60 * 1000);
  }

  /**
   * Función principal de render de la tabla según búsqueda y paginación.
   * Renderiza las filas correspondientes a la página actual.
   */
  function renderTable() {
    const start = (currentPage - 1) * itemsPerPage;
    const pageData = filteredCustomers.slice(start, start + itemsPerPage);
    
    // Limpiar tabla
    hideFloatingTooltip();
    tableBody.innerHTML = '';
    
    // Renderizar filas de la página actual
    pageData.forEach(customer => {
      const rowHtml = renderCustomerRow(customer);
      tableBody.insertAdjacentHTML('beforeend', rowHtml);
    });
    
    // Si no hay datos, mostrar mensaje
    if (pageData.length === 0) {
      tableBody.innerHTML = `
        <tr class="bg-white dark:bg-gray-900">
          <td colspan="8" class="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
            ${getMessage(clientes.noResults, 'No customers found')}
          </td>
        </tr>
      `;
    }

    const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);
    const pageLabel = getMessage(clientes.pageIndicator, 'Page');
    const ofLabel = getMessage(clientes.pageIndicatorSeparator, 'of');
    pageIndicator.textContent = `${pageLabel} ${currentPage} ${ofLabel} ${totalPages}`;

    setupFloatingTooltips(tableBody);
  }

  /**
   * Buscador dinámico: filtra los clientes según el texto ingresado.
   */
  function filterCustomers() {
    const query = searchInput.value.toLowerCase();
    const onlyWithOrders = filterWithOrders ? filterWithOrders.checked : false;
    
    filteredCustomers = allCustomers.filter(customer => {
      // Filtro por búsqueda de texto en múltiples campos
      const searchableText = [
        customer.name || '',
        customer.rut || '',
        customer.email || '',
        customer.phone || '',
        customer.country || '',
        customer.city || ''
      ].join(' ').toLowerCase();
      
      const matchesSearch = searchableText.includes(query);
      
      // Filtro por clientes con órdenes
      const hasOrders = onlyWithOrders ? (customer.order_count && customer.order_count > 0) : true;
      
      return matchesSearch && hasOrders;
    });
    
    // Aplicar ordenamiento actual si existe
    if (currentSort.column) {
      sortCustomers(currentSort.column, currentSort.direction);
    }
    
    currentPage = 1;
    renderTable();
  }

  /**
   * Función para ordenar los clientes
   */
  function sortCustomers(column, direction) {
    if (!column) return;

    const numericColumns = new Set(['order_count']);
    const localeCompareOptions = { numeric: true, sensitivity: 'base' };
    const multiplier = direction === 'desc' ? -1 : 1;

    const getComparableValue = (customer) => {
      switch (column) {
        case 'name':
          return customer.name ?? '';
        case 'rut':
          return customer.rut ?? '';
        case 'email':
          return customer.email ?? '';
        case 'phone':
          return customer.phone ?? '';
        case 'country':
          return customer.country ?? '';
        case 'city':
          return customer.city ?? '';
        case 'order_count':
          return customer.order_count ?? 0;
        default:
          return '';
      }
    };

    filteredCustomers.sort((aCustomer, bCustomer) => {
      const rawA = getComparableValue(aCustomer);
      const rawB = getComparableValue(bCustomer);

      if (numericColumns.has(column)) {
        const numA = Number(rawA) || 0;
        const numB = Number(rawB) || 0;

        if (numA === numB) return 0;
        return (numA - numB) * multiplier;
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
  }

  /**
   * Función para actualizar los iconos de ordenamiento
   */
  function updateSortIcons(activeColumn, direction) {
    // Remover todos los iconos activos
    document.querySelectorAll('th[data-sort] .sort-icon').forEach(icon => {
      icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" d="M8 9l4-4 4 4m0 6l-4 4-4-4" />';
    });
    
    // Agregar icono activo a la columna actual
    const activeHeader = document.querySelector(`th[data-sort="${activeColumn}"] .sort-icon`);
    if (activeHeader) {
      if (direction === 'asc') {
        // Flecha hacia arriba (ascendente)
        activeHeader.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7" />';
      } else {
        // Flecha hacia abajo (descendente)
        activeHeader.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />';
      }
    }
  }

  /**
   * Función para exportar tabla a Excel
   */
  function exportToExcel() {
    // Obtener los clientes filtrados actuales
    const customersToExport = filteredCustomers.length > 0 ? filteredCustomers : allCustomers;
    
    if (customersToExport.length === 0) {
      showNotification(getMessage(messagesClients.noCustomersToExport, 'No customers available to export'), 'warning');
      return;
    }

    // Definir los encabezados de las columnas
    const headers = [
      getMessage(clientes.name, 'Name'),
      getMessage(clientes.rut, 'RUT'),
      getMessage(clientes.email, 'Email'),
      getMessage(clientes.phone, 'Phone'),
      getMessage(clientes.country, 'Country'),
      getMessage(clientes.city, 'City'),
      getMessage(clientes.directory, 'Orders')
    ];

    // Preparar los datos para exportar
    const data = customersToExport.map(customer => [
      customer.name || '',
      customer.rut || '',
      customer.email || '',
      customer.phone || '',
      customer.country || '',
      customer.city || '',
      customer.order_count || 0
    ]);

    // Crear el contenido con formato Excel compatible
    // Agregar BOM UTF-8 para que Excel reconozca la codificación
    const BOM = '\uFEFF';
    
    // Usar punto y coma como separador (más compatible con Excel)
    const csvContent = BOM + [
      headers.join(';'),
      ...data.map(row => row.map(cell => {
        // Escapar comillas dobles y envolver en comillas si contiene punto y coma
        const escapedCell = cell.toString().replace(/"/g, '""');
        return cell.toString().includes(';') ? `"${escapedCell}"` : escapedCell;
      }).join(';'))
    ].join('\r\n');

    // Crear el blob con tipo MIME específico para Excel
    const blob = new Blob([csvContent], { 
      type: 'text/csv;charset=utf-8;header=present'
    });

    // Crear URL y descargar
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `clientes_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    // Mostrar notificación de éxito
    const exportMessage = formatMessage(
      messagesClients.exportSuccess,
      { count: customersToExport.length }
    ) || `Exported ${customersToExport.length} customers to Excel`;
    showSuccess(exportMessage);
  }

  // Event listeners para paginación
  itemsPerPageSelect.addEventListener('change', () => {
    itemsPerPage = parseInt(itemsPerPageSelect.value, 10);
    currentPage = 1;
    renderTable();
  });

  prevPageBtn.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      renderTable();
    }
  });

  nextPageBtn.addEventListener('click', () => {
    const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);
    if (currentPage < totalPages) {
      currentPage++;
      renderTable();
    }
  });

  // Event listener para el botón de exportar
  if (exportBtn) {
    exportBtn.addEventListener('click', exportToExcel);
  }

  // Event listener para búsqueda
  searchInput.addEventListener('input', filterCustomers);

  // Event listener para filtro de órdenes
  if (filterWithOrders) {
    filterWithOrders.addEventListener('change', filterCustomers);
  }

  // Event listeners para ordenamiento
  document.querySelectorAll('[data-sort]').forEach(header => {
    header.addEventListener('click', () => {
      const column = header.dataset.sort;
      const direction = currentSort.column === column && currentSort.direction === 'asc' ? 'desc' : 'asc';
      
      currentSort = { column, direction };
      sortCustomers(column, direction);
      updateSortIcons(column, direction);
      renderTable();
    });
  });

  // ===== EVENT LISTENERS PARA MODALES =====
  
  // Event listener para el botón "Ver" (modal de perfil)
  document.addEventListener('click', async (e) => {
    const viewBtn = e.target.closest('a[data-uuid]:not(.manage-contacts-btn):not(.change-password-btn)');
    if (!viewBtn || !viewBtn.dataset.uuid) return;
    
    e.preventDefault();
    const customerUuid = viewBtn.dataset.uuid;
    
    try {
      // Buscar el cliente en los datos cargados
      const customer = allCustomers.find(c => c.uuid === customerUuid);
      if (!customer) {
        showError(getMessage(messagesClients.clientNotFound, 'Customer not found'));
        return;
      }
      
      // Llenar el modal de perfil con los datos del cliente
      openProfileModal(customer);
      
    } catch (error) {
      console.error('Error abriendo modal de perfil:', error);
      showError(getMessage(messagesClients.loadError, 'Error loading customers.'));
    }
  });

  // Event listener para el botón "Gestionar contactos"
  document.addEventListener('click', async (e) => {
    const contactsBtn = e.target.closest('.manage-contacts-btn');
    if (!contactsBtn || !contactsBtn.dataset.uuid) return;
    
    e.preventDefault();
    const customerUuid = contactsBtn.dataset.uuid;
    const customerName = contactsBtn.dataset.name;
    
    try {
      // Buscar el cliente en los datos cargados
      const customer = allCustomers.find(c => c.uuid === customerUuid);
      if (!customer) {
        showError(getMessage(messagesClients.clientNotFound, 'Customer not found'));
        return;
      }
      
      // Abrir modal de contactos
      openContactsModal(customer);
      
    } catch (error) {
      console.error('Error abriendo modal de contactos:', error);
      showError(getMessage(messagesClients.contactsLoadError, 'Error loading customer contacts'));
    }
  });

  // ===== FUNCIONES DE MODALES =====
  

  function openContactsModal(customer) {
    // Llenar datos del modal de contactos
    const initials = customer.name ? customer.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'CL';
    
    document.getElementById('contactsInitials').textContent = initials;
    document.getElementById('contactsClientName').textContent = customer.name || getMessage(profileTexts.noName, 'No name');
    
    // Guardar UUID del cliente actual
    currentCustomerUuid = customer.uuid;
    
    // Limpiar formulario de contactos
    clearContactsForm();
    
    // Cargar contactos existentes
    loadExistingContacts(customer.uuid);

    updateAddContactButtonState();
    showModal('#contactsModal');
  }

  function updateAddContactButtonState() {
    const addBtn = document.getElementById('addContactBtn');
    const container = document.getElementById('contactsFormContainer');
    if (!addBtn) return;

    const hasRows = container ? container.querySelector('#contactsFormTableBody tr') : null;
    addBtn.disabled = !hasRows;
    addBtn.classList.toggle('opacity-50', !hasRows);
    addBtn.classList.toggle('cursor-not-allowed', !hasRows);
  }

  function ensureContactsFormTable() {
    const container = document.getElementById('contactsFormContainer');
    if (!container) return null;

    let tableBody = container.querySelector('#contactsFormTableBody');
    if (!tableBody) {
      const template = document.getElementById('contactsFormTableTemplate');
      if (!template) return null;
      const fragment = document.importNode(template.content, true);
      container.appendChild(fragment);
      tableBody = container.querySelector('#contactsFormTableBody');
    }
    return tableBody;
  }

  function addContactRow() {
    const tableBody = ensureContactsFormTable();
    if (!tableBody) return;

    const rowId = `contact-row-${Date.now()}`;
    const row = document.createElement('tr');
    row.id = rowId;
    row.className = 'border-t border-gray-200 dark:border-gray-600';
    row.innerHTML = `
      <td class="p-2">
        <input type="text" class="text-xs contact-name w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="${getMessage(contactsPlaceholders.name, 'Contact name')}">
      </td>
      <td class="p-2">
        <input type="email" class="text-xs contact-email w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="${getMessage(contactsPlaceholders.email, 'email@example.com')}">
      </td>
      <td class="p-2">
        <input type="tel" class="text-xs contact-phone w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="${getMessage(contactsPlaceholders.phone, '+1 555 123 4567')}">
      </td>
      <td class="p-2 text-center">
        <input type="checkbox" class="contact-sh-documents w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500">
      </td>
      <td class="p-2 text-center">
        <input type="checkbox" class="contact-reports w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500">
      </td>
      <td class="p-2 text-center">
        <button type="button" class="p-2 text-red-600 hover:text-red-500 dark:text-red-400 dark:hover:text-red-300 remove-contact-row" data-row-id="${rowId}">
          <svg class="w-5 h-5 inline-block" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </td>
    `;

    tableBody.appendChild(row);
    updateAddContactButtonState();
  }

  // Event listener para remover filas de contacto
  document.addEventListener('click', (e) => {
    const removeBtn = e.target.closest('.remove-contact-row');
    if (removeBtn) {
      e.preventDefault();
      e.stopPropagation();
      const rowId = removeBtn.dataset.rowId;
      let row = rowId ? document.getElementById(rowId) : null;
      if (!row) {
        row = removeBtn.closest('tr');
      }
      if (row) {
        const tableBody = row.parentElement;
        row.remove();
        if (tableBody && !tableBody.querySelector('tr')) {
          const table = tableBody.closest('table');
          table?.remove();
        }
        updateAddContactButtonState();
      }
      return;
    }
  });

  function clearContactsForm() {
    const container = document.getElementById('contactsFormContainer');
    if (container) {
      container.innerHTML = '';
    }
    updateAddContactButtonState();
  }

  async function loadExistingContacts(customerUuid) {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${resolvedApiBase}/api/customers/${customerUuid}/contacts`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        const contacts = await response.json();
        renderExistingContacts(contacts);
      } else {
        // Si no hay contactos o hay error, mostrar tabla vacía
        renderExistingContacts(null);
      }
    } catch (error) {
      console.error('Error cargando contactos:', error);
      renderExistingContacts(null);
    }
  }

  function renderExistingContacts(contactData) {
    const container = document.getElementById('existingContactsTable');
    if (!container) return;
    container.innerHTML = '';

    if (!contactData || (!contactData.primary_email && (!contactData.additional_contacts || contactData.additional_contacts.length === 0))) {
      container.innerHTML = `
        <div class="text-center py-8 text-xs text-gray-500 dark:text-gray-400">
          <svg class="w-6 h-6 mx-auto mb-4 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <p>${getMessage(contactsModalTexts.noContacts, 'No contacts registered')}</p>
        </div>
      `;
      return;
    }

    const tableTemplate = document.getElementById('contactsTableTemplate');
    const rowTemplate = document.getElementById('contactRowTemplate');
    if (!tableTemplate || !rowTemplate) return;

    const tableFragment = document.importNode(tableTemplate.content, true);
    const tableBody = tableFragment.querySelector('#contactsTableBody');

    const additionalContacts = contactData.additional_contacts || [];

    additionalContacts.forEach(contact => {
      const rowFragment = document.importNode(rowTemplate.content, true);
      rowFragment.querySelector('[data-field="name"]').textContent = contact.nombre || '-';
      rowFragment.querySelector('[data-field="email"]').textContent = contact.email || '-';
      rowFragment.querySelector('[data-field="phone"]').textContent = contact.telefono || '-';
      rowFragment.querySelector('[data-field="sh_documents"]').innerHTML = contact.sh_documents ? '<span class="text-green-600 dark:text-green-400">✓</span>' : '<span class="text-gray-400">-</span>';
      rowFragment.querySelector('[data-field="reports"]').innerHTML = contact.reports ? '<span class="text-green-600 dark:text-green-400">✓</span>' : '<span class="text-gray-400">-</span>';

      const editBtn = rowFragment.querySelector('.edit-contact-btn');
      const deleteBtn = rowFragment.querySelector('.delete-contact-btn');
      if (editBtn) {
        editBtn.dataset.contactEmail = contact.email || '';
        editBtn.dataset.contactName = contact.nombre || '';
        editBtn.dataset.contactPhone = contact.telefono || '';
        editBtn.dataset.contactSh = contact.sh_documents ? '1' : '0';
        editBtn.dataset.contactReports = contact.reports ? '1' : '0';
        editBtn.dataset.contactIdx = contact.idx;
      }
      if (deleteBtn) {
        deleteBtn.dataset.contactIdx = contact.idx;
      }

      tableBody?.appendChild(rowFragment);
    });

    container.appendChild(tableFragment);
  }

  document.addEventListener('click', (e) => {
    const editBtn = e.target.closest('.edit-contact-btn');
    if (!editBtn) return;

    e.preventDefault();
    const idx = editBtn.dataset.contactIdx;
    if (!idx) return;

    const row = editBtn.closest('tr');
    if (!row) return;

    const nameCell = row.querySelector('[data-field="name"]');
    const emailCell = row.querySelector('[data-field="email"]');
    const phoneCell = row.querySelector('[data-field="phone"]');
    const shCell = row.querySelector('[data-field="sh_documents"]');
    const reportsCell = row.querySelector('[data-field="reports"]');

    const name = editBtn.dataset.contactName || '';
    const email = editBtn.dataset.contactEmail || '';
    const phone = editBtn.dataset.contactPhone || '';
    const shDocuments = editBtn.dataset.contactSh === '1';
    const reports = editBtn.dataset.contactReports === '1';

    nameCell.innerHTML = `<input id="contactNameInput" type="text" class="text-xs contact-name w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" value="${name}">`;
    emailCell.innerHTML = `<input id="contactEmailInput" type="email" class="text-xs contact-email w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" value="${email}">`;
    phoneCell.innerHTML = `<input id="contactPhoneInput" type="tel" class="text-xs contact-phone w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" value="${phone}">`;
    shCell.innerHTML = `<input id="contactShDocumentsInput" type="checkbox" ${shDocuments ? 'checked' : ''} class="contact-edit-sh w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500">`;
    reportsCell.innerHTML = `<input id="contactReportsInput" type="checkbox" ${reports ? 'checked' : ''} class="contact-edit-reports w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500">`;

    editBtn.classList.add('hidden');
    const deleteBtn = row.querySelector('.delete-contact-btn');
    if (deleteBtn) deleteBtn.classList.add('hidden');

    const actionsCell = row.querySelector('td:last-child');
    const saveBtn = document.createElement('button');
    saveBtn.className = 'save-contact-btn text-gray-600 hover:text-green-600 transition'
    saveBtn.innerHTML = `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>`;
    saveBtn.dataset.contactIdx = idx;

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'cancel-edit-contact-btn text-gray-600 hover:text-gray-400 transition'
    cancelBtn.innerHTML = `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>`;
    cancelBtn.dataset.contactIdx = idx;

    actionsCell.querySelector('.flex')?.append(saveBtn, cancelBtn);
  });

  document.addEventListener('click', async (e) => {
    const saveBtn = e.target.closest('.save-contact-btn');
    if (!saveBtn) return;

    e.preventDefault();
    const idx = saveBtn.dataset.contactIdx;
    if (!idx) return;

    const row = saveBtn.closest('tr');
    if (!row) return;

    const nameInput = row.querySelector('input[type="text"]');
    const emailInput = row.querySelector('input[type="email"]');
    const phoneInput = row.querySelector('input[type="tel"]');
    const shCheckbox = row.querySelector('.contact-edit-sh');
    const reportsCheckbox = row.querySelector('.contact-edit-reports');

    const updates = {
      contact_idx: idx,
      nombre: nameInput?.value?.trim() || '',
      email: emailInput?.value?.trim() || '',
      telefono: phoneInput?.value?.trim() || '',
      sh_documents: shCheckbox?.checked || false,
      reports: reportsCheckbox?.checked || false,
    };

    if (!updates.nombre) {
      showError(getMessage(clientesForm.nameRequired, 'Name is required for all contacts'));
      return;
    }
    if (!updates.email) {
      showError(getMessage(clientesForm.emailRequired, 'Email is required for all contacts'));
      return;
    }
    if (!isValidEmail(updates.email)) {
      showError(getMessage(clientesForm.emailInvalid, 'Email must be valid'));
      return;
    }
    if (!updates.sh_documents && !updates.reports) {
      const confirmed = await confirmAction(
        getMessage(clientesForm.noPermissionsConfirmTitle, 'No access selected'),
        getMessage(clientesForm.noPermissionsConfirmMessage, 'You did not select SH Documents nor Reports. Do you want to continue anyway?'),
        'warning',
        {
          confirmButtonText: getMessage(clientesForm.noPermissionsConfirmContinue, 'Yes, continue'),
          cancelButtonText: getMessage(clientesForm.noPermissionsConfirmCancel, 'Cancel')
        }
      );
      if (!confirmed) {
        return;
      }
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${resolvedApiBase}/api/customers/contacts/${currentCustomerUuid}/${idx}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(updates)
      });

      if (response.ok) {
        showSuccess(getMessage(messagesClients.updateSuccess, 'Contact updated successfully'));
        loadExistingContacts(currentCustomerUuid);
      } else {
        const errorResponse = await buildErrorFromResponse(response);
        showError(resolveBackendMessage(errorResponse.code, getMessage(messagesClients.updateError, 'Error updating contact')));
      }
    } catch (error) {
      console.error('Error updating contact:', error);
      showError(resolveBackendMessage(error.code, getMessage(messagesClients.updateError, 'Error updating contact')));
    }
  });

  document.addEventListener('click', (e) => {
    const cancelBtn = e.target.closest('.cancel-edit-contact-btn');
    if (!cancelBtn) return;

    e.preventDefault();
    loadExistingContacts(currentCustomerUuid);
  });

  // ===== FUNCIONALIDAD DEL MODAL DE CONTACTOS =====
  
  let currentCustomerUuid = null;

  // Event listener para agregar fila de contacto
  document.addEventListener('click', (e) => {
    if (e.target.id === 'addContactRowBtn') {
      e.preventDefault();
      addContactRow();
    }
  });

  // Event listener para agregar contactos
  document.addEventListener('click', async (e) => {
    if (e.target.id === 'addContactBtn') {
      e.preventDefault();
      await saveContacts();
    }
  });

  // Event listener para cancelar agregar contactos
  document.addEventListener('click', (e) => {
    if (e.target.id === 'cancelAddContactBtn') {
      e.preventDefault();
      clearContactsForm();
      hideModal('#contactsModal');
    }
  });

  // Event listener para eliminar contactos existentes
  document.addEventListener('click', async (e) => {
    const deleteBtn = e.target.closest('.delete-contact-btn');
    if (!deleteBtn) return;

    e.preventDefault();
    const contactIdx = deleteBtn.dataset.contactIdx;
    await deleteContact(contactIdx);
  });

  async function saveContacts() {
    if (!currentCustomerUuid) {
      showError(getMessage(clientesForm.customerRequired, 'A customer must be selected'));
      return;
    }

    // Verificar si el cliente tiene email principal
    try {
      const response = await fetch(`${resolvedApiBase}/api/customers/${currentCustomerUuid}/contacts`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const contactData = await response.json();
        if (!contactData.primary_email) {
          showError(getMessage(clientesForm.primaryEmailRequired, 'You must set the main email before adding additional contacts'));
          return;
        }
      } else {
        const errorResponse = await buildErrorFromResponse(response);
        showError(resolveBackendMessage(errorResponse.code, getMessage(messagesClients.contactsLoadError, 'Error loading customer contacts')));
        return;
      }
    } catch (error) {
      console.error('Error verificando email principal:', error);
      showError(resolveBackendMessage(error.code, getMessage(messagesClients.contactsLoadError, 'Error loading customer contacts')));
      return;
    }

    const container = document.getElementById('contactsFormContainer');
    if (!container) return;

    const contactRows = container.querySelectorAll('[id^="contact-row-"]');
    const contacts = [];

    for (const row of contactRows) {
      const name = row.querySelector('.contact-name')?.value?.trim();
      const email = row.querySelector('.contact-email')?.value?.trim();
      const phone = row.querySelector('.contact-phone')?.value?.trim();
      const shDocuments = row.querySelector('.contact-sh-documents')?.checked || false;
      const reports = row.querySelector('.contact-reports')?.checked || false;

      const hasData = Boolean(name || email || phone || shDocuments || reports);

      if (hasData) {
        if (!name) {
          showError(getMessage(clientesForm.nameRequired, 'Name is required for all contacts'));
          return;
        }
        if (!email) {
          showError(getMessage(clientesForm.emailRequired, 'Email is required for all contacts'));
          return;
        }
        if (!isValidEmail(email)) {
          showError(getMessage(clientesForm.emailInvalid, 'Email must be valid'));
          return;
        }
        if (!shDocuments && !reports) {
          const confirmed = await confirmAction(
            getMessage(clientesForm.noPermissionsConfirmTitle, 'No access selected'),
            getMessage(clientesForm.noPermissionsConfirmMessage, 'You did not select SH Documents nor Reports. Do you want to continue anyway?'),
            'warning',
            {
              confirmButtonText: getMessage(clientesForm.noPermissionsConfirmContinue, 'Yes, continue'),
              cancelButtonText: getMessage(clientesForm.noPermissionsConfirmCancel, 'Cancel')
            }
          );
          if (!confirmed) {
            return;
          }
        }

        contacts.push({ name, email, phone, sh_documents: shDocuments, reports: reports });
      }
    }

    if (contacts.length === 0) {
      showError(getMessage(clientesForm.atLeastOneContact, 'Add at least one contact'));
      return;
    }

    try {
      const token = localStorage.getItem('token');

      const response = await fetch(`${resolvedApiBase}/api/customers/contacts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          customer_uuid: currentCustomerUuid,
          contacts: contacts
        })
      });

      if (response.ok) {
        const successMessage = formatMessage(messagesClients.contactsSaveSuccess, { count: contacts.length }) || `Added ${contacts.length} contact(s) successfully`;
        showSuccess(successMessage);
        clearContactsForm();
        loadExistingContacts(currentCustomerUuid);
      } else {
        const errorResponse = await buildErrorFromResponse(response);
        showError(resolveBackendMessage(errorResponse.code, getMessage(messagesClients.addContactError, 'Error adding contacts')));
      }
    } catch (error) {
      console.error('Error agregando contactos:', error);
      showError(resolveBackendMessage(error.code, getMessage(messagesClients.addContactError, 'Error adding contacts')));
    }
  }

  async function deleteContact(contactIdx) {
    const confirmed = await confirmAction(
      getMessage(messagesClients.deleteContactConfirm, 'Delete contact?'),
      getMessage(messagesClients.deleteContactMessage, 'This action cannot be undone.'),
      'warning'
    );

    if (!confirmed) return;

    try {
      const token = localStorage.getItem('token');

      const response = await fetch(`${resolvedApiBase}/api/customers/contacts/${currentCustomerUuid}/${contactIdx}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (response.ok) {
        showSuccess(getMessage(messagesClients.deleteContactSuccess, 'Contact deleted successfully'));
        loadExistingContacts(currentCustomerUuid);
      } else {
        const error = await buildErrorFromResponse(response);
        showError(resolveBackendMessage(error.code, getMessage(messagesClients.deleteContactError, 'Error deleting contact')));
      }
    } catch (error) {
      console.error('Error eliminando contacto:', error);
      showError(resolveBackendMessage(error.code, getMessage(messagesClients.deleteContactError, 'Error deleting contact')));
    }
  }

  // Actualizar la función openContactsModal para guardar el UUID del cliente
  function openContactsModal(customer) {
    // Llenar datos del modal de contactos
    const initials = customer.name ? customer.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'CL';
    
    document.getElementById('contactsInitials').textContent = initials;
    document.getElementById('contactsClientName').textContent = customer.name || getMessage(profileTexts.noName, 'No name');
    
    // Guardar UUID del cliente actual
    currentCustomerUuid = customer.uuid;
    
    // Limpiar formulario de contactos
    clearContactsForm();
    
    // Cargar contactos existentes
    loadExistingContacts(customer.uuid);
    
    // Mostrar modal
    showModal('#contactsModal');
  }

  // ===== FUNCIONALIDAD DEL MODAL DE PERFIL =====
  
  let currentCustomerForUpdate = null;

  // Event listener para actualizar cliente
  document.addEventListener('click', async (e) => {
    if (e.target.id === 'updateCustomerBtn') {
      e.preventDefault();
      await updateCustomer();
    }
  });

  // Event listener para ver órdenes
  document.addEventListener('click', (e) => {
    if (e.target.id === 'viewOrdersBtn') {
      e.preventDefault();
      viewCustomerOrders();
    }
  });

  async function updateCustomer() {
    if (!currentCustomerForUpdate) {
      showError(getMessage(clientesForm.customerRequired, 'A customer must be selected'));
      return;
    }

    const emailInput = document.getElementById('profileEmail');
    const newEmail = emailInput?.value?.trim();

    if (!newEmail) {
      showError(getMessage(clientes.emailEmpty, 'Email cannot be empty.'));
      return;
    }

    if (!isValidEmail(newEmail)) {
      showError(getMessage(clientesForm.emailInvalid, 'Email must be valid'));
      return;
    }

    const confirmed = await confirmAction(
      getMessage(messagesClients.updateConfirmTitle, 'Update customer?'),
      getMessage(messagesClients.updateConfirmMessage, 'The customer information will be updated.'),
      'question'
    );

    if (!confirmed) return;

    try {
      const token = localStorage.getItem('token');

      const response = await fetch(`${resolvedApiBase}/api/customers/${currentCustomerForUpdate.uuid}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          email: newEmail
        })
      });

      if (response.ok) {
        showSuccess(getMessage(messagesClients.updateSuccess, 'Customer updated successfully'));
        hideModal('#profileModal');
        // Recargar la lista de clientes para reflejar los cambios
        await forceReloadCustomers();
        await loadAndRenderCustomers();
      } else {
        const errorResponse = await buildErrorFromResponse(response);
        showError(resolveBackendMessage(errorResponse.code, getMessage(messagesClients.updateError, 'Error updating customer')));
      }
    } catch (error) {
      console.error('Error actualizando cliente:', error);
      showError(resolveBackendMessage(error.code, getMessage(messagesClients.updateError, 'Error updating customer')));
    }
  }

  function viewCustomerOrders() {
    if (!currentCustomerForUpdate) {
      showError(getMessage(clientesForm.customerRequired, 'A customer must be selected'));
      return;
    }

    // Redirigir a la página de órdenes del cliente
    const { foldersPath } = getClientSectionContext();
    window.location.href = `${foldersPath}/${currentCustomerForUpdate.uuid}?c=${encodeURIComponent(currentCustomerForUpdate.name || '')}`;
  }

  // Actualizar la función openProfileModal para guardar el cliente actual
  function openProfileModal(customer) {
    // Llenar datos del modal de perfil
    const initials = customer.name ? customer.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'CL';
    
    document.getElementById('profileInitials').textContent = initials;
    document.getElementById('profileClientName').textContent = customer.name || getMessage(profileTexts.noName, 'No name');
    document.getElementById('profileClientRut').textContent = customer.rut || getMessage(profileTexts.noRut, 'No tax ID');
    document.getElementById('profileCountry').textContent = customer.country || getMessage(profileTexts.noCountry, 'No country');
    document.getElementById('profileCity').textContent = customer.city || getMessage(profileTexts.noCity, 'No city');
    document.getElementById('profilePhone').textContent = customer.phone || getMessage(profileTexts.noPhone, 'No phone');
    document.getElementById('profileEmail').value = customer.email || '';
    document.getElementById('profileOrderCount').textContent = customer.order_count || 0;
    
    // Guardar cliente actual para actualización
    currentCustomerForUpdate = customer;
    
    // Mostrar modal
    showModal('#profileModal');
  }

  // ===== MODAL DE CAMBIO DE CONTRASEÑA =====
  
  let currentPasswordCustomerUuid = null;

  // Event listener para botones de cambio de contraseña
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.change-password-btn');
    if (!btn) return;
    
    e.preventDefault();
    e.stopPropagation(); // Evitar que se propague al event listener del botón "Ver"
    const customerUuid = btn.dataset.uuid;
    const customerName = btn.dataset.name;
    
    openChangePasswordModal(customerUuid, customerName);
  });

  function openChangePasswordModal(customerUuid, customerName) {
    currentPasswordCustomerUuid = customerUuid;
    document.getElementById('changePasswordCustomerName').textContent = customerName || getMessage(profileTexts.noName, 'No name');
    
    // Limpiar formulario
    document.getElementById('changePasswordForm').reset();
    
    // Mostrar modal
    showModal('#changePasswordModal');
  }

  // Event listener para guardar contraseña
  document.getElementById('savePasswordBtn').addEventListener('click', async () => {
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    // Validaciones
    if (!newPassword || !confirmPassword) {
      showNotification(getMessage(formMessages.completeFields, 'Please complete all fields'), 'error');
      return;
    }
    
    if (newPassword.length < 6) {
      showNotification(getMessage(formMessages.passwordMinLength, 'Password must be at least 6 characters long'), 'error');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      showNotification(getMessage(formMessages.passwordMismatch, 'Passwords do not match'), 'error');
      return;
    }
    
    // Mostrar loading
    const saveBtn = document.getElementById('savePasswordBtn');
    const originalText = saveBtn.innerHTML;
    const savingText = getMessage(changePasswordTexts.saving, 'Changing...');
    saveBtn.innerHTML = `<svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> ${savingText}`;
    saveBtn.disabled = true;
    
    try {
      const token = localStorage.getItem('token');

      const response = await fetch(`${resolvedApiBase}/api/customers/change-password/${currentPasswordCustomerUuid}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ password: newPassword })
      });
      
      if (response.ok) {
        showNotification(getMessage(messagesClients.passwordChangeSuccess, 'Password changed successfully'), 'success');
        hideModal('#changePasswordModal');
      } else {
        const errorResponse = await buildErrorFromResponse(response);
        showNotification(resolveBackendMessage(errorResponse.code, getMessage(messagesClients.passwordChangeError, 'Error changing password')), 'error');
      }
    } catch (error) {
      console.error('Error cambiando contraseña:', error);
      showNotification(resolveBackendMessage(error.code, getMessage(messagesClients.passwordChangeError, 'Error changing password')), 'error');
    } finally {
      // Restaurar botón
      const saveBtn = document.getElementById('savePasswordBtn');
      saveBtn.innerHTML = originalText;
      saveBtn.disabled = false;
    }
  });

  // ===== CONFIGURACIÓN DE MODALES =====
  
  // Configurar cierre de modales
  setupModalClose('#profileModal', '#closeProfileModalBtn');
  setupModalClose('#contactsModal', '#closeContactsModalBtn');
  setupModalClose('#changePasswordModal', '#closeChangePasswordModalBtn');
  setupModalClose('#changePasswordModal', '#cancelChangePasswordBtn');


  // Verificar si hay un filtro guardado desde orders.js
  const savedFilter = localStorage.getItem('clientSearchFilter');
  if (savedFilter && searchInput) {
    searchInput.value = savedFilter;
    // Limpiar el filtro del localStorage después de usarlo
    localStorage.removeItem('clientSearchFilter');
  }

  // Cargar y renderizar clientes inicialmente
  await loadAndRenderCustomers();
  
  // Inicializar auto-refresh
  setupAutoRefresh();
  
  // Aplicar filtro automáticamente si hay uno guardado
  if (savedFilter && searchInput.value) {
    filterCustomers();
  }

  updateAddContactButtonState();
} 
