// public/js/orders.js
import { qs, showNotification } from './utils.js';

let orders = {};

function slugifyPath(text) {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export async function initOrdersScript() {
  const section = document.getElementById('OrderSection');
  const basePath = section?.dataset?.basePath || '/admin';
  const clientsPath = section?.dataset?.clientsPath || `${basePath}/clients`;
  const documentsPath = section?.dataset?.documentsPath || `${clientsPath}/documents/view`;
  // Usar traducciones ya cargadas por Astro
  const translations = window.translations || {};
  orders = translations.orders || {};
  
  // Verificar que todos los elementos necesarios existan
  const searchInput = qs('searchInput');
  const itemsPerPageSelect = qs('itemsPerPageSelect');
  const prevPageBtn = qs('prevPageBtn');
  const nextPageBtn = qs('nextPageBtn');
  const pageIndicator = qs('pageIndicator');
  const tableBody = qs('ordersTableBody');
  const exportBtn = qs('exportExcelBtn');
  
  // Verificar que los elementos críticos existan
  if (!tableBody || !searchInput || !itemsPerPageSelect || !prevPageBtn || !nextPageBtn || !pageIndicator) {
    console.error('Elementos necesarios no encontrados para el paginador');
    return;
  }
  
  try {
    const storedOrderSearchFilter = localStorage.getItem('ordersSearchFilter');
    if (storedOrderSearchFilter) {
      searchInput.value = storedOrderSearchFilter;
      localStorage.removeItem('ordersSearchFilter');
    }
  } catch (error) {
    console.warn('No se pudo restaurar filtro de �rdenes:', error);
  }
  
  // Verificar elementos necesarios (sin botón de refresh)

  // Variables de estado
  let allOrders = [];
  let filteredOrders = [];
  let currentPage = 1;
  let itemsPerPage = parseInt(itemsPerPageSelect.value, 10);
  let currentSort = { column: 'fecha', direction: 'desc' };
  const pageStorageKey = 'adminOrdersCurrentPage';
  const getNavigationType = () => {
    const navEntry = performance.getEntriesByType('navigation')[0];
    if (navEntry && navEntry.type) return navEntry.type;
    if (performance.navigation) {
      return performance.navigation.type === 1 ? 'reload' : 'navigate';
    }
    return 'navigate';
  };
  const navType = getNavigationType();
  let restorePage = false;
  if (navType === 'reload') {
    sessionStorage.removeItem(pageStorageKey);
  } else if (navType === 'back_forward') {
    const storedPage = parseInt(sessionStorage.getItem(pageStorageKey), 10);
    if (storedPage && storedPage > 1) {
      currentPage = storedPage;
      restorePage = true;
    }
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
        ${orders.loading || 'Cargando...'}
      </div>
    `;
    loadingRow.innerHTML = buildCenteredCell(loadingMarkup);
  }

  function setupStickyHorizontalScrollbar() {
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
  }

  // Función para formatear fechas
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

  // Función para renderizar una fila de orden
  function renderOrderRow(order) {
    const customerRut = order.customer_rut || order.customer_uuid || '';
    const pcValue = order.pc || '';
    const ocValue = order.oc || order.orderNumber || '';
    const companyValue = order.customer_name || '';
    const facturaValue = order.factura ?? '';
    const isSellerView = basePath.startsWith('/seller');
    const documentUrl = isSellerView
      ? `${documentsPath}/${encodeURIComponent(customerRut)}?pc=${encodeURIComponent(pcValue)}&oc=${encodeURIComponent(ocValue)}&c=${encodeURIComponent(companyValue)}&factura=${encodeURIComponent(facturaValue)}`
      : `${documentsPath}/${encodeURIComponent(customerRut)}/${encodeURIComponent(pcValue)}/${slugifyPath(ocValue)}/${slugifyPath(companyValue)}/${encodeURIComponent(facturaValue)}`;
    const shippingMethod = (!order.factura || order.factura === 0 || order.factura === '0')
      ? (order.medio_envio_ov || '-')
      : (order.medio_envio_factura || '-');
    const documentCount = order.document_count || 0;
    const documentTypes = order.document_types || [];
    
    // Determinar el color del icono según los documentos
    // IDs: All Documents=18, Order Delivery Notice=15, Availability Notice=6, Shipment Notice=19, Order Receipt Notice=9
    const hasAllDocuments = documentTypes.includes(18);
    const hasOrderReceipt = documentTypes.includes(9);
    const hasShipment = documentTypes.includes(19);
    const hasDelivery = documentTypes.includes(15);
    const hasAvailability = documentTypes.includes(6);
    
    let iconColorClass = '';
    if (documentCount === 0) {
      // Rojo: sin documentos
      iconColorClass = 'text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300';
    } else if (hasAllDocuments && (hasOrderReceipt || (hasShipment && hasDelivery && hasAvailability))) {
      // Verde: tiene All Documents + documentos por defecto
      iconColorClass = 'text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300';
    } else if (hasOrderReceipt || (hasShipment && hasDelivery && hasAvailability)) {
      // Amarillo: solo tiene documentos por defecto
      iconColorClass = 'text-yellow-500 dark:text-yellow-400 hover:text-yellow-600 dark:hover:text-yellow-300';
    } else {
      // Gris: tiene documentos pero no cumple las condiciones
      iconColorClass = 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200';
    }
    
    return `
      <tr data-id="${order.id}" class="hover:shadow-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition bg-white dark:bg-gray-900">
        <td class="px-6 py-4 items-center gap-3 border-b border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">
          <div class="flex items-center gap-2">
            <a href="${documentUrl}" 
              class="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline">
              <span>${order.pc || '-'}</span>
            </a>
            <a href="${documentUrl}" 
               class="relative inline-flex items-center"
               data-tooltip="${orders.tooltipDocumentCount}"
               aria-label="${orders.tooltipDocumentCount}">
              <svg class="w-5 h-5 ${iconColorClass} transition" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              <span class="absolute -top-1 -right-1 text-xs font-bold ${iconColorClass}">${documentCount}</span>
            </a>
          </div>
        </td>
        <td class="px-6 py-4 items-center gap-3 border-b border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">${order.oc || '-'}</td>
        <td class="px-4 py-3 break-all border-b border-gray-200 dark:border-gray-800">
          <a href="#" class="customer-name-btn text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline" 
                  data-customer-name="${order.customer_name || ''}">
            ${order.customer_name || '-'}
          </a>
        </td>
        <td class="px-6 py-4 items-center gap-3 border-b border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">${formatDateShort(order.fecha_ingreso || order.fecha)}</td>
        <td class="px-6 py-4 items-center gap-3 border-b border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">
          ${shippingMethod}
        </td>
        <td class="px-6 py-4 items-center gap-3 border-b border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">${order.factura || '-'}</td>
        <td class="px-6 py-4 items-center gap-3 border-b border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">${formatDateShort(order.fecha_factura)}</td>
        <td class="px-6 py-4 items-center gap-3 border-b border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">${formatDateShort(order.fecha_etd)}</td>
        <td class="px-6 py-4 items-center gap-3 border-b border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">${formatDateShort(order.fecha_eta)}</td>
        <td class="px-6 py-4 items-center gap-3 border-b border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">${formatDateShort(order.fecha_etd_factura)}</td>
        <td class="px-6 py-4 items-center gap-3 border-b border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">${formatDateShort(order.fecha_eta_factura)}</td>
        <td class="px-6 py-4 items-center gap-3 border-b border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">${order.incoterm || '-'}</td>
        <td class="px-6 py-4 items-center gap-3 border-b border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">${order.puerto_destino || '-'}</td>
        <td class="px-6 py-4 items-center gap-3 border-b border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">
          <a href="${documentUrl}" 
             class="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline">
            ${orders.viewDocuments}
          </a>
        </td>
        <td class="sticky right-0 bg-gray-50 dark:bg-gray-700 z-10 px-6 py-4 min-w-[120px] overflow-visible">
          <div class="flex justify-center gap-3 relative">
            <!-- Ver lista de items -->
            <div class="relative">
              <a href="#" class="items-list-btn text-gray-900 dark:text-white hover:text-green-500 dark:hover:text-green-400 transition"
                 data-order-pc="${order.pc}" data-order-oc="${order.oc}" data-factura="${order.factura}"
                 data-tooltip="${orders.tooltipViewItemsDetailed}"
                 aria-label="${orders.tooltipViewItemsDetailed}">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16"/>
                </svg>
              </a>
            </div>

            <!-- Ver items en modal (tabla expandida) -->
            <div class="relative">
              <a href="#" class="items-detail-modal-btn text-gray-900 dark:text-white hover:text-green-500 dark:hover:text-green-400 transition"
                 data-order-pc="${order.pc}" data-order-oc="${order.oc}" data-factura="${order.factura}"
                 data-tooltip="${orders.tooltipViewItems}"
                 aria-label="${orders.tooltipViewItems}">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>
                </svg>
              </a>
            </div>

            <!-- Ver detalles de orden -->
            <div class="relative">
              <a href="#" class="order-detail-btn text-gray-900 dark:text-white hover:text-green-500 dark:hover:text-green-400 transition"
                 data-order-id="${order.id}" data-order-pc="${order.pc}" data-order-oc="${order.oc}"
                 data-tooltip="${orders.tooltipOrderDetails}"
                 aria-label="${orders.tooltipOrderDetails}">
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

  // Función para cargar y renderizar órdenes
  async function loadAndRenderOrders() {
    try {
      // Cargar datos usando el caché
      allOrders = await loadOrdersWithCache();
      filteredOrders = [...allOrders];
      
      // Remover la fila de carga
      const loadingRow = document.getElementById('loadingRow');
      if (loadingRow) {
        loadingRow.remove();
      }
      
      // Renderizar la tabla
      renderTable();
      setupStickyHorizontalScrollbar();
      
      // Aplicar filtro automáticamente si hay valor en el buscador
      if (searchInput && searchInput.value.trim()) {
        filterRows({ preservePage: restorePage });
      }
      
      // Configurar event listeners para los modales
      setupModalEventListeners();
      
    } catch (error) {
      console.error('Error cargando órdenes:', error);
      
      // Mostrar mensaje de error
      const loadingRow = document.getElementById('loadingRow');
      if (loadingRow) {
        loadingRow.innerHTML = buildCenteredCell(
          `${orders.loadError} <button onclick="location.reload()" class="text-blue-500 hover:underline">${orders.retry}</button>`,
          'text-red-500'
        );
      }
    }
  }

  /**
   * Función principal de render de la tabla según búsqueda y paginación.
   * Renderiza las filas correspondientes a la página actual.
   */
  function renderTable() {
    const start = (currentPage - 1) * itemsPerPage;
    const pageData = filteredOrders.slice(start, start + itemsPerPage);
    
    // Limpiar tabla
    hideFloatingTooltip();
    tableBody.innerHTML = '';
    
    // Renderizar filas de la página actual
    pageData.forEach(order => {
      const rowHtml = renderOrderRow(order);
      tableBody.insertAdjacentHTML('beforeend', rowHtml);
      
      // Agregar data-order-id al último elemento insertado
      const lastRow = tableBody.lastElementChild;
      if (lastRow) {
        lastRow.setAttribute('data-order-id', order.id);
      }
    });
    
    
    // Si no hay datos, mostrar mensaje
    if (pageData.length === 0) {
      tableBody.innerHTML = `
        <tr class="bg-white dark:bg-gray-900">
          ${buildCenteredCell(orders.noResults || 'No se encontraron órdenes')}
        </tr>
      `;
    }

    const totalPages = Math.max(1, Math.ceil(filteredOrders.length / itemsPerPage));
    if (currentPage > totalPages) {
      currentPage = totalPages;
    } else if (currentPage < 1) {
      currentPage = 1;
    }
    sessionStorage.setItem(pageStorageKey, String(currentPage));
    // Usar las traducciones de orders
    let pageLabel = orders.pageIndicator || 'Page';
    let ofLabel = orders.pageIndicatorSeparator || 'of';
    pageIndicator.textContent = `${pageLabel} ${currentPage} ${ofLabel} ${totalPages}`;

    setupFloatingTooltips(tableBody);
  }

  /**
   * Función para obtener el valor de una celda para ordenamiento
   */
  function getCellValue(row, columnIndex) {
    const cell = row.cells[columnIndex];
    if (!cell) return '';
    
    let value = cell.textContent.trim();
    
    return value.toLowerCase();
  }

  /**
   * Función para ordenar las órdenes
   */
  function sortRows(column, direction) {
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

    const getComparableValue = (order) => {
      switch (column) {
        case 'pc':
          return order.pc ?? '';
        case 'oc':
          return order.oc ?? '';
        case 'customer_name':
          return order.customer_name ?? '';
        case 'fecha':
          return order.fecha_ingreso ?? order.fecha ?? '';
        case 'medio_envio_factura':
          return (!order.factura || order.factura === 0 || order.factura === '0')
            ? (order.medio_envio_ov ?? '')
            : (order.medio_envio_factura ?? '');
        case 'factura':
          return order.factura ?? '';
        case 'fecha_factura':
          return order.fecha_factura ?? '';
        case 'fecha_etd':
          return order.fecha_etd ?? '';
        case 'fecha_eta':
          return order.fecha_eta ?? '';
        case 'fecha_etd_factura':
          return order.fecha_etd_factura ?? '';
        case 'fecha_eta_factura':
          return order.fecha_eta_factura ?? '';
        default:
          return '';
      }
    };

    filteredOrders.sort((aOrder, bOrder) => {
      const rawA = getComparableValue(aOrder);
      const rawB = getComparableValue(bOrder);

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

      const aValue = rawA.toString().toLowerCase();
      const bValue = rawB.toString().toLowerCase();

      const aEmpty = !aValue;
      const bEmpty = !bValue;
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
   * Buscador dinámico: filtra las órdenes según el texto ingresado.
   */
  function filterRows(options = {}) {
    const { preservePage = false } = options;
    const query = searchInput.value.toLowerCase();
    
    filteredOrders = allOrders.filter(order => {
      // Filtro por búsqueda de texto en múltiples campos
      const searchableText = [
        order.pc || '',
        order.oc || '',
        order.customer_name || '',
        order.medio_envio_factura || '',
        order.medio_envio_ov || '',
        order.factura || '',
        order.fecha_etd || '',
        order.fecha_eta || '',
        order.fecha_etd_factura || '',
        order.fecha_eta_factura || '',
        order.fecha_factura || '',
        order.incoterm || '',
        order.puerto_destino || '',
        order.certificados || ''
      ].join(' ').toLowerCase();
      
      const matchesSearch = searchableText.includes(query);
      
      return matchesSearch;
    });
    
    // Aplicar ordenamiento actual si existe
    if (currentSort.column) {
      sortRows(currentSort.column, currentSort.direction);
    }
    
    if (!preservePage) {
      currentPage = 1;
    }
    renderTable();
  }

  /**
   * Buscador dinámico: filtra las filas según el texto ingresado.
   */
  searchInput.addEventListener('input', () => filterRows({ preservePage: false }));

  const filterOpenOrdersCheckbox = document.getElementById('filterOpenOrders');

  /**
   * Event listeners para ordenamiento de columnas
   */
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
    
    // Ordenar las filas
    sortRows(currentSort.column, currentSort.direction);
    
    // Actualizar iconos
    updateSortIcons(currentSort.column, currentSort.direction);
    
    // Re-renderizar tabla
    currentPage = 1;
    renderTable();
  });

  /**
   * Función para exportar tabla a Excel
   */
  function exportToExcel() {
    // Obtener las órdenes filtradas actuales
    const ordersToExport = filteredOrders.length > 0 ? filteredOrders : allOrders;
    
    if (ordersToExport.length === 0) {
      showNotification(orders.exportEmpty, 'warning');
      return;
    }

    // Definir los encabezados de las columnas
    const labelPc = orders.name;
    const labelOrder = orders.oc;
    const labelCustomer = translations?.clientes?.client_name;
    const labelEntryDate = orders.fechaIngreso;
    const labelShippingMethod = orders.shippingMethod;
    const labelInvoice = orders.factura;
    const labelInvoiceDate = orders.fechaFactura;
    const labelEtdOv = orders.etdOv;
    const labelEtaOv = orders.etaOv;
    const labelEtdFactura = orders.etdFactura;
    const labelEtaFactura = orders.etaFactura;
    const labelIncoterm = orders.incoterm;
    const labelDestinationPort = orders.puertoDestino;
    const labelDocuments = orders.documents;

    const headers = [
      labelPc,
      labelOrder,
      labelCustomer,
      labelEntryDate,
      labelShippingMethod,
      labelInvoice,
      labelInvoiceDate,
      labelEtdOv,
      labelEtaOv,
      labelEtdFactura,
      labelEtaFactura,
      labelIncoterm,
      labelDestinationPort,
      labelDocuments
    ];

    // Preparar los datos para exportar
    const data = ordersToExport.map(order => {
      const customerRut = order.customer_rut || order.customer_uuid || '';
      const pcValue = order.pc || '';
      const ocValue = order.oc || order.orderNumber || '';
      const companyValue = order.customer_name || '';
      const documentUrl = `${documentsPath}/${encodeURIComponent(customerRut)}/${encodeURIComponent(pcValue)}/${slugifyPath(ocValue)}/${slugifyPath(companyValue)}`;
      const shippingMethod = (!order.factura || order.factura === 0 || order.factura === '0')
        ? (order.medio_envio_ov || '')
        : (order.medio_envio_factura || '');

      return [
        order.pc || '', // N° PC
        order.oc || '', // Order
        order.customer_name || '', // Customer Name
        formatDateShort(order.fecha_ingreso || order.fecha) || '', // Entry Date
        shippingMethod, // Shipping Method
        order.factura || '', // Invoice
        formatDateShort(order.fecha_factura) || '', // Invoice Date
        formatDateShort(order.fecha_etd) || '', // ETD OV
        formatDateShort(order.fecha_eta) || '', // ETA OV
        formatDateShort(order.fecha_etd_factura) || '', // ETD Invoice
        formatDateShort(order.fecha_eta_factura) || '', // ETA Invoice
        order.incoterm || '', // Incoterm
        order.puerto_destino || '', // Destination Port
        documentUrl // Documents
      ];
    });

    // Crear el contenido con formato Excel compatible
    // Agregar BOM UTF-8 para que Excel reconozca la codificación
    const BOM = '\uFEFF';
    
    // Usar punto y coma como separador (más compatible con Excel)
    const csvContent = BOM + [
      headers.join(';'),
      ...data.map(row => row.map(cell => {
        // Escapar comillas dobles y envolver en comillas si contiene punto y coma
        const escapedCell = cell.replace(/"/g, '""');
        return cell.includes(';') ? `"${escapedCell}"` : escapedCell;
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
    link.download = `ordenes_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    // Mostrar notificación de éxito
    showNotification(`Se exportaron ${ordersToExport.length} órdenes a Excel`, 'success');
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
    const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
    if (currentPage < totalPages) {
      currentPage++;
      renderTable();
    }
  });

  // Event listener para el botón de exportar
  if (exportBtn) {
    exportBtn.addEventListener('click', exportToExcel);
  }
  
  // Auto-refresh sin botón manual

  // Función para refrescar datos
  async function refreshData() {
    try {
      // Limpiar cache y recargar datos
      clearCache();
      allOrders = await loadOrdersWithCache();
      filteredOrders = [...allOrders];
      
      // Limpiar el campo de búsqueda
      searchInput.value = '';
      
      // Resetear a la primera página
      currentPage = 1;
      
      // Re-renderizar la tabla
      renderTable();
      
      // Mostrar notificación de éxito
      showNotification(orders.refreshSuccess, 'success');
      
      // Cache actualizado automáticamente
      
    } catch (error) {
      console.error('Error refrescando datos:', error);
      showNotification(orders.refreshError, 'error');
    }
  }

  // Auto-refresh cuando el caché expire
  function setupAutoRefresh() {
    const checkCacheExpiry = () => {
      if (!isCacheValid()) {
        refreshData();
      }
    };

    // Verificar cada 30 minutos si el caché ha expirado
    setInterval(checkCacheExpiry, 30 * 60 * 1000);
  }

  // Inicializar auto-refresh
  setupAutoRefresh();

  // Event listener para búsqueda
  searchInput.addEventListener('input', () => filterRows({ preservePage: false }));
  
  // Event listener para navegación (atrás/adelante)
  window.addEventListener('popstate', () => {
    if (searchInput && searchInput.value.trim()) {
      filterRows({ preservePage: true });
    }
  });
  
  // Event listener para recarga de página
  window.addEventListener('pageshow', () => {
    if (searchInput && searchInput.value.trim()) {
      filterRows({ preservePage: true });
    }
  });


  // Función eliminada - ya no se necesita mostrar estado del cache
  
  // Cargar y renderizar órdenes inicialmente
  loadAndRenderOrders().then(() => {
    filterRows({ preservePage: restorePage });
  });
  
  // Cache inicializado automáticamente

  // Función para navegar a clientes con filtro aplicado
  function navigateToClientsWithFilter(customerName) {
    try {
      // Guardar el nombre del cliente en localStorage para que clients.js lo pueda leer
      localStorage.setItem('clientSearchFilter', customerName);
      
      // Navegar a la página de clientes
      window.location.href = clientsPath;
      
    } catch (error) {
      console.error('Error navegando a clientes:', error);
      showNotification('Error al navegar a la página de clientes', 'error');
    }
  }

  // Función para configurar los event listeners de los modales
  function setupModalEventListeners() {
    // Event listener para nombre del cliente
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
        const orderOc = detailBtn.dataset.orderOc;
        openOrderDetailModal(orderId, orderOc);
      }
    });

    // Event listeners para cerrar modales
    const closeItemsModalBtn = document.getElementById('closeItemsModalBtn');
    const closeItemsDetailModalBtn = document.getElementById('closeItemsDetailModalBtn');
    const closeOrderDetailModalBtn = document.getElementById('closeOrderDetailModalBtn');
    const itemsModal = document.getElementById('itemsModal');
    const itemsDetailModal = document.getElementById('itemsDetailModal');
    const orderDetailModal = document.getElementById('orderDetailModal');

    if (closeItemsModalBtn) {
      closeItemsModalBtn.addEventListener('click', () => {
        itemsModal.classList.add('hidden');
        itemsModal.classList.remove('flex');
      });
    }

    if (closeItemsDetailModalBtn) {
      closeItemsDetailModalBtn.addEventListener('click', () => {
        itemsDetailModal.classList.add('hidden');
        itemsDetailModal.classList.remove('flex');
      });
    }

    if (closeOrderDetailModalBtn) {
      closeOrderDetailModalBtn.addEventListener('click', () => {
        orderDetailModal.classList.add('hidden');
      });
    }

    // Cerrar modales al hacer click fuera
    if (itemsModal) {
      itemsModal.addEventListener('click', (e) => {
        if (e.target === itemsModal) {
          itemsModal.classList.add('hidden');
          itemsModal.classList.remove('flex');
        }
      });
    }

    if (itemsDetailModal) {
      itemsDetailModal.addEventListener('click', (e) => {
        if (e.target === itemsDetailModal) {
          itemsDetailModal.classList.add('hidden');
          itemsDetailModal.classList.remove('flex');
        }
      });
    }

    if (orderDetailModal) {
      orderDetailModal.addEventListener('click', (e) => {
        if (e.target === orderDetailModal) {
          orderDetailModal.classList.add('hidden');
        }
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (itemsModal) {
        itemsModal.classList.add('hidden');
        itemsModal.classList.remove('flex');
      }
      if (itemsDetailModal) {
        itemsDetailModal.classList.add('hidden');
        itemsDetailModal.classList.remove('flex');
      }
      if (orderDetailModal) {
        orderDetailModal.classList.add('hidden');
      }
      const documentCountHelpModal = document.getElementById('documentCountHelpModal');
      if (documentCountHelpModal) {
        documentCountHelpModal.classList.add('hidden');
        documentCountHelpModal.classList.remove('flex');
      }
    });

    // Event listeners para modal de ayuda de contador de documentos
    const documentCountHelpBtn = document.getElementById('documentCountHelpBtn');
    const documentCountHelpModal = document.getElementById('documentCountHelpModal');
    const closeDocumentCountHelpModalBtn = document.getElementById('closeDocumentCountHelpModalBtn');
    const closeDocumentCountHelpModalFooterBtn = document.getElementById('closeDocumentCountHelpModalFooterBtn');

    if (documentCountHelpBtn && documentCountHelpModal) {
      documentCountHelpBtn.addEventListener('click', () => {
        documentCountHelpModal.classList.remove('hidden');
        documentCountHelpModal.classList.add('flex');
      });
    }

    if (closeDocumentCountHelpModalBtn && documentCountHelpModal) {
      closeDocumentCountHelpModalBtn.addEventListener('click', () => {
        documentCountHelpModal.classList.add('hidden');
        documentCountHelpModal.classList.remove('flex');
      });
    }

    if (closeDocumentCountHelpModalFooterBtn && documentCountHelpModal) {
      closeDocumentCountHelpModalFooterBtn.addEventListener('click', () => {
        documentCountHelpModal.classList.add('hidden');
        documentCountHelpModal.classList.remove('flex');
      });
    }

    if (documentCountHelpModal) {
      documentCountHelpModal.addEventListener('click', (e) => {
        if (e.target === documentCountHelpModal) {
          documentCountHelpModal.classList.add('hidden');
          documentCountHelpModal.classList.remove('flex');
        }
      });
    }
  }

}
// Función para abrir el modal de items
async function openItemsModal(orderPc, orderOc, factura) {
  const itemsModal = document.getElementById('itemsModal');
  const itemsOrderTitle = document.getElementById('itemsOrderTitle');
  const itemsCustomerName = document.getElementById('itemsCustomerName');
  const itemsTableBody = document.getElementById('itemsTableBody');
  const totalItems = document.getElementById('totalItems');
  const totalQuantity = document.getElementById('totalQuantity');
  const totalValue = document.getElementById('totalValue');
  const totalGastoAdicional = document.getElementById('totalGastoAdicional');

  if (!itemsModal || !itemsOrderTitle || !itemsTableBody) return;

  itemsModal.classList.remove('hidden');
  itemsModal.classList.add('flex');
  itemsOrderTitle.textContent = `${orders.order}: ${orderOc || '-'}`;
  if (itemsCustomerName) {
    itemsCustomerName.textContent = `${orders.cliente}: -`;
  }


  const itemsOrderSubtitle = document.getElementById('itemsOrderSubtitle');
  if (itemsOrderSubtitle) itemsOrderSubtitle.textContent = orders.itemsList;
  if (itemsTableBody) {
    itemsTableBody.innerHTML = buildLoadingRow(5);
  }
  if (totalItems) totalItems.textContent = '-';
  if (totalQuantity) totalQuantity.textContent = '-';
  if (totalValue) totalValue.textContent = '-';
  if (totalGastoAdicional) totalGastoAdicional.textContent = '-';

  try {
    // Cargar items de la orden usando endpoint diferente según si tiene factura o no
    const token = localStorage.getItem('token');
    const section = document.getElementById('OrderSection');
    const datasetApiBase = section?.dataset?.apiBase;
    const apiBase = window.apiBase || datasetApiBase;

    const safeOrderOc = orderOc ? encodeURIComponent(orderOc) : '';
    const facturaValue = factura === undefined || factura === null ? '' : String(factura).trim();
    const hasFacturaRequest = facturaValue !== '' && facturaValue !== 'null' && facturaValue !== '0'; // para endpoint
    const hasFacturaDisplay = facturaValue !== '' && facturaValue !== 'null' && facturaValue !== '0'; // para labels/cálculos
    const safeFactura = hasFacturaRequest ? encodeURIComponent(facturaValue) : '';

    // Ajustar header de cantidad según tenga factura o no (i18n fallbacks)
    const quantityHeader = itemsModal.querySelector('[data-column="quantity"]');
    if (quantityHeader) {
      const qtyHeaderText = hasFacturaDisplay
        ? orders.kgFacturados
        : orders.kgSolicitados;
      quantityHeader.textContent = qtyHeaderText;
    }
    
    // Usar endpoint diferente según si tiene factura o no
    const url = hasFacturaRequest
      ? `${apiBase}/api/orders/${orderPc}/${safeOrderOc}/${safeFactura}/items`
      : `${apiBase}/api/orders/${orderPc}/${safeOrderOc}/items`;
    
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) {
      throw new Error(orders.itemsLoadError);
    }

    const items = await response.json();
    const normalizedItems = Array.isArray(items) ? items : [];
    
    // Actualizar header del modal
    document.getElementById('itemsInitials').textContent = 'IT';
    document.getElementById('itemsOrderTitle').textContent = `${orders.order}: ${orderOc}`;
    document.getElementById('itemsCustomerName').textContent = `${orders.cliente}: ${normalizedItems[0]?.customer_name || '-'}`;
    document.getElementById('itemsOrderSubtitle').textContent = orders.itemsList;
    
    const parseNumber = (value, fallback = 0) => {
      if (value === null || value === undefined) return fallback;
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value === 'string') {
        const normalized = value.replace(/\s+/g, '').replace(',', '.');
        const number = Number(normalized);
        return Number.isFinite(number) ? number : fallback;
      }
      const number = Number(value);
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

    // Renderizar tabla de items
    if (itemsTableBody) {
      const currency = normalizedItems[0]?.currency || 'CLP';

      if (normalizedItems.length === 0) {
        itemsTableBody.innerHTML = `
          <tr>
            <td colspan="5" class="px-6 py-4 text-center text-xs text-gray-500 dark:text-gray-400">
              ${orders.noItemsFound}
            </td>
          </tr>
        `;
      } else {
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
      }
    }

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

    const currency = (normalizedItems[0]?.currency) || 'CLP';
    const unit = (normalizedItems[0]?.unidad_medida) || 'KG';
    const rawGastoAdicionalFactura = normalizedItems[0]?.gasto_adicional_flete_factura;
    const shouldUseFacturaExpense = hasFacturaDisplay && rawGastoAdicionalFactura !== null && rawGastoAdicionalFactura !== undefined && rawGastoAdicionalFactura !== '';
    const rawGastoAdicional = shouldUseFacturaExpense ? rawGastoAdicionalFactura : normalizedItems[0]?.gasto_adicional_flete;
    
    console.log('[Additional Cost Debug - Orders]', {
      hasFacturaDisplay,
      factura: facturaValue,
      gasto_adicional_flete: normalizedItems[0]?.gasto_adicional_flete,
      gasto_adicional_flete_factura: rawGastoAdicionalFactura,
      shouldUseFacturaExpense,
      rawGastoAdicional,
      finalValue: parseNumber(rawGastoAdicional)
    });
    
    const gastoAdicional = parseNumber(rawGastoAdicional);
    
    // Add additional cost to total value
    const totalValueWithAdditional = totalValueSum + gastoAdicional;
    
    if (totalItems) totalItems.textContent = totalItemsCount;
    if (totalQuantity) totalQuantity.textContent = formatModalQuantity(totalQuantitySum, unit);
    if (totalValue) totalValue.textContent = formatCurrency(totalValueWithAdditional, currency);
    if (totalGastoAdicional) totalGastoAdicional.textContent = formatCurrency(gastoAdicional, currency);

  } catch (error) {
    console.error('Error loading order items:', error);
    showNotification(orders.itemsLoadError, 'error');
  }
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
  const numericAmount = Number(typeof amount === 'string' ? amount.replace(',', '.') : amount);
  const safeAmount = Number.isFinite(numericAmount) ? numericAmount : 0;
  const formattedAmount = safeAmount.toLocaleString('es-CL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  
  return `${mappedCurrency} ${formattedAmount}`;
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

function buildItemsDetailTable(items, currency) {
  return `
    <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
      <thead class="bg-gray-100 dark:bg-gray-800 sticky top-0 z-10">
        <tr>
          <th class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">${orders.itemCode}</th>
          <th class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">${orders.itemName}</th>
          <th class="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">${orders.tipo}</th>
          <th class="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">${orders.kgSolicitados}</th>
          <th class="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">${orders.kgDespachados}</th>
          <th class="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">${orders.kgFacturados}</th>
          <th class="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">${orders.fechaEtd}</th>
          <th class="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">${orders.fechaEta}</th>
          <th class="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">${orders.precioUnitario}</th>
          <th class="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">${orders.total}</th>
        </tr>
      </thead>
      <tbody class="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800 text-xs">
        ${items.map(item => {
          const quantity = parseFloat(item.kg_solicitados) || 0;
          const unitPrice = parseFloat(item.unit_price) || 0;
          const total = quantity * unitPrice;

          return `
            <tr class="hover:bg-gray-50 dark:hover:bg-gray-600 transition">
              <td class="px-6 py-4 text-xs text-gray-900 dark:text-gray-100">${item.item_code || '-'}</td>
              <td class="px-6 py-4 text-xs text-gray-900 dark:text-gray-100">${item.item_name || '-'}</td>
              <td class="px-6 py-4 text-xs text-center text-gray-900 dark:text-gray-100">${item.tipo || '-'}</td>
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

function buildLoadingRow(colspan, message) {
  const safeMessage = message || orders.loading;
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

async function openItemsDetailModal(orderPc, orderOc, factura) {
  const detailModal = document.getElementById('itemsDetailModal');
  const detailTitle = document.getElementById('itemsDetailTitle');
  const detailCustomerName = document.getElementById('itemsDetailCustomerName');
  const detailContainer = document.getElementById('itemsDetailTableContainer');
  if (!detailModal || !detailContainer) return;

  if (detailTitle) {
    detailTitle.textContent = `${orders.itemsDetailTitle} ${factura || '-'}`;
  }
  if (detailCustomerName) {
    detailCustomerName.textContent = `${orders.cliente}: -`;
  }
  detailContainer.innerHTML = `
    <div class="bg-white dark:bg-gray-700 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead class="bg-gray-100 dark:bg-gray-800 sticky top-0 z-10">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">${orders.itemCode}</th>
              <th class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">${orders.itemName}</th>
              <th class="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">${orders.tipo}</th>
              <th class="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">${orders.kgSolicitados}</th>
              <th class="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">${orders.kgDespachados}</th>
              <th class="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">${orders.kgFacturados}</th>
              <th class="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">${orders.fechaEtd}</th>
              <th class="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">${orders.fechaEta}</th>
              <th class="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">${orders.precioUnitario}</th>
              <th class="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">${orders.total}</th>
            </tr>
          </thead>
          <tbody class="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800 text-xs">
            ${buildLoadingRow(10)}
          </tbody>
        </table>
      </div>
    </div>
  `;
  detailModal.classList.remove('hidden');
  detailModal.classList.add('flex');

  try {
    const token = localStorage.getItem('token');
    const section = document.getElementById('OrderSection');
    const datasetApiBase = section?.dataset?.apiBase;
    const apiBase = window.apiBase || datasetApiBase;
    const safeOrderOc = orderOc ? encodeURIComponent(orderOc) : '';
    const facturaValue = factura === undefined || factura === null ? '' : String(factura).trim();
    const hasFacturaRequest = facturaValue !== '' && facturaValue !== 'null' && facturaValue !== '0';
    const safeFactura = hasFacturaRequest ? encodeURIComponent(facturaValue) : '';
    const url = hasFacturaRequest
      ? `${apiBase}/api/orders/${orderPc}/${safeOrderOc}/${safeFactura}/items`
      : `${apiBase}/api/orders/${orderPc}/${safeOrderOc}/items`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) {
      throw new Error(orders.itemsLoadError);
    }

    const items = await response.json();
    const currency = items[0]?.currency || 'CLP';
    if (detailCustomerName) {
      detailCustomerName.textContent = `${orders.cliente}: ${items[0]?.customer_name || '-'}`;
    }
    if (detailTitle) {
      detailTitle.textContent = `${orders.itemsDetailTitle} ${factura || '-'}`;
    }
    detailContainer.innerHTML = `
      <div class="bg-white dark:bg-gray-700 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600">
        <div class="overflow-x-auto">
          ${buildItemsDetailTable(items, currency)}
        </div>
      </div>
    `;
    detailModal.classList.remove('hidden');
    detailModal.classList.add('flex');
  } catch (error) {
    console.error('Error cargando items para modal:', error);
    showNotification(orders.itemsLoadError, 'error');
  }
}

// Función para abrir el modal de detalles de orden
async function openOrderDetailModal(orderId, orderOc) {
  const orderDetailModal = document.getElementById('orderDetailModal');
  const orderDetailTitle = document.getElementById('orderDetailTitle');
  const orderDetailPc = document.getElementById('orderDetailPc');
  const orderDetailOc = document.getElementById('orderDetailOc');
  const orderDetailDireccionDestino = document.getElementById('orderDetailDireccionDestino');
  const orderDetailPuertoDestino = document.getElementById('orderDetailPuertoDestino');

  if (!orderDetailModal || !orderDetailTitle) return;

  // Actualizar título
  orderDetailTitle.textContent = `PC ${orderOc} - ${orders.orderDetails}`;
  orderDetailModal.classList.remove('hidden');
  orderDetailModal.classList.add('flex');
  orderDetailPc.textContent = orders.loading;
  orderDetailOc.textContent = orders.loading;
  orderDetailDireccionDestino.textContent = orders.loading;
  orderDetailPuertoDestino.textContent = orders.loading;
  let orderDetailObservaciones = document.getElementById('orderDetailObservaciones');
  if (orderDetailObservaciones) {
    orderDetailObservaciones.textContent = orders.loading;
  }

  try {
    // Cargar detalles de la orden
    const token = localStorage.getItem('token');
    const response = await fetch(`${apiBase}/api/orders/${encodeURIComponent(orderId)}/detail`, {
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
    orderDetailDireccionDestino.textContent = orderDetail.direccion_destino || '-';
    orderDetailPuertoDestino.textContent = orderDetail.puerto_destino || '-';
    
    // Agregar campo de observaciones si existe
    orderDetailObservaciones = document.getElementById('orderDetailObservaciones');
    if (orderDetailObservaciones) {
      orderDetailObservaciones.textContent = orderDetail.u_observaciones || '-';
    }

  } catch (error) {
    console.error('Error cargando detalles de orden:', error);
    
    // Mostrar valores por defecto en caso de error
    orderDetailPc.textContent = '-';
    orderDetailOc.textContent = '-';
    orderDetailDireccionDestino.textContent = '-';
    orderDetailPuertoDestino.textContent = '-';
    
    // Agregar campo de observaciones si existe
    orderDetailObservaciones = document.getElementById('orderDetailObservaciones');
    if (orderDetailObservaciones) {
      orderDetailObservaciones.textContent = '-';
    }
  }
}

// ===== SISTEMA DE CACHÉ =====

// Configuración del caché (5 minutos)
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos en milisegundos
const CACHE_KEY = 'orders_cache';
const CACHE_TIMESTAMP_KEY = 'orders_cache_timestamp';

// Función para verificar si el caché es válido
function isCacheValid() {
  const timestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY);
  if (!timestamp) return false;
  
  const now = Date.now();
  const cacheTime = parseInt(timestamp);
  return (now - cacheTime) < CACHE_DURATION;
}

// Función para guardar datos en caché
function saveToCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    localStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString());
  } catch (error) {
    console.warn('No se pudo guardar en caché:', error);
  }
}

// Función para cargar datos desde caché
function loadFromCache() {
  try {
    const cachedData = localStorage.getItem(CACHE_KEY);
    if (cachedData) {
      return JSON.parse(cachedData);
    }
  } catch (error) {
    console.warn('Error cargando desde caché:', error);
  }
  return null;
}

// Función para limpiar caché
function clearCache() {
  localStorage.removeItem(CACHE_KEY);
  localStorage.removeItem(CACHE_TIMESTAMP_KEY);
}

// Función para cargar datos desde la API con caché
export async function loadOrdersWithCache() {
  try {
    // Primero intentar cargar desde caché
    if (isCacheValid()) {
      const cachedData = loadFromCache();
      if (cachedData) {
        return cachedData;
      }
    }

    const token = localStorage.getItem('token');
    const section = document.getElementById('OrderSection');
    const datasetApiBase = section?.dataset?.apiBase;
    const apiBase = window.apiBase || datasetApiBase;
    
    const response = await fetch(`${apiBase}/api/orders`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const orders = await response.json();
    
    // Guardar en caché
    saveToCache(orders);
    
    return orders;
  } catch (error) {
    console.error('Error cargando órdenes:', error);
    
    // Si hay error en la API, intentar usar caché aunque esté expirado
    const cachedData = loadFromCache();
    if (cachedData) {
      return cachedData;
    }
    
    throw error;
  }
}

// Función para forzar recarga de datos (ignorar caché)
export async function forceReloadOrders() {
  clearCache();
  return await loadOrdersWithCache();
}

// Función para obtener información del caché
export function getCacheInfo() {
  const timestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY);
  if (!timestamp) {
    return { exists: false, age: null, valid: false };
  }
  
  const now = Date.now();
  const cacheTime = parseInt(timestamp);
  const age = now - cacheTime;
  const valid = age < CACHE_DURATION;
  
  return {
    exists: true,
    age: Math.floor(age / 1000), // en segundos
    valid: valid
  };
}
