// public/js/orders.js
import { qs, showNotification } from './utils.js';

export async function initOrdersScript() {
  // Obtener apiBase - usar localhost para JavaScript del cliente
  const apiBase = window.apiBase || section?.dataset.apiBase;
  
  // Usar traducciones ya cargadas por Astro
  const translations = window.translations || {};
  const messages = translations.messages || {};
  const carpetas = translations.carpetas || {};
  
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
  
  // Verificar que el botón de refresh exista
  const refreshCacheBtn = qs('refreshCacheBtn');
  const refreshBtnText = qs('refreshBtnText');
  const cacheStatus = qs('cacheStatus');
  if (!refreshCacheBtn || !refreshBtnText || !cacheStatus) {
    console.error('Elementos del botón de refresh no encontrados');
    return;
  }

  // Variables de estado
  let allOrders = [];
  let filteredOrders = [];
  let currentPage = 1;
  let itemsPerPage = parseInt(itemsPerPageSelect.value, 10);
  let currentSort = { column: null, direction: 'asc' };

  // Función para formatear fechas
  function formatDateShort(dateString) {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch (error) {
      return '-';
    }
  }



  // Función para renderizar una fila de orden
  function renderOrderRow(order) {
    return `
      <tr data-id="${order.id}" class="hover:shadow-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition bg-white dark:bg-gray-900">
        <td class="px-6 py-4 items-center gap-3 border-b border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">${order.pc || '-'}</td>
        <td class="px-6 py-4 items-center gap-3 border-b border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">${order.oc || '-'}</td>
        <td class="px-4 py-3 break-all text-blue-600 dark:text-blue-400 border-b border-gray-200 dark:border-gray-800">${order.customer_name || '-'}</td>
        <td class="px-6 py-4 items-center gap-3 border-b border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">${formatDateShort(order.fecha)}</td>
        <td class="px-6 py-4 items-center gap-3 border-b border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">${order.currency || '-'}</td>
        <td class="px-6 py-4 items-center gap-3 border-b border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">${order.medio_envio_factura || '-'}</td>
        <td class="px-6 py-4 items-center gap-3 border-b border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">${order.factura || '-'}</td>
        <td class="px-6 py-4 items-center gap-3 border-b border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">${formatDateShort(order.fecha_factura)}</td>
        <td class="px-6 py-4 items-center gap-3 border-b border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">${formatDateShort(order.fecha_etd)}</td>
        <td class="px-6 py-4 items-center gap-3 border-b border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">${formatDateShort(order.fecha_eta)}</td>
        <td class="px-6 py-4 items-center gap-3 border-b border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">${order.incoterm || '-'}</td>
        <td class="px-6 py-4 items-center gap-3 border-b border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">${order.puerto_destino || '-'}</td>
        <td class="px-6 py-4 items-center gap-3 border-b border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">${order.certificados || '-'}</td>
        <td class="sticky right-0 bg-gray-50 dark:bg-gray-700 z-10 px-6 py-4 min-w-[120px] overflow-visible">
          <div class="flex justify-center gap-3 relative">
            
            <!-- Ver documentos y archivos -->
            <div class="relative group">
              <a href="/admin/clients/documents/view/${order.customer_uuid}?f=${order.id}&pc=${order.pc}&c=${order.customer_name}"
                 class="go-to-order-btn text-gray-900 dark:text-white hover:text-green-500 transition">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
              </a>
              <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2
                          bg-green-600 text-white text-xs rounded px-2 py-1 shadow-lg
                          opacity-0 group-hover:opacity-100 transition
                          pointer-events-none whitespace-nowrap z-50">
                ${window.translations?.carpetas?.tooltipGoToOrder || 'Ver documentos y archivos'}
              </div>
            </div>

            <!-- Ver lista de items -->
            <div class="relative group">
              <a href="#" class="items-list-btn text-gray-900 dark:text-white hover:text-green-500 transition"
                 data-order-pc="${order.pc}" data-order-oc="${order.oc}" data-factura="${order.factura}">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16"/>
                </svg>
              </a>
              <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2
                          bg-green-600 text-white text-xs rounded px-2 py-1 shadow-lg
                          opacity-0 group-hover:opacity-100 transition
                          pointer-events-none whitespace-nowrap z-50">
                ${window.translations?.carpetas?.tooltipViewItems || 'Ver lista de items'}
              </div>
            </div>

            <!-- Expandir items -->
            <div class="relative group">
              <a href="#" class="expand-items-btn text-gray-900 dark:text-white hover:text-green-500 transition"
                 data-order-pc="${order.pc}" data-order-oc="${order.oc}" data-factura="${order.factura}">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
                </svg>
              </a>
              <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2
                          bg-green-600 text-white text-xs rounded px-2 py-1 shadow-lg
                          opacity-0 group-hover:opacity-100 transition
                          pointer-events-none whitespace-nowrap z-50">
                ${window.translations?.carpetas?.tooltipExpandItems || 'Expandir items en tabla'}
              </div>
            </div>

            <!-- Ver detalles de orden -->
            <div class="relative group">
              <a href="#" class="order-detail-btn text-gray-900 dark:text-white hover:text-green-500 transition"
                 data-order-id="${order.id}" data-order-pc="${order.pc}" data-order-oc="${order.oc}">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </a>
              <div class="absolute bottom-full right-0 mb-2
                          bg-green-600 text-white text-xs rounded px-2 py-1 shadow-lg
                          opacity-0 group-hover:opacity-100 transition
                          pointer-events-none whitespace-nowrap z-50">
                ${window.translations?.carpetas?.tooltipOrderDetails || 'Ver detalles de orden'}
              </div>
            </div>

          </div>
        </td>
      </tr>
    `;
  }

  // Función para cargar y renderizar órdenes
  async function loadAndRenderOrders() {
    try {
      // Cargar datos usando el caché
      allOrders = await loadOrdersWithCache();
      console.log('Órdenes cargadas:', allOrders.length);
      filteredOrders = [...allOrders];
      
      // Remover la fila de carga
      const loadingRow = document.getElementById('loadingRow');
      if (loadingRow) {
        loadingRow.remove();
      }
      
      // Renderizar la tabla
      renderTable();
      
      // Aplicar filtro automáticamente si hay valor en el buscador
      if (searchInput && searchInput.value.trim()) {
        filterRows();
      }
      
      // Configurar event listeners para los modales
      setupModalEventListeners();
      
    } catch (error) {
      console.error('Error cargando órdenes:', error);
      
      // Mostrar mensaje de error
      const loadingRow = document.getElementById('loadingRow');
      if (loadingRow) {
        loadingRow.innerHTML = `
          <td colspan="9" class="px-6 py-8 text-center text-red-500">
            Error al cargar las órdenes. <button onclick="location.reload()" class="text-blue-500 hover:underline">Reintentar</button>
          </td>
        `;
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
          <td colspan="9" class="px-6 py-8 text-center text-gray-500">
            No se encontraron órdenes
          </td>
        </tr>
      `;
    }

    const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
    // Usar las traducciones inyectadas por Astro
    let pageLabel = (typeof translations !== 'undefined' && translations.pageIndicator) ? translations.pageIndicator : '';
    let ofLabel = (typeof translations !== 'undefined' && translations.pageIndicatorSeparator) ? translations.pageIndicatorSeparator : ' -- ';
    pageIndicator.textContent = `${pageLabel} ${currentPage} ${ofLabel} ${totalPages}`;
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
    filteredOrders.sort((a, b) => {
      let aValue, bValue;
      
      switch (column) {
        case 'pc':
          aValue = (a.pc || '').toLowerCase();
          bValue = (b.pc || '').toLowerCase();
          break;
        case 'oc':
          aValue = (a.oc || '').toLowerCase();
          bValue = (b.oc || '').toLowerCase();
          break;
        case 'customer_name':
          aValue = (a.customer_name || '').toLowerCase();
          bValue = (b.customer_name || '').toLowerCase();
          break;
        case 'fecha':
          aValue = a.fecha || '';
          bValue = b.fecha || '';
          break;
        case 'currency':
          aValue = (a.currency || '').toLowerCase();
          bValue = (b.currency || '').toLowerCase();
          break;
        case 'medio_envio_factura':
          aValue = (a.medio_envio_factura || '').toLowerCase();
          bValue = (b.medio_envio_factura || '').toLowerCase();
          break;
        case 'factura':
          aValue = (a.factura || '').toLowerCase();
          bValue = (b.factura || '').toLowerCase();
          break;
        case 'fecha_factura':
          aValue = a.fecha_factura || '';
          bValue = b.fecha_factura || '';
          break;
        default:
          return 0;
      }
      
      if (direction === 'asc') {
        return aValue.localeCompare(bValue);
      } else {
        return bValue.localeCompare(aValue);
      }
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
  function filterRows() {
    const query = searchInput.value.toLowerCase();
    
    filteredOrders = allOrders.filter(order => {
      // Filtro por búsqueda de texto en múltiples campos
      const searchableText = [
        order.pc || '',
        order.oc || '',
        order.customer_name || '',
        order.factura || '',
        order.fecha_factura || '',
        order.incoterm || '',
        order.puerto_destino || '',
        order.certificados || ''
      ].join(' ').toLowerCase();
      
      return searchableText.includes(query);
    });
    
    // Aplicar ordenamiento actual si existe
    if (currentSort.column) {
      sortRows(currentSort.column, currentSort.direction);
    }
    
    currentPage = 1;
    renderTable();
  }

  /**
   * Buscador dinámico: filtra las filas según el texto ingresado.
   */
  searchInput.addEventListener('input', filterRows);

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
      Swal.fire({
        icon: 'warning',
        title: 'No hay datos para exportar',
        text: 'No hay órdenes disponibles para exportar.',
        confirmButtonText: window.translations?.comond?.understood || 'Entendido'
      });
      return;
    }

    // Definir los encabezados de las columnas
    const headers = [
      'PC',
      'OC',
      'Cliente',
      'Date',
      'Currency',
      'Shipping Method',
      'Factura',
      'Fecha Factura'
    ];

    // Preparar los datos para exportar
    const data = ordersToExport.map(order => [
      order.pc || '', // PC
      order.oc || '', // OC
      order.customer_name || '', // Cliente
      formatDateShort(order.fecha) || '', // Date (fecha)
      order.currency || '', // Currency
      order.medio_envio_factura || '', // Shipping Method (medio_envio_factura)
      order.factura || '', // Factura
      formatDateShort(order.fecha_factura) || ''  // Fecha Factura
    ]);

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
    Swal.fire({
      icon: 'success',
      title: 'Exportación exitosa',
      text: `Se exportaron ${ordersToExport.length} órdenes a Excel.`,
      confirmButtonText: window.translations?.comond?.understood || 'Entendido'
    });
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
  
  // Event listener para el botón de refresh
  if (refreshCacheBtn) {
    refreshCacheBtn.addEventListener('click', async () => {
      // Guardar el texto original antes de cualquier operación
      const originalText = refreshBtnText.textContent;
      
      try {
        // Mostrar estado de loading en el botón
        refreshBtnText.textContent = 'Refrescando...';
        refreshCacheBtn.disabled = true;
        
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
        showNotification('Datos refrescados exitosamente', 'success');
        
        // Actualizar estado del cache en el botón
        updateCacheStatus();
        
      } catch (error) {
        console.error('Error refrescando datos:', error);
        showNotification('Error al refrescar los datos', 'error');
      } finally {
        // Restaurar el botón
        refreshBtnText.textContent = originalText;
        refreshCacheBtn.disabled = false;
      }
    });
  }

  // Event listener para búsqueda
  searchInput.addEventListener('input', filterRows);
  
  // Event listener para navegación (atrás/adelante)
  window.addEventListener('popstate', () => {
    if (searchInput && searchInput.value.trim()) {
      filterRows();
    }
  });
  
  // Event listener para recarga de página
  window.addEventListener('pageshow', () => {
    if (searchInput && searchInput.value.trim()) {
      filterRows();
    }
  });


  // Función para actualizar el estado del cache en el botón
  function updateCacheStatus() {
    try {
      const cacheInfo = getCacheInfo();
      if (cacheInfo.exists) {
        const ageMinutes = Math.floor(cacheInfo.age / 60);
        const ageSeconds = cacheInfo.age % 60;
        let statusText = '';
        
        if (ageMinutes > 0) {
          statusText = `${ageMinutes}m ${ageSeconds}s`;
        } else {
          statusText = `${ageSeconds}s`;
        }
        
        if (cacheInfo.valid) {
          cacheStatus.textContent = '(cache válido)';
          cacheStatus.className = 'text-xs opacity-75 text-green-400';
        } else {
          cacheStatus.textContent = '(cache expirado)';
          cacheStatus.className = 'text-xs opacity-75 text-yellow-400';
        }
      } else {
        cacheStatus.textContent = '(sin cache)';
        cacheStatus.className = 'text-xs opacity-75 text-gray-400';
      }
    } catch (error) {
      console.error('Error actualizando estado del cache:', error);
      cacheStatus.textContent = '(error)';
      cacheStatus.className = 'text-xs opacity-75 text-red-400';
    }
  }
  
  // Cargar y renderizar órdenes inicialmente
  loadAndRenderOrders();
  
  // Actualizar estado del cache inicialmente
  updateCacheStatus();

}

// Función para configurar los event listeners de los modales
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

  // Event listeners para botones de cerrar expansión
  document.addEventListener('click', (e) => {
    const closeBtn = e.target.closest('.close-expansion-btn');
    if (closeBtn) {
      e.preventDefault();
      const orderPc = closeBtn.dataset.orderPc;
      closeItemsExpansion(orderPc);
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
  const closeOrderDetailModalBtn = document.getElementById('closeOrderDetailModalBtn');
  const itemsModal = document.getElementById('itemsModal');
  const orderDetailModal = document.getElementById('orderDetailModal');

  if (closeItemsModalBtn) {
    closeItemsModalBtn.addEventListener('click', () => {
      itemsModal.classList.add('hidden');
      itemsModal.classList.remove('flex');
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

  if (orderDetailModal) {
    orderDetailModal.addEventListener('click', (e) => {
      if (e.target === orderDetailModal) {
        orderDetailModal.classList.add('hidden');
      }
    });
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

  try {
    // Cargar items de la orden usando endpoint diferente según si tiene factura o no
    const token = localStorage.getItem('token');
    const apiBase = window.apiBase;
    
    // Usar endpoint diferente según si tiene factura o no
    const url = factura && factura !== 'null' 
      ? `${apiBase}/api/orders/${orderPc}/${orderOc}/${factura}/items`
      : `${apiBase}/api/orders/${orderPc}/${orderOc}/items`;
    
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) {
      throw new Error('Error al cargar los items de la orden');
    }

    const items = await response.json();
    
    // Actualizar header del modal
    document.getElementById('itemsInitials').textContent = 'IT';
    document.getElementById('itemsOrderTitle').textContent = `${window.translations?.carpetas?.order || 'Orden'}: ${orderOc}`;
    document.getElementById('itemsCustomerName').textContent = `${window.translations?.carpetas?.cliente || 'Cliente'}: ${items[0]?.customer_name || '-'}`;
    document.getElementById('itemsOrderSubtitle').textContent = window.translations?.carpetas?.itemsList || 'Lista de Items';
    
    // Renderizar tabla de items
    if (itemsTableBody) {
      const currency = items[0]?.currency || 'CLP';
      itemsTableBody.innerHTML = items.map(item => {
        const quantity = parseFloat(item.kg_solicitados) || 0;
        const unitPrice = parseFloat(item.unit_price) || 0;
        const total = quantity * unitPrice;
        const unit = item.unidad_medida || 'KG';
        
        return `
          <tr class="hover:bg-gray-50 dark:hover:bg-gray-800 transition">
            <td class="px-6 py-4 text-xs text-gray-900 dark:text-gray-100">${item.item_code || '-'}</td>
            <td class="px-6 py-4 text-xs text-gray-900 dark:text-gray-100">${item.item_name || '-'}</td>
            <td class="px-6 py-4 text-xs text-center text-gray-900 dark:text-gray-100">${formatQuantity(quantity, unit)}</td>
            <td class="px-6 py-4 text-xs text-center text-gray-900 dark:text-gray-100">${formatUnitPrice(unitPrice)}</td>
            <td class="px-6 py-4 text-xs text-center font-semibold text-gray-900 dark:text-gray-100">${formatTotal(total)}</td>
          </tr>
        `;
      }).join('');
    }

    // Calcular y mostrar totales
    const totalItemsCount = items.length;
    
    const totalQuantitySum = items.reduce((sum, item) => {
      const quantity = parseFloat(item.kg_solicitados) || 0;
      return sum + quantity;
    }, 0);
    
    const totalValueSum = items.reduce((sum, item) => {
      const quantity = parseFloat(item.kg_solicitados) || 0;
      const price = parseFloat(item.unit_price) || 0;
      const itemTotal = quantity * price;
      return sum + itemTotal;
    }, 0);

          const currency = items[0]?.currency || 'CLP';
      const unit = items[0]?.unidad_medida || 'KG';
      const gastoAdicional = parseFloat(items[0]?.gasto_adicional_flete) || 0;
      
      totalItems.textContent = totalItemsCount;
      totalQuantity.textContent = formatQuantity(totalQuantitySum, unit);
      totalValue.textContent = formatCurrency(totalValueSum.toFixed(4), currency);
      totalGastoAdicional.textContent = formatCurrency(gastoAdicional.toFixed(4), currency);

    // Mostrar el modal
    itemsModal.classList.remove('hidden');
    itemsModal.classList.add('flex');

  } catch (error) {
    console.error('Error loading order items:', error);
    showNotification('Error al cargar los items de la orden', 'error');
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
  
  const formatted = new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: mappedCurrency,
    minimumFractionDigits: 4,
    maximumFractionDigits: 4
  }).format(amount);
  
  // Agregar espacio después del código de moneda y asegurar USD
  return formatted.replace(/([A-Z]{2,3})\$/, '$1 $').replace('US $', 'USD $');
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
  const parts = amount.toFixed(4).split('.');
  const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `$${integerPart},${parts[1]}`;
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
  orderDetailTitle.textContent = `PC ${orderOc} - Detalles`;

  try {
    // Cargar detalles de la orden
    const token = localStorage.getItem('token');
    const response = await fetch(`${apiBase}/api/orders/${orderId}/detail`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const orderDetail = await response.json();
    
    console.log('Order Detail Response:', orderDetail);

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
    const orderDetailObservaciones = document.getElementById('orderDetailObservaciones');
    if (orderDetailObservaciones) {
      orderDetailObservaciones.textContent = orderDetail.u_observaciones || '-';
    }

    // Mostrar modal
    orderDetailModal.classList.remove('hidden');

  } catch (error) {
    console.error('Error cargando detalles de orden:', error);
    
    // Mostrar valores por defecto en caso de error
    orderDetailPc.textContent = '-';
    orderDetailOc.textContent = '-';
    orderDetailDireccionDestino.textContent = '-';
    orderDetailPuertoDestino.textContent = '-';
    
    // Agregar campo de observaciones si existe
    const orderDetailObservaciones = document.getElementById('orderDetailObservaciones');
    if (orderDetailObservaciones) {
      orderDetailObservaciones.textContent = '-';
    }

    orderDetailModal.classList.remove('hidden');
  }
}

// Función para expandir/contraer items de una orden
async function toggleItemsExpansion(orderPc, orderOc, factura) {
  // Buscar la fila específica usando el botón que se hizo clic
  const expandBtn = event.target.closest('.expand-items-btn');
  const row = expandBtn.closest('tr');
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
    
    // Usar endpoint diferente según si tiene factura o no
    const url = factura && factura !== 'null' 
      ? `${apiBase}/api/orders/${orderPc}/${orderOc}/${factura}/items`
      : `${apiBase}/api/orders/${orderPc}/${orderOc}/items`;
    
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
    expandedCell.colSpan = 14; // Ajustar según el número de columnas de tu tabla
    expandedCell.className = 'px-6 py-4';
    
            // Crear tabla de items
        const currency = items[0]?.currency || 'CLP';
        const itemsTable = `
          <div class="bg-white dark:bg-gray-700 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600">
            <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-600 flex justify-between items-center">
              <h4 class="text-sm font-medium text-gray-900 dark:text-gray-100">
                Items de la Factura ${factura || '-'}
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
                <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">ETD Date</th>
                <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">ETA Date</th>
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
                     <td class="px-4 py-3 text-xs text-gray-900 dark:text-gray-100">${item.item_code || '-'}</td>
                     <td class="px-4 py-3 text-xs text-gray-900 dark:text-gray-100">${item.item_name || '-'}</td>
                     <td class="px-4 py-3 text-xs text-center text-gray-900 dark:text-gray-100">${item.tipo || '-'}</td>
                     <td class="px-4 py-3 text-xs text-center text-gray-900 dark:text-gray-100">${item.mercado || '-'}</td>
                     <td class="px-4 py-3 text-xs text-center text-gray-900 dark:text-gray-100">${formatQuantity(quantity, 'KG')}</td>
                     <td class="px-4 py-3 text-xs text-center text-gray-900 dark:text-gray-100">${formatQuantity(parseFloat(item.kg_despachados) || 0, 'KG')}</td>
                     <td class="px-4 py-3 text-xs text-center text-gray-900 dark:text-gray-100">${formatQuantity(parseFloat(item.kg_facturados) || 0, 'KG')}</td>
                     <td class="px-4 py-3 text-xs text-center text-gray-900 dark:text-gray-100">${item.fecha_etd ? new Date(item.fecha_etd).toLocaleDateString('es-CL') : '-'}</td>
                     <td class="px-4 py-3 text-xs text-center text-gray-900 dark:text-gray-100">${item.fecha_eta ? new Date(item.fecha_eta).toLocaleDateString('es-CL') : '-'}</td>
                     <td class="px-4 py-3 text-xs text-center text-gray-900 dark:text-gray-100">${formatUnitPrice(unitPrice)}</td>
                     <td class="px-4 py-3 text-xs text-center font-semibold text-gray-900 dark:text-gray-100">${formatTotal(total)}</td>
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
    console.log('Datos guardados en caché');
  } catch (error) {
    console.warn('No se pudo guardar en caché:', error);
  }
}

// Función para cargar datos desde caché
function loadFromCache() {
  try {
    const cachedData = localStorage.getItem(CACHE_KEY);
    if (cachedData) {
      console.log('Datos cargados desde caché');
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
  console.log('Caché limpiado');
}

// Función para cargar datos desde la API con caché
export async function loadOrdersWithCache() {
  try {
    // Primero intentar cargar desde caché
    if (isCacheValid()) {
      const cachedData = loadFromCache();
      if (cachedData) {
        console.log('Usando datos del caché (válido)');
        return cachedData;
      }
    }

    console.log('Cargando datos desde API...');
    const token = localStorage.getItem('token');
    const apiBase = window.apiBase;
    
    const response = await fetch(`${apiBase}/api/orders`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const orders = await response.json();
    console.log('Órdenes desde API:', orders.length);
    
    // Guardar en caché
    saveToCache(orders);
    
    return orders;
  } catch (error) {
    console.error('Error cargando órdenes:', error);
    
    // Si hay error en la API, intentar usar caché aunque esté expirado
    const cachedData = loadFromCache();
    if (cachedData) {
      console.log('Usando caché expirado debido a error en API');
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