// Importar funciones desde utils.js
import { showNotification as globalShowNotification, getValidToken } from './utils.js';

// =============================================================================
// DOCUMENT CENTER - LÓGICA PRINCIPAL
// =============================================================================

// ▸ Variables globales
let currentOrderId = null;
let documents = [];
let filteredDocuments = [];
let currentPage = 1;
const itemsPerPage = 1000; // Mostrar todas las tarjetas

// Variables globales para paginación de órdenes
let currentOrderPage = 1;
const ordersPerPage = 10;
let stickyScrollInitialized = false;

// Variables globales para búsqueda
let allOrders = [];
let filteredOrders = [];

const translations = window.translations || {};
const documentos = translations.documentos || {};
const carpetas = translations.carpetas || {};
const getMessage = (value) => (typeof value === 'string' ? value : '');

// ▸ Elementos del DOM
const ordersGrid = document.getElementById('orders-grid');
const docsModal = document.getElementById('docsModal');
const docsListBody = document.getElementById('docsListBody');
const docsOrderTitle = document.getElementById('docsOrderTitle');
const closeDocsModalBtn = document.getElementById('closeDocsModalBtn');

// Estado para tooltips flotantes (para evitar clipping)
const floatingTooltipState = {
  el: null,
  currentTarget: null,
  removeTimeout: null,
  globalHandlersBound: false
};

// ▸ Configuración de colores para estados
const statusColors = {
  'Unread': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  'Viewed': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  'Reviewed': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
};

function setupStickyHorizontalScrollbar() {
  if (stickyScrollInitialized) return;
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
      const theadClone = thead.cloneNode(true);
      headerTable.appendChild(theadClone);
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

  stickyScrollInitialized = true;
}

// =============================================================================
// FUNCIONES PRINCIPALES
// =============================================================================

/**
 * Inicializa la aplicación
 */
async function init() {
  try {
    // Mostrar loading state
    showLoadingState();

    // Usar órdenes del servidor si están disponibles, sino cargar desde API
    if (!window.orders || window.orders.length === 0) {
      await loadOrdersFromAPI();
    } else {
    }
    
    // Ocultar loading y mostrar contenido
    hideLoadingState();
    
    // Renderizar órdenes
    renderOrders();
    
    // Configurar event listeners
    setupEventListeners();
    
    // Seleccionar automáticamente la primera orden si existe
    if (window.orders && window.orders.length > 0) {
      selectOrder(window.orders[0].id);
    }
  } catch (error) {
    hideLoadingState();
    showErrorState(getMessage(documentos.ordersLoadError));
  }
}

/**
 * Muestra el estado de loading
 */
function showLoadingState() {
  const loadingState = document.getElementById('loading-state');
  const ordersSection = document.getElementById('orders-section');

  if (loadingState) loadingState.classList.add('hidden');
  if (ordersSection) ordersSection.classList.remove('hidden');
  showOrdersLoadingRow();
}

/**
 * Oculta el estado de loading
 */
function hideLoadingState() {
  const loadingState = document.getElementById('loading-state');
  const ordersSection = document.getElementById('orders-section');
  
  if (loadingState) loadingState.classList.add('hidden');
  if (ordersSection) ordersSection.classList.remove('hidden');
  hideOrdersLoadingRow();
}

/**
 * Muestra estado de error
 */
function showErrorState(message) {
  const loadingState = document.getElementById('loading-state');
  const ordersSection = document.getElementById('orders-section');
  if (ordersSection) ordersSection.classList.add('hidden');
  if (loadingState) {
    loadingState.classList.remove('hidden');
    loadingState.innerHTML = `
      <div class="inline-flex items-center justify-center w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full mb-4">
        <svg class="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">Error</h3>
      <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">${message}</p>
      <button onclick="location.reload()" class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
        Recargar página
      </button>
    `;
  }
}

function showOrdersLoadingRow() {
  if (!ordersGrid) return;
  const message = getMessage(documentos.loadingOrders);
  ordersGrid.innerHTML = `
    <tr id="loadingRow">
      <td colspan="9" class="px-6 py-6 text-center text-gray-600 dark:text-gray-300">
        <div class="inline-flex items-center gap-2">
          <svg class="w-4 h-4 text-blue-500 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span class="text-sm font-medium">${message}</span>
        </div>
      </td>
    </tr>
  `;
}

function hideOrdersLoadingRow() {
  const loadingRow = document.getElementById('loadingRow');
  if (loadingRow) loadingRow.remove();
}

function ensureFloatingTooltipElement() {
  if (!floatingTooltipState.el) {
    const tooltip = document.createElement('div');
    tooltip.setAttribute('role', 'tooltip');
    Object.assign(tooltip.style, {
      position: 'fixed',
      zIndex: '50',
      backgroundColor: '#1f2937',
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
    if (event.key === 'Escape') hideFloatingTooltip();
  }, true);
}

function positionFloatingTooltip(target, tooltipEl) {
  const rect = target.getBoundingClientRect();
  const tooltipRect = tooltipEl.getBoundingClientRect();
  const spacing = 10;

  let top = rect.top - tooltipRect.height - spacing;
  if (top < spacing) top = rect.bottom + spacing;

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

  if (!tooltipEl.isConnected) document.body.appendChild(tooltipEl);

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
    if (tooltipEl.parentElement) tooltipEl.parentElement.removeChild(tooltipEl);
    tooltipEl.style.visibility = 'hidden';
  }, 150);
}

function handleTooltipEnter(event) {
  showFloatingTooltip(event.currentTarget);
}

function handleTooltipLeave(event) {
  const target = event.currentTarget;
  if (floatingTooltipState.currentTarget === target) {
    if (event.type === 'mouseleave' && document.activeElement === target) return;
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

function resolveShippingMethod(order) {
  const facturaVal = order.factura;
  const hasFactura = facturaVal !== null && facturaVal !== undefined && facturaVal !== '' && facturaVal !== '0';
  const medioOv = order.medio_envio_ov;
  const medioFact = order.medio_envio_factura;
  const value = hasFactura ? (medioFact || medioOv) : (medioOv || medioFact);
  return value || '-';
}

/**
 * Carga órdenes desde la API
 */
async function loadOrdersFromAPI() {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      console.warn('loadOrdersFromAPI -> no token');
      throw new Error(getMessage(documentos.authRequired));
    }

    const response = await fetch(`${window.apiBase}/api/orders/client/dashboard`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('loadOrdersFromAPI -> status', response.status);
    if (!response.ok) {
      const text = await response.text();
      console.warn('loadOrdersFromAPI -> error body', text);
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('loadOrdersFromAPI -> data length', Array.isArray(data) ? data.length : 'not array');
    window.orders = data;

  } catch (error) {
    console.error('Error cargando órdenes desde API:', error);
    throw error;
  }
}



/**
 * Renderiza las órdenes en formato tabla con paginación
 */
function renderOrders() {
  if (!ordersGrid || !window.orders) return;
  
  // Guardar todas las órdenes en la primera carga
  if (allOrders.length === 0) {
    allOrders = [...window.orders];
    filteredOrders = [...window.orders];
  }
  
  ordersGrid.innerHTML = '';
  
  if (filteredOrders.length === 0) {
    ordersGrid.innerHTML = `
      <tr>
        <td colspan="9" class="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
          <div class="flex flex-col items-center">
            <svg class="w-12 h-12 mb-4 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
            <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">No orders found</h3>
            <p class="text-sm text-gray-500 dark:text-gray-400">No orders match your search criteria.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  const startIndex = (currentOrderPage - 1) * ordersPerPage;
  const endIndex = startIndex + ordersPerPage;
  const pageOrders = filteredOrders.slice(startIndex, endIndex);

  pageOrders.forEach(order => {
    const row = document.createElement('tr');
    row.className = 'hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors duration-200';
    row.dataset.orderId = order.id.toString();
    row.innerHTML = `
      <td class="px-6 py-4 text-xs text-gray-900 dark:text-gray-200">
        <div class="flex items-center">
          <div class="ml-3">
            <button class="view-docs-btn text-xs font-medium text-blue-600 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200 underline"
                    data-order-id="${order.id}"
                    data-tooltip="${getMessage(documentos.viewDocuments)}">
              ${order.orderNumber?.replace(/^GEL\s+/, '') || order.orderNumber}
            </button>
          </div>
        </div>
      </td>
      <td class="px-6 py-4 text-xs text-gray-900 dark:text-gray-200">
        <div class="flex items-center">
          <span class="text-xs text-gray-900 dark:text-gray-200">${order.documents ?? 0}</span>
        </div>
      </td>
      <td class="px-6 py-4 text-xs text-gray-900 dark:text-gray-200">
        <p class="text-xs text-gray-900 dark:text-gray-200">${formatDateOnly(order.fecha_incoterm)}</p>
      </td>
      <td class="px-6 py-4 text-xs text-gray-900 dark:text-gray-200">
        <p class="text-xs text-gray-900 dark:text-gray-200">${formatDateOnly(order.fecha_etd_factura)}</p>
      </td>
      <td class="px-6 py-4 text-xs text-gray-900 dark:text-gray-200">
        <p class="text-xs text-gray-900 dark:text-gray-200">${formatDateOnly(order.fecha_eta_factura)}</p>
      </td>
      <td class="px-6 py-4 text-xs text-gray-900 dark:text-gray-200">
        <p class="text-xs text-gray-900 dark:text-gray-200">${order.incoterm || '-'}</p>
      </td>
      <td class="px-6 py-4 text-xs text-gray-900 dark:text-gray-200">
        <p class="text-xs text-gray-900 dark:text-gray-200">${resolveShippingMethod(order)}</p>
      </td>
      <td class="px-6 py-4 text-xs text-gray-900 dark:text-gray-200">
        <p class="text-xs text-gray-900 dark:text-gray-200">${order.puerto_destino || '-'}</p>
      </td>
      <td class="px-6 py-4 text-center relative overflow-visible sticky right-0 bg-gray-50 dark:bg-gray-900 z-10 min-w-[120px]">
        <div class="flex items-center justify-center space-x-3">
          <button class="view-items-btn text-gray-900 dark:text-white hover:text-green-500 transition"
                 data-order-pc="${order.pc}" data-order-oc="${order.orderNumber}" data-factura="${order.factura}"
                 data-tooltip="${getMessage(carpetas.tooltipViewItems)}">
            <svg class="w-5 h-5 pointer-events-none" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path class="pointer-events-none" stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
          </button>
          <button class="view-docs-btn text-gray-900 dark:text-white hover:text-blue-500 transition"
                 data-order-id="${order.id}"
                 data-tooltip="${getMessage(carpetas.viewDocuments)}">
            <svg class="w-5 h-5 pointer-events-none" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path class="pointer-events-none" stroke-linecap="round" stroke-linejoin="round" d="M8 4h11a1 1 0 011 1v14a1 1 0 01-1 1H8l-4-4V5a1 1 0 011-1h3z"/>
              <path class="pointer-events-none" stroke-linecap="round" stroke-linejoin="round" d="M9 9h8M9 13h6M9 17h4"/>
            </svg>
          </button>
        </div>
      </td>
    `;
    row.addEventListener('click', () => selectOrder(order.id));
    ordersGrid.appendChild(row);
  });

  // Actualizar paginación
  updateOrdersPagination();
  // Activar tooltips flotantes en los botones de acción
  setupFloatingTooltips(ordersGrid);
  setupStickyHorizontalScrollbar();
}

/**
 * Selecciona una orden y muestra sus documentos
 */
async function selectOrder(orderId) {
  currentOrderId = orderId;
  
  // Resaltar orden seleccionada
  const orderCards = document.querySelectorAll('[data-order-id]');
  orderCards.forEach(card => {
    card.classList.remove('ring-2', 'ring-blue-500', 'border-blue-500');
  });
  
  const selectedCard = document.querySelector(`[data-order-id="${orderId}"]`);
  if (selectedCard) {
    selectedCard.classList.add('ring-2', 'ring-blue-500', 'border-blue-500');
  }
}

/**
 * Carga documentos de una orden desde la API
 */
async function loadOrderDocumentsFromAPI(orderId) {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      console.warn('loadOrderDocumentsFromAPI -> no token');
      throw new Error(getMessage(documentos.authRequired));
    }

    const response = await fetch(`${window.apiBase}/api/orders/client/${orderId}/documents`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const text = await response.text();
      console.warn('loadOrderDocumentsFromAPI -> error body', text);
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Convertir documentos al formato esperado por el frontend
    documents = data.documents.map(doc => {
      // Extraer solo el nombre del documento (antes del primer " - ")
      let displayName = doc.filename;
      if (displayName && displayName.includes(' - ')) {
        displayName = displayName.split(' - ')[0].trim();
      }
      
      return {
        id: doc.id,
        name: displayName,
        type: doc.filetype?.toLowerCase() || 'pdf',
        size: doc.filesize || 0,
        status: doc.status || getMessage(documentos.statusUnread),
        statusColor: doc.statusColor || 'gray',
        factura: doc.factura,
        fecha_factura: doc.fecha_factura,
        created: doc.created,
        updated: doc.updated,
        url: doc.filepath || '#'
      };
    });
    
    // Inicializar filteredDocuments con todos los documentos visibles
    filteredDocuments = [...documents];
  } catch (error) {
    console.error('Error cargando documentos desde API:', error);
    throw error;
  }
}





// =============================================================================
// FUNCIONES DE ACCIONES DE DOCUMENTOS
// =============================================================================

// Función para abrir archivos en modal de forma segura (lado cliente)
window.downloadFileClient = async (fileId) => {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      showNotification(getMessage(documentos.authRequired), 'error');
      return;
    }

    // Usar el proxy del frontend en lugar del backend directamente
    const response = await fetch(`/api/files/view-with-token/${fileId}?token=${token}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      if (response.status === 403) {
        showNotification(getMessage(documentos.noPermission), 'error');
      } else if (response.status === 404) {
        showNotification(getMessage(documentos.fileNotFound), 'error');
      } else {
        showNotification(getMessage(documentos.loadFileError), 'error');
      }
      return;
    }

    // Obtener el nombre del archivo del header Content-Disposition
    const contentDisposition = response.headers.get('Content-Disposition');
    let filename = 'archivo.pdf';
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="(.+)"/);
      if (filenameMatch) {
        filename = filenameMatch[1];
      }
    }

    // Abrir archivo directamente en nueva pestaña usando URL del frontend
    const fileUrl = `/api/files/view-with-token/${fileId}?token=${token}`;
    window.open(fileUrl, '_blank');

    // Marcar como visto si no lo está
    const originalDoc = documents.find(d => d.id === fileId);
    if (originalDoc && originalDoc.status === 'Unread') {
      originalDoc.status = 'Viewed';
      const filteredDoc = filteredDocuments.find(d => d.id === fileId);
      if (filteredDoc) {
        filteredDoc.status = 'Viewed';
      }
    }

  } catch (error) {
    console.error('Error cargando archivo:', error);
    showNotification(getMessage(documentos.loadFileNetworkError), 'error');
  }
};

  // Función para abrir modal con archivo (lado cliente)
  function openFileModalClient(fileId, filename) {
  // Crear modal si no existe
  let modal = document.getElementById('file-viewer-modal-client');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'file-viewer-modal-client';
    modal.className = 'fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 hidden';
    modal.innerHTML = `
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-6xl max-h-[90vh] w-full mx-4 flex flex-col">
        <div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white" id="file-modal-title-client">${filename}</h3>
          <div class="flex items-center space-x-2">
            <button id="download-file-btn-client" class="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
            </button>
            <button id="close-file-modal-client" class="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="flex-1 p-4 overflow-hidden">
          <iframe id="file-iframe-client" src="" class="w-full h-full border-0 rounded"></iframe>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    // Event listeners
    document.getElementById('close-file-modal-client').addEventListener('click', closeFileModalClient);
    document.getElementById('download-file-btn-client').addEventListener('click', () => {
      const a = document.createElement('a');
      a.href = fileUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    });
    
    // Cerrar con ESC
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
        closeFileModalClient();
      }
    });
  }

    // Configurar contenido
    document.getElementById('file-modal-title-client').textContent = filename;
    
    // Mostrar modal
    modal.classList.remove('hidden');
    
    // Cargar archivo con token temporal
    loadFileWithTokenClient(fileId);
}

// Función para cargar archivo con token temporal (lado cliente)
async function loadFileWithTokenClient(fileId) {
  const fileContent = document.getElementById('file-content-client');
  
  try {
    // Usar endpoint con token como parámetro de consulta
    const token = localStorage.getItem('token');
    const iframeUrl = `${window.apiBase}/api/files/view-with-token/${fileId}?token=${encodeURIComponent(token)}`;
    
    fileContent.innerHTML = `
      <iframe id="file-iframe-client" src="${iframeUrl}" class="w-full h-full border-0 rounded" 
              onload="this.style.display='block'" 
              onerror="showFileErrorClient()"></iframe>
    `;
  } catch (error) {
    console.error('Error cargando archivo:', error);
    showFileErrorClient();
  }
}

// Función para mostrar error de carga (lado cliente)
function showFileErrorClient() {
  const fileContent = document.getElementById('file-content-client');
  fileContent.innerHTML = `
    <div class="text-center">
      <div class="inline-flex items-center justify-center w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full mb-4">
        <svg class="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
      </div>
      <p class="text-sm text-red-600 dark:text-red-400 mb-4">Error al cargar el archivo</p>
      <button onclick="location.reload()" class="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors">
        Recargar página
      </button>
    </div>
  `;
}

// Función para cerrar modal (lado cliente)
function closeFileModalClient() {
  const modal = document.getElementById('file-viewer-modal-client');
  if (modal) {
    modal.classList.add('hidden');
    // Limpiar iframe para liberar memoria
    const iframe = document.getElementById('file-iframe-client');
    if (iframe) {
      iframe.src = '';
    }
  }
}

function downloadDocument(docId) {
  const originalDoc = documents.find(d => d.id === docId);
  if (originalDoc) {
    // Downloading document
    showNotification(getMessage(documentos.downloadInProgress).replace('{name}', originalDoc.name));
    
    // Marcar como visto si no lo está
    if (originalDoc.status === 'Unread') {
      originalDoc.status = 'Viewed';
      
      const filteredDoc = filteredDocuments.find(d => d.id === docId);
      if (filteredDoc) {
        filteredDoc.status = 'Viewed';
      }
      
    }
  }
}

function viewDocument(docId) {
  const originalDoc = documents.find(d => d.id === docId);
  if (originalDoc) {
    // Viewing document
    showNotification(getMessage(documentos.openForViewing).replace('{name}', originalDoc.name));
    
    // Marcar como visto si no lo está
    if (originalDoc.status === 'Unread') {
      originalDoc.status = 'Viewed';
      
      const filteredDoc = filteredDocuments.find(d => d.id === docId);
      if (filteredDoc) {
        filteredDoc.status = 'Viewed';
      }
      
    }
  }
}

function markAsReviewed(docId) {
      // Marking document as reviewed
  const originalDoc = documents.find(d => d.id === docId);
  
  if (originalDoc && originalDoc.status !== 'Reviewed') {
    // Document found, marking as reviewed
    originalDoc.status = 'Reviewed';
    
    const filteredDoc = filteredDocuments.find(d => d.id === docId);
    if (filteredDoc) {
      filteredDoc.status = 'Reviewed';
    }
    
    // Showing notification for document
    
    // Test directo de notificación
    showNotification(getMessage(documentos.markedReviewed).replace('{name}', originalDoc.name), 'success');
  } else {
    // Document not found or already reviewed
  }
}

function markAsNotReviewed(docId) {
  const originalDoc = documents.find(d => d.id === docId);
  
  if (originalDoc && originalDoc.status === 'Reviewed') {
    originalDoc.status = 'Viewed';
    
    const filteredDoc = filteredDocuments.find(d => d.id === docId);
    if (filteredDoc) {
      filteredDoc.status = 'Viewed';
    }
    
    showNotification(getMessage(documentos.markedNotReviewed).replace('{name}', originalDoc.name), 'success');
  }
}

function sendDocumentByEmail(docId) {
  const originalDoc = documents.find(d => d.id === docId);
  if (originalDoc) {
    // Opening email modal for document
    // Aquí se abriría el modal de email
    showNotification(getMessage(documentos.emailModalOpened).replace('{name}', originalDoc.name));
  }
}

// =============================================================================
// FUNCIONES UTILITARIAS
// =============================================================================

function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
  
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  if (diffInHours < 24) {
    return date.toLocaleString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: userTimezone
    }) + ` today`;
  } else if (diffInHours < 48) {
    return date.toLocaleString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: userTimezone
    }) + ` yesterday`;
  } else if (diffInHours < 168) {
    return date.toLocaleString('en-US', {
      weekday: 'long',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: userTimezone
    });
  } else {
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: userTimezone
    });
  }
}

function formatDateShort(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
  
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  if (diffInHours < 24) {
    return date.toLocaleString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: userTimezone
    });
  } else if (diffInHours < 48) {
    return date.toLocaleString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: userTimezone
    });
  } else if (diffInHours < 168) {
    return date.toLocaleString('en-US', {
      weekday: 'long',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: userTimezone
    });
  } else {
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: userTimezone
    });
  }
}

function getCurrentLocale() {
  const storedLang = localStorage.getItem('lang') || window.lang || document.documentElement.lang || navigator.language || 'en';
  return storedLang.startsWith('es') ? 'es-CL' : storedLang;
}

function formatDateOnly(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '-';
  return date.toLocaleDateString(getCurrentLocale(), {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function showNotification(message, type = 'success') {
  // Verificar si el modal está abierto
  const modal = document.getElementById('email-modal');
  const isModalOpen = modal && !modal.classList.contains('hidden');
  
  if (isModalOpen) {
    // Si el modal está abierto, mostrar la notificación dentro del modal
    showModalNotification(message, type);
  } else {
    // Si el modal está cerrado, mostrar la notificación global
    globalShowNotification(message, type);
  }
}

function showModalNotification(message, type = 'success') {
  const modal = document.getElementById('email-modal');
  if (!modal) return;
  
  const bgColor = type === 'success' ? 'bg-green-500' : 'bg-red-500';
  const icon = type === 'success' ? 
    '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>' :
    '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>';
  
  const notification = document.createElement('div');
  notification.className = `absolute top-12 right-4 ${bgColor} text-white px-6 py-4 rounded-xl shadow-2xl transform transition-all duration-300 translate-x-full z-[99999999]`;
  notification.innerHTML = `
    <div class="flex items-center space-x-3">
      <div class="flex-shrink-0">
        ${icon}
      </div>
      <div class="flex-1">
        <p class="text-sm font-medium">${message}</p>
      </div>
      <button class="flex-shrink-0 text-white/80 hover:text-white transition-colors duration-200">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>
  `;
  
  // Agregar la notificación al modal
  modal.appendChild(notification);
  
  // Animar entrada
  setTimeout(() => {
    notification.classList.remove('translate-x-full');
  }, 100);
  
  // Event listener para cerrar manualmente
  const closeBtn = notification.querySelector('button');
  closeBtn?.addEventListener('click', () => {
    notification.classList.add('translate-x-full');
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  });
  
  // Remover después de 4 segundos
  setTimeout(() => {
    if (notification.parentNode) {
      notification.classList.add('translate-x-full');
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }
  }, 4000);
}



function setupEventListeners() {
  // Event listeners para botones de items
  document.addEventListener('click', (e) => {
    const viewItemsBtn = e.target.closest('.view-items-btn');
    if (viewItemsBtn) {
      e.preventDefault();
      const orderPc = viewItemsBtn.dataset.orderPc;
      const orderOc = viewItemsBtn.dataset.orderOc;
      const factura = viewItemsBtn.dataset.factura;
      openItemsModal(orderPc, orderOc, factura);
    }

    const viewDocsBtn = e.target.closest('.view-docs-btn');
    if (viewDocsBtn) {
      e.preventDefault();
      e.stopPropagation();
      const orderId = viewDocsBtn.dataset.orderId;
      const order = window.orders?.find(o => String(o.id) === String(orderId));
      openDocsModal(order);
    }
  });

  if (closeDocsModalBtn && docsModal) {
    closeDocsModalBtn.addEventListener('click', () => {
      docsModal.classList.add('hidden');
    });
    docsModal.addEventListener('click', (e) => {
      if (e.target === docsModal) {
        docsModal.classList.add('hidden');
      }
    });
  }
}

// =============================================================================
// FUNCIONES DEL MODAL DE EMAIL
// =============================================================================

/**
 * Abre el modal de email
 */
function openEmailModal(docId) {
      // Opening email modal for document
  
  const modal = document.getElementById('email-modal');
  const modalContent = modal?.querySelector('.relative.mx-auto');
  
  if (!modal || !modalContent) {
    console.error('Modal elements not found');
    return;
  }
  
  // Guardar el ID del documento en el modal
  modal.dataset.docId = docId.toString();
  
  // Obtener el documento
  const doc = documents.find(d => d.id === docId);
  if (!doc) {
    console.error('Document not found:', docId);
    return;
  }
  
  // Actualizar los detalles del documento en el modal
  const documentDetails = document.getElementById('document-details');
  if (documentDetails) {
    documentDetails.innerHTML = `
      <div class="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
        <div class="flex items-center space-x-3 mb-3">
          <div class="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            <svg class="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
          </div>
          <div>
            <h5 class="font-semibold text-gray-900 dark:text-white">${doc.name}</h5>
            <p class="text-sm text-gray-500 dark:text-gray-400">${doc.category}</p>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3 mb-3">
          <div class="bg-gray-50 dark:bg-gray-700 p-2 rounded text-center">
            <div class="text-xs text-gray-500 dark:text-gray-400">Size</div>
            <div class="font-medium text-gray-900 dark:text-white">${doc.size}</div>
          </div>
          <div class="bg-gray-50 dark:bg-gray-700 p-2 rounded text-center">
            <div class="text-xs text-gray-500 dark:text-gray-400">Type</div>
            <div class="font-medium text-gray-900 dark:text-white">${doc.type.toUpperCase()}</div>
          </div>
        </div>
        <div class="text-xs text-gray-500 dark:text-gray-400">
          ${getMessage(documentos.lastUpdatedLabel)}: ${formatDate(doc.updated)}
        </div>
        <div class="mt-2">
          <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusColors[doc.status]}">
            ${doc.status}
          </span>
        </div>
      </div>
    `;
  }
  
  // Pre-llenar campos de contacto si están disponibles
  const contactName = document.getElementById('contact-name');
  const contactEmail = document.getElementById('contact-email');
  const issueDescription = document.getElementById('issue-description');
  
  // Intentar obtener datos del usuario actual (simulado)
  if (contactName && contactEmail) {
    // En un caso real, estos datos vendrían del backend
    contactName.value = localStorage.getItem('userName') || '';
    contactEmail.value = localStorage.getItem('userEmail') || '';
  }
  
  // Configurar event listeners de validación
  setupValidationEventListeners();
  
  // Pre-llenar descripción con template
  if (issueDescription) {
    const templateText = `I have reviewed the document "${doc.name}" and found the following issue:

PROBLEM DESCRIPTION:
[Please describe the specific problem you encountered]

LOCATION IN DOCUMENT:
[If applicable, mention page numbers, sections, or specific areas]

IMPACT:
[How does this issue affect the document or its users?]

SUGGESTED SOLUTION:
[If you have any suggestions for fixing this issue]

ADDITIONAL CONTEXT:
[Any other relevant information that might help resolve this issue]`;

    issueDescription.value = templateText;
  }
  
  // Mostrar modal con animación suave
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  
  // Animar entrada con delay mínimo para evitar parpadeo
  requestAnimationFrame(() => {
    modalContent.classList.remove('scale-95', 'opacity-0', 'translate-y-4');
    modalContent.classList.add('scale-100', 'opacity-100', 'translate-y-0');
  });
}

/**
 * Cierra el modal de email
 */
function closeEmailModal() {
      // Closing email modal
  
  const modal = document.getElementById('email-modal');
  const modalContent = modal?.querySelector('.relative.mx-auto');
  
  if (!modal || !modalContent) return;
  
  // Limpiar archivos seleccionados
  selectedFiles = [];
  selectedExistingFiles = [];
  const selectedFilesDiv = document.getElementById('selected-files');
  if (selectedFilesDiv) {
    selectedFilesDiv.classList.add('hidden');
  }
  
  // Limpiar input de archivos
  const fileInput = document.getElementById('file-upload');
  if (fileInput) {
    fileInput.value = '';
  }
  
  // Animar salida suave
  modalContent.classList.remove('scale-100', 'opacity-100', 'translate-y-0');
  modalContent.classList.add('scale-95', 'opacity-0', 'translate-y-4');
  
  // Ocultar después de la animación
  setTimeout(() => {
    modal.classList.add('hidden');
  }, 200);
}

/**
 * Envía el email desde el modal
 */
function sendEmailFromModal() {
      // Sending email from modal
  
  const modal = document.getElementById('email-modal');
  const docId = parseInt(modal?.dataset.docId || '0');
  const contactName = document.getElementById('contact-name');
  const contactEmail = document.getElementById('contact-email');
  const contactPhone = document.getElementById('contact-phone');
  const issueDescription = document.getElementById('issue-description');
  const issueType = document.querySelector('input[name="issue-type"]:checked');
  const priority = document.querySelector('input[name="priority"]:checked');
  
  // Limpiar errores previos
  clearValidationErrors();
  
  // Array para almacenar errores
  const errors = [];
  
  // Validar campos requeridos
  if (!contactName?.value.trim()) {
    errors.push('contact-name');
    showFieldError(contactName, 'Name is required');
  }
  
  if (!contactEmail?.value.trim()) {
    errors.push('contact-email');
    showFieldError(contactEmail, 'Email is required');
  } else if (!isValidEmail(contactEmail.value.trim())) {
    errors.push('contact-email');
    showFieldError(contactEmail, 'Please enter a valid email address');
  }
  
  if (!issueDescription?.value.trim()) {
    errors.push('issue-description');
    showFieldError(issueDescription, 'Description is required');
  } else if (issueDescription.value.trim().length < 20) {
    errors.push('issue-description');
    showFieldError(issueDescription, 'Description must be at least 20 characters');
  }
  
  if (!issueType) {
    errors.push('issue-type');
    showSectionError('issue-type-section', 'Please select an issue type');
  }
  
  if (!priority) {
    errors.push('priority');
    showSectionError('priority-section', 'Please select a priority level');
  }
  
  // Si hay errores, mostrar notificación y detener
  if (errors.length > 0) {
    showNotification(getMessage(documentos.issueFormRequired), 'error');
    return;
  }
  
  // Obtener tipo de problema y prioridad seleccionados
  const issueTypeValue = issueType?.value || 'other';
  const priorityValue = priority?.value || 'medium';
  
  const originalDoc = documents.find(d => d.id === docId);
  if (originalDoc) {
    // Crear mensaje profesional
    const subject = `[ISSUE REPORT] ${originalDoc.name} - ${issueTypeValue.toUpperCase()}`;
    
    let body = `Hello,

I'm reporting an issue with the document "${originalDoc.name}".

REPORT DETAILS:
- Issue Type: ${issueTypeValue}
- Priority: ${priorityValue}
- Reporter: ${contactName.value}
- Contact Email: ${contactEmail.value}
${contactPhone?.value ? `- Contact Phone: ${contactPhone.value}` : ''}

DOCUMENT INFORMATION:
- Name: ${originalDoc.name}
- Category: ${originalDoc.category}
- Size: ${originalDoc.size}
- Type: ${originalDoc.type.toUpperCase()}
- Status: ${originalDoc.status}
- ${getMessage(documentos.lastUpdatedLabel)}: ${formatDate(originalDoc.updated)}

DESCRIPTION:
${issueDescription.value}`;

    // Agregar información sobre archivos adjuntos si los hay
    const totalAttachments = selectedFiles.length + selectedExistingFiles.length;
    if (totalAttachments > 0) {
      body += `\n\nADDITIONAL FILES ATTACHED:`;
      
      if (selectedFiles.length > 0) {
        body += `\n\nNew Uploads:`;
        selectedFiles.forEach(file => {
          body += `\n- ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;
        });
      }
      
      if (selectedExistingFiles.length > 0) {
        body += `\n\nExisting Files:`;
        selectedExistingFiles.forEach(doc => {
          body += `\n- ${doc.name} (${doc.size}) - ${doc.category}`;
        });
      }
      
      body += `\n\nNote: Please check the attached files for additional context or examples related to this issue.`;
    }

    body += `\n\nPlease review this document and address the reported issue.

Best regards,
${contactName.value}`;

    // Crear URL de mailto
    const mailtoUrl = `mailto:admin@gelymar.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
    // Abrir cliente de email del usuario
    window.open(mailtoUrl, '_blank');
    
    // Guardar datos de contacto para futuras sesiones
    localStorage.setItem('userName', contactName.value);
    localStorage.setItem('userEmail', contactEmail.value);
    
    // Cerrar el modal con animación
    closeEmailModal();
    
    // Mostrar notificación
    showNotification(getMessage(documentos.issueReportSubmitted).replace('{name}', originalDoc.name));
    
    // Issue report sent for document
  }
}

// Variables para archivos adjuntos
let selectedFiles = [];
let selectedExistingFiles = [];

/**
 * Valida si un email es válido
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Muestra error en un campo específico
 */
function showFieldError(field, message) {
  if (!field) return;
  
  // Agregar clases de error
  field.classList.add('border-red-500', 'ring-red-500', 'ring-2');
  
  // Crear o actualizar mensaje de error
  let errorMessage = field.parentNode.querySelector('.field-error');
  if (!errorMessage) {
    errorMessage = document.createElement('div');
    errorMessage.className = 'field-error text-red-500 text-xs mt-1';
    field.parentNode.appendChild(errorMessage);
  }
  errorMessage.textContent = message;
  
  // Remover error después de 5 segundos
  setTimeout(() => {
    field.classList.remove('border-red-500', 'ring-red-500', 'ring-2');
    if (errorMessage) {
      errorMessage.remove();
    }
  }, 5000);
}

/**
 * Muestra error en una sección específica
 */
function showSectionError(sectionId, message) {
  const section = document.getElementById(sectionId);
  if (!section) return;
  
  // Crear o actualizar mensaje de error
  let errorMessage = section.querySelector('.section-error');
  if (!errorMessage) {
    errorMessage = document.createElement('div');
    errorMessage.className = 'section-error text-red-500 text-xs mt-2';
    section.appendChild(errorMessage);
  }
  errorMessage.textContent = message;
  
  // Remover error después de 5 segundos
  setTimeout(() => {
    if (errorMessage) {
      errorMessage.remove();
    }
  }, 5000);
}

/**
 * Limpia todos los errores de validación
 */
function clearValidationErrors() {
  // Limpiar errores de campos
  document.querySelectorAll('.field-error').forEach(error => error.remove());
  document.querySelectorAll('.section-error').forEach(error => error.remove());
  
  // Limpiar clases de error de campos
  document.querySelectorAll('.border-red-500.ring-red-500').forEach(field => {
    field.classList.remove('border-red-500', 'ring-red-500', 'ring-2');
  });
}

/**
 * Configura event listeners para limpiar errores al escribir
 */
function setupValidationEventListeners() {
  // Limpiar errores cuando el usuario escriba en campos de texto
  const textFields = ['contact-name', 'contact-email', 'contact-phone', 'issue-description'];
  textFields.forEach(fieldId => {
    const field = document.getElementById(fieldId);
    if (field) {
      field.addEventListener('input', () => {
        const errorMessage = field.parentNode.querySelector('.field-error');
        if (errorMessage) {
          errorMessage.remove();
        }
        field.classList.remove('border-red-500', 'ring-red-500', 'ring-2');
      });
    }
  });
  
  // Limpiar errores cuando el usuario seleccione radio buttons
  const radioGroups = ['issue-type', 'priority'];
  radioGroups.forEach(groupName => {
    document.querySelectorAll(`input[name="${groupName}"]`).forEach(radio => {
      radio.addEventListener('change', () => {
        const sectionId = groupName === 'issue-type' ? 'issue-type-section' : 'priority-section';
        const section = document.getElementById(sectionId);
        if (section) {
          const errorMessage = section.querySelector('.section-error');
          if (errorMessage) {
            errorMessage.remove();
          }
        }
      });
    });
  });
}

/**
 * Maneja la carga de archivos
 */
function handleFileUpload() {
  const fileInput = document.getElementById('file-upload');
  const uploadBtn = document.getElementById('upload-btn');
  
  // Tabs functionality
  const uploadTab = document.getElementById('upload-tab');
  const selectTab = document.getElementById('select-tab');
  const uploadPanel = document.getElementById('upload-panel');
  const selectPanel = document.getElementById('select-panel');
  
  // Tab switching
  uploadTab?.addEventListener('click', () => {
    uploadTab.classList.add('bg-white', 'dark:bg-gray-800', 'text-gray-900', 'dark:text-white', 'shadow-sm');
    uploadTab.classList.remove('text-gray-600', 'dark:text-gray-400');
    selectTab?.classList.remove('bg-white', 'dark:bg-gray-800', 'text-gray-900', 'dark:text-white', 'shadow-sm');
    selectTab?.classList.add('text-gray-600', 'dark:text-gray-400');
    uploadPanel?.classList.remove('hidden');
    selectPanel?.classList.add('hidden');
  });
  
  selectTab?.addEventListener('click', () => {
    selectTab.classList.add('bg-white', 'dark:bg-gray-800', 'text-gray-900', 'dark:text-white', 'shadow-sm');
    selectTab.classList.remove('text-gray-600', 'dark:text-gray-400');
    uploadTab?.classList.remove('bg-white', 'dark:bg-gray-800', 'text-gray-900', 'dark:text-white', 'shadow-sm');
    uploadTab?.classList.add('text-gray-600', 'dark:text-gray-400');
    selectPanel?.classList.remove('hidden');
    uploadPanel?.classList.add('hidden');
    loadAvailableFiles();
  });
  
  // Trigger file input
  uploadBtn?.addEventListener('click', () => {
    fileInput?.click();
  });
  
  // Handle file selection
  fileInput?.addEventListener('change', (e) => {
    const files = e.target.files;
    if (files) {
      selectedFiles = Array.from(files);
      displaySelectedFiles();
    }
  });
  
  // Handle drag and drop
  const dropZone = document.querySelector('.border-dashed');
  
  dropZone?.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('border-blue-400', 'bg-blue-50');
    dropZone.classList.remove('border-gray-300');
  });
  
  dropZone?.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropZone.classList.remove('border-blue-400', 'bg-blue-50');
    dropZone.classList.add('border-gray-300');
  });
  
  dropZone?.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('border-blue-400', 'bg-blue-50');
    dropZone.classList.add('border-gray-300');
    
    const files = Array.from(e.dataTransfer?.files || []);
    selectedFiles = [...selectedFiles, ...files];
    displaySelectedFiles();
  });
}

/**
 * Muestra los archivos seleccionados
 */
function displaySelectedFiles() {
  const selectedFilesDiv = document.getElementById('selected-files');
  const filesList = document.getElementById('files-list');
  
  const totalFiles = selectedFiles.length + selectedExistingFiles.length;
  
  if (totalFiles === 0) {
    selectedFilesDiv?.classList.add('hidden');
    return;
  }
  
  selectedFilesDiv?.classList.remove('hidden');
  if (filesList) filesList.innerHTML = '';
  
  // Mostrar archivos subidos
  selectedFiles.forEach((file, index) => {
    const fileItem = document.createElement('div');
    fileItem.className = 'flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600';
    
    const fileSize = (file.size / 1024 / 1024).toFixed(2);
    
    fileItem.innerHTML = `
      <div class="flex items-center space-x-3">
        <div class="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
          <svg class="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
          </svg>
        </div>
        <div>
          <p class="text-sm font-medium text-gray-900 dark:text-white">${file.name}</p>
          <p class="text-xs text-gray-500 dark:text-gray-400">${fileSize} MB • New Upload</p>
        </div>
      </div>
      <button type="button" class="text-red-500 hover:text-red-700 transition-colors duration-200" onclick="removeFile(${index})">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    `;
    
    filesList?.appendChild(fileItem);
  });
  
  // Mostrar archivos existentes seleccionados
  selectedExistingFiles.forEach((doc, index) => {
    const fileItem = document.createElement('div');
    fileItem.className = 'flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/30 rounded-lg border border-green-200 dark:border-green-600';
    
    fileItem.innerHTML = `
      <div class="flex items-center space-x-3">
        <div class="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
          <svg class="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
        </div>
        <div>
          <p class="text-sm font-medium text-gray-900 dark:text-white">${doc.name}</p>
          <p class="text-xs text-gray-500 dark:text-gray-400">${doc.size} • ${doc.category} • Existing File</p>
        </div>
      </div>
      <div class="flex items-center space-x-2">
        <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusColors[doc.status]}">
          ${doc.status}
        </span>
        <button type="button" class="text-red-500 hover:text-red-700 transition-colors duration-200" onclick="removeExistingFile(${index})">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>
    `;
    
    filesList?.appendChild(fileItem);
  });
}

/**
 * Remueve un archivo subido
 */
function removeFile(index) {
  selectedFiles.splice(index, 1);
  displaySelectedFiles();
}

/**
 * Remueve un archivo existente
 */
function removeExistingFile(index) {
  selectedExistingFiles.splice(index, 1);
  displaySelectedFiles();
}

/**
 * Carga archivos disponibles
 */
function loadAvailableFiles() {
  const availableFilesList = document.getElementById('available-files-list');
  const fileSearch = document.getElementById('file-search');
  const fileCategoryFilter = document.getElementById('file-category-filter');
  
  // Filtrar documentos (excluir el documento actual)
  const currentDocId = parseInt(document.getElementById('email-modal')?.dataset.docId || '0');
  let availableDocs = documents.filter(doc => doc.id !== currentDocId);
  
  // Aplicar filtros
  const searchTerm = fileSearch?.value.toLowerCase() || '';
  const selectedCategory = fileCategoryFilter?.value || '';
  
  if (searchTerm) {
    availableDocs = availableDocs.filter(doc => 
      doc.name.toLowerCase().includes(searchTerm) || 
      doc.category.toLowerCase().includes(searchTerm)
    );
  }
  
  if (selectedCategory) {
    availableDocs = availableDocs.filter(doc => doc.category === selectedCategory);
  }
  
  // Renderizar archivos disponibles
  if (availableFilesList) availableFilesList.innerHTML = '';
  
  if (availableDocs.length === 0) {
    if (availableFilesList) {
      availableFilesList.innerHTML = `
        <div class="p-4 text-center text-gray-500 dark:text-gray-400">
          <svg class="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
          <p class="text-sm">No files found</p>
        </div>
      `;
    }
    return;
  }
  
  availableDocs.forEach(doc => {
    const isSelected = selectedExistingFiles.some(selected => selected.id === doc.id);
    const fileItem = document.createElement('div');
    fileItem.className = `p-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors duration-200 ${isSelected ? 'bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-500' : ''}`;
    
    fileItem.innerHTML = `
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-3">
          <div class="p-2 bg-gray-100 dark:bg-gray-600 rounded-lg">
            <svg class="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
          </div>
          <div class="flex-1">
            <p class="text-sm font-medium text-gray-900 dark:text-white">${doc.name}</p>
            <p class="text-xs text-gray-500 dark:text-gray-400">${doc.category} • ${doc.size}</p>
          </div>
        </div>
        <div class="flex items-center space-x-2">
          <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusColors[doc.status]}">
            ${doc.status}
          </span>
          <button type="button" class="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors duration-200" onclick="toggleExistingFile(${doc.id})">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${isSelected ? 'M5 13l4 4L19 7' : 'M12 6v6m0 0v6m0-6h6m-6 0H6'}"/>
            </svg>
          </button>
        </div>
      </div>
    `;
    
    availableFilesList?.appendChild(fileItem);
  });
}

/**
 * Alterna la selección de un archivo existente
 */
function toggleExistingFile(docId) {
  const doc = documents.find(d => d.id === docId);
  if (!doc) return;
  
  const existingIndex = selectedExistingFiles.findIndex(selected => selected.id === docId);
  
  if (existingIndex > -1) {
    // Remover archivo
    selectedExistingFiles.splice(existingIndex, 1);
  } else {
    // Agregar archivo
    selectedExistingFiles.push(doc);
  }
  
  displaySelectedFiles();
  loadAvailableFiles(); // Recargar para actualizar UI
}

// Hacer las funciones globales para onclick
window.removeFile = removeFile;
window.toggleExistingFile = toggleExistingFile;
window.removeExistingFile = removeExistingFile;

/**
 * Configura los event listeners del modal
 */
function setupModalEventListeners() {
  // Event listeners para el modal
  document.getElementById('close-email-modal')?.addEventListener('click', closeEmailModal);
  document.getElementById('cancel-email')?.addEventListener('click', closeEmailModal);
  document.getElementById('send-email')?.addEventListener('click', sendEmailFromModal);
  
  // Event listeners para filtros de archivos
  document.getElementById('file-search')?.addEventListener('input', loadAvailableFiles);
  document.getElementById('file-category-filter')?.addEventListener('change', loadAvailableFiles);

  // Cerrar modal al hacer click fuera de él
  document.getElementById('email-modal')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
      closeEmailModal();
    }
  });
  
  // Configurar manejo de archivos
  handleFileUpload();
}

/**
 * Actualiza la paginación de órdenes
 */
function updateOrdersPagination() {
  const totalPages = Math.ceil(filteredOrders.length / ordersPerPage);
  const startItem = filteredOrders.length === 0 ? 0 : (currentOrderPage - 1) * ordersPerPage + 1;
  const endItem = Math.min(currentOrderPage * ordersPerPage, filteredOrders.length);

  // Actualizar información de paginación
  const paginationInfo = document.getElementById('orders-pagination-info');
  if (paginationInfo) {
    paginationInfo.textContent = `Showing ${startItem}-${endItem} of ${filteredOrders.length} orders`;
  }

  // Generar botones de página dinámicamente
  const pageNumbersContainer = document.getElementById('orders-page-numbers');
  if (pageNumbersContainer) {
    pageNumbersContainer.innerHTML = '';

    // Mostrar "Page X of Y"
    const pageInfo = document.createElement('span');
    pageInfo.className = 'px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300';
    pageInfo.textContent = `Page ${currentOrderPage} of ${totalPages}`;
    
    pageNumbersContainer.appendChild(pageInfo);
  }

  // Actualizar botones Previous/Next
  const prevBtn = document.getElementById('orders-prev-btn');
  const nextBtn = document.getElementById('orders-next-btn');
  
  if (prevBtn) {
    prevBtn.disabled = currentOrderPage === 1;
    prevBtn.onclick = () => {
      if (currentOrderPage > 1) {
        currentOrderPage--;
        renderOrders();
      }
    };
  }
  
  if (nextBtn) {
    nextBtn.disabled = currentOrderPage === totalPages;
    nextBtn.onclick = () => {
      if (currentOrderPage < totalPages) {
        currentOrderPage++;
        renderOrders();
      }
    };
  }
}

// =============================================================================
// INICIALIZACIÓN
// =============================================================================

// Esperar a que el DOM esté listo
document.addEventListener('DOMContentLoaded', async () => {
  await init();
  setupModalEventListeners();
});

// Función para abrir el modal de items
async function openItemsModal(orderPc, orderOc, factura) {
  const itemsModal = document.getElementById('itemsModal');
  const itemsOrderTitle = document.getElementById('itemsOrderTitle');
  const itemsTableBody = document.getElementById('itemsTableBody');
  const totalItems = document.getElementById('totalItems');
  const totalQuantity = document.getElementById('totalQuantity');
  const totalGastoAdicional = document.getElementById('totalGastoAdicional');
  const totalValue = document.getElementById('totalValue');

  if (!itemsModal || !itemsOrderTitle || !itemsTableBody) return;

  try {
    // Cargar items de la orden
    const token = localStorage.getItem('token');
    const apiBase = window.apiBase;
    
    const idOv = new URLSearchParams(window.location.search).get('idov') || '';
    const idQuery = idOv ? `?idov=${encodeURIComponent(idOv)}` : '';
    // Usar endpoint diferente según si tiene factura o no
    const url = factura && factura !== 'null' 
      ? `${apiBase}/api/orders/${orderPc}/${orderOc}/${factura}/items${idQuery}`
      : `${apiBase}/api/orders/${orderPc}/${orderOc}/items${idQuery}`;
    
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) {
      throw new Error(getMessage(documentos.itemsLoadError));
    }

    const items = await response.json();
    const facturaValue = factura === undefined || factura === null ? '' : String(factura).trim();
    const hasFactura = facturaValue !== '' && facturaValue !== 'null' && facturaValue !== '0';
    
    const docT = documentos;
    document.getElementById('itemsInitials').textContent = 'IT';
    document.getElementById('itemsOrderTitle').textContent = `${getMessage(docT.orderItems)}: ${orderOc}`;
    document.getElementById('itemsOrderSubtitle').textContent = getMessage(docT.itemsList);
    
    // Renderizar tabla de items
    if (itemsTableBody) {
      itemsTableBody.innerHTML = items.map(item => {
        const quantity = hasFactura
          ? (parseFloat(item.kg_facturados) || 0)
          : (parseFloat(item.kg_solicitados) || 0);
        const unitPrice = parseFloat(item.unit_price) || 0;
        const total = quantity * unitPrice;
        const unit = item.unidad_medida || 'KG';
        const currency = item.currency || items[0]?.currency || 'CLP';
        
        return `
          <tr class="hover:bg-gray-50 dark:hover:bg-gray-800 transition">
            <td class="px-4 py-2 text-xs text-gray-900 dark:text-gray-100">${item.item_code || getMessage(documentos.notAvailable)}</td>
            <td class="px-4 py-2 text-xs text-gray-900 dark:text-gray-100">${item.descripcion || getMessage(documentos.notAvailable)}</td>
            <td class="px-4 py-2 text-xs text-center text-gray-900 dark:text-gray-100">${formatQuantity(quantity, unit)}</td>
            <td class="px-4 py-2 text-xs text-center text-gray-900 dark:text-gray-100">${formatUnitPrice(unitPrice, currency)}</td>
            <td class="px-4 py-2 text-xs text-center font-semibold text-gray-900 dark:text-gray-100">${formatTotal(total, currency)}</td>
          </tr>
        `;
      }).join('');
    }

    // Calcular y mostrar totales
    const totalItemsCount = items.length;
    
    const totalQuantitySum = items.reduce((sum, item) => {
      const quantity = hasFactura
        ? (parseFloat(item.kg_facturados) || 0)
        : (parseFloat(item.kg_solicitados) || 0);
      return sum + quantity;
    }, 0);
    
    const totalValueSum = items.reduce((sum, item) => {
      const quantity = hasFactura
        ? (parseFloat(item.kg_facturados) || 0)
        : (parseFloat(item.kg_solicitados) || 0);
      const price = parseFloat(item.unit_price) || 0;
      const itemTotal = quantity * price;
      return sum + itemTotal;
    }, 0);

    const currency = items[0]?.currency || 'CLP';
    const unit = items[0]?.unidad_medida || 'KG';
    
    // Calculate additional cost (gasto adicional)
    const rawGastoAdicionalFactura = items[0]?.gasto_adicional_flete_factura;
    const shouldUseFacturaExpense = hasFactura && rawGastoAdicionalFactura !== null && rawGastoAdicionalFactura !== undefined && rawGastoAdicionalFactura !== '';
    const rawGastoAdicional = shouldUseFacturaExpense ? rawGastoAdicionalFactura : items[0]?.gasto_adicional_flete;
    
    const gastoAdicional = parseFloat(rawGastoAdicional) || 0;
    
    // Add additional cost to total value
    const totalValueWithAdditional = totalValueSum + gastoAdicional;
    
    // Update totals display
    totalItems.textContent = totalItemsCount;
    totalQuantity.textContent = formatQuantity(totalQuantitySum, unit);
    if (totalGastoAdicional) totalGastoAdicional.textContent = formatCurrency(gastoAdicional, currency, 2);
    totalValue.textContent = formatCurrency(totalValueWithAdditional, currency, 2);

    // Mostrar el modal
    itemsModal.classList.remove('hidden');
    itemsModal.classList.add('flex');

  } catch (error) {
    console.error('Error loading order items:', error);
    showNotification(getMessage(documentos.itemsLoadError), 'error');
  }
}

// Función para abrir el modal de documentos
async function openDocsModal(order) {
  if (!order || !docsModal || !docsListBody) return;
  try {
    await loadOrderDocumentsFromAPI(order.id);
  } catch (error) {
    console.error('Error loading documents for modal:', error);
    showNotification(getMessage(documentos.documentsLoadError), 'error');
    return;
  }

  if (docsOrderTitle) {
    docsOrderTitle.textContent = `${getMessage(documentos.order)}: ${order.orderNumber}`;
  }

  docsListBody.innerHTML = documents.length === 0
    ? `<tr><td colspan="5" class="px-4 py-3 text-center text-sm text-gray-500 dark:text-gray-400">${getMessage(documentos.noDocs)}</td></tr>`
    : documents.map(doc => {
        const status = doc.status || getMessage(documentos.statusUnread);
        return `
          <tr>
            <td class="px-4 py-2 text-xs text-gray-900 dark:text-gray-100">${doc.name}</td>
            <td class="px-4 py-2 text-xs text-gray-900 dark:text-gray-100">${doc.type?.toUpperCase() || '-'}</td>
            <td class="px-4 py-2 text-xs text-gray-900 dark:text-gray-100">${status}</td>
            <td class="px-4 py-2 text-xs text-gray-900 dark:text-gray-100">${formatDateOnly(doc.created)}</td>
            <td class="px-4 py-2 text-center">
              <a href="#" onclick="downloadFileClient(${doc.id})"
                 class="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm leading-none"
                 data-doc-id="${doc.id}" title="${getMessage(documentos.downloadDocument)}">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
                ${getMessage(documentos.downloadDocument)}
              </a>
            </td>
          </tr>
        `;
      }).join('');

  docsModal.classList.remove('hidden');
}

// Funciones de formateo
function formatQuantity(quantity, unit) {
  if (quantity === 0) return '0';
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
  return `${quantity.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ${mappedUnit}`;
}

function formatUnitPrice(price, currency = 'CLP') {
  return formatCurrency(price, currency, 4);
}

function formatTotal(total, currency = 'CLP') {
  return formatCurrency(total, currency, 2);
}

function formatCurrency(amount, currency = 'CLP', decimals = 2) {
  const currencyMap = {
    'USD': 'USD',
    'US': 'USD',
    'UF': 'UF',
    'CLP': 'CLP',
    'PESO': 'CLP'
  };
  
  const mappedCurrency = currencyMap[currency] || currency;
  const formattedNumber = Number(amount || 0).toLocaleString('es-CL', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
  return `${mappedCurrency} ${formattedNumber}`;
}

// Event listeners para cerrar el modal
document.addEventListener('DOMContentLoaded', () => {
  const closeItemsModalBtn = document.getElementById('closeItemsModalBtn');
  const itemsModal = document.getElementById('itemsModal');

  if (closeItemsModalBtn) {
    closeItemsModalBtn.addEventListener('click', () => {
      itemsModal.classList.add('hidden');
      itemsModal.classList.remove('flex');
    });
  }

  if (itemsModal) {
    itemsModal.addEventListener('click', (e) => {
      if (e.target === itemsModal) {
        itemsModal.classList.add('hidden');
        itemsModal.classList.remove('flex');
      }
    });
  }
});

/**
 * Agrega event listeners a los botones de documentos
 */
function addDocumentEventListeners() {
  // Event listeners para botones de descarga
  document.addEventListener('click', (e) => {
    const downloadBtn = e.target.closest('.download-btn');
    if (downloadBtn) {
      e.preventDefault();
      const docId = downloadBtn.dataset.docId;
      downloadDocument(docId);
    }
  });

  // Event listeners para botones de vista
  document.addEventListener('click', (e) => {
    const viewBtn = e.target.closest('.view-btn');
    if (viewBtn) {
      e.preventDefault();
      const docId = viewBtn.dataset.docId;
      viewDocument(docId);
    }
  });

  // Event listeners para botones de email
  document.addEventListener('click', (e) => {
    const emailBtn = e.target.closest('.email-btn');
    if (emailBtn) {
      e.preventDefault();
      const docId = emailBtn.dataset.docId;
      openEmailModal(docId);
    }
  });

  // Event listeners para botones de revisar
  document.addEventListener('click', (e) => {
    const reviewBtn = e.target.closest('.review-btn');
    if (reviewBtn) {
      e.preventDefault();
      const docId = reviewBtn.dataset.docId;
      markAsReviewed(docId);
    }
  });

  // Event listeners para botones de no revisar
  document.addEventListener('click', (e) => {
    const unreviewBtn = e.target.closest('.unreview-btn');
    if (unreviewBtn) {
      e.preventDefault();
      const docId = unreviewBtn.dataset.docId;
      markAsNotReviewed(docId);
    }
  });
}

// Función para filtrar órdenes
function filterOrders(searchTerm) {
  if (!searchTerm.trim()) {
    filteredOrders = [...allOrders];
  } else {
    const term = searchTerm.toLowerCase();
    filteredOrders = allOrders.filter(order => 
      order.orderNumber?.toLowerCase().includes(term)
    );
  }
  
  // Resetear a página 1 cuando se filtra
  currentOrderPage = 1;
  renderOrders();
}

// Función para inicializar el buscador
function initializeOrdersSearch() {
  const searchInput = document.getElementById('orders-search-input');
  
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      filterOrders(e.target.value);
    });
  }
}

// Variables para ordenamiento
let currentSort = { column: null, direction: 'asc' };

// Función para ordenar las órdenes
function sortOrders(column, direction) {
  filteredOrders.sort((a, b) => {
    let aValue, bValue;
    
    switch (column) {
      case 'order':
        aValue = (a.orderNumber || '').toLowerCase();
        bValue = (b.orderNumber || '').toLowerCase();
        break;
      case 'documents':
        aValue = parseInt(a.documents) || 0;
        bValue = parseInt(b.documents) || 0;
        break;
      case 'invoice':
        aValue = (a.factura || '').toLowerCase();
        bValue = (b.factura || '').toLowerCase();
        break;
      case 'fecha_incoterm':
        aValue = a.fecha_incoterm || '';
        bValue = b.fecha_incoterm || '';
        break;
      case 'fecha_eta_factura':
        aValue = a.fecha_eta_factura || '';
        bValue = b.fecha_eta_factura || '';
        break;
      case 'fecha_etd_factura':
        aValue = a.fecha_etd_factura || '';
        bValue = b.fecha_etd_factura || '';
        break;
      case 'incoterm':
        aValue = (a.incoterm || '').toLowerCase();
        bValue = (b.incoterm || '').toLowerCase();
        break;
      case 'shipping':
        aValue = resolveShippingMethod(a).toLowerCase();
        bValue = resolveShippingMethod(b).toLowerCase();
        break;
      case 'puerto_destino':
        aValue = (a.puerto_destino || '').toLowerCase();
        bValue = (b.puerto_destino || '').toLowerCase();
        break;
      case 'items_count':
        aValue = parseInt(a.items_count) || 0;
        bValue = parseInt(b.items_count) || 0;
        break;
      default:
        return 0;
    }
    
    if (direction === 'asc') {
      return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
    } else {
      return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
    }
  });
}

// Función para actualizar los iconos de ordenamiento
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

// Event listeners para ordenamiento de columnas
document.addEventListener('click', (e) => {
  const header = e.target.closest('th[data-sort]');
  if (!header) return;
  
  e.preventDefault();
  const column = header.dataset.sort;
  
  // Cambiar dirección si es la misma columna
  if (currentSort.column === column) {
    currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
  } else {
    currentSort.column = column;
    currentSort.direction = 'asc';
  }
  
  // Ordenar las órdenes
  sortOrders(currentSort.column, currentSort.direction);
  
  // Actualizar iconos
  updateSortIcons(currentSort.column, currentSort.direction);
  
  // Re-renderizar tabla
  currentOrderPage = 1;
  renderOrders();
});

// Inicializar el buscador cuando se carga la página
document.addEventListener('DOMContentLoaded', () => {
  initializeOrdersSearch();
});
