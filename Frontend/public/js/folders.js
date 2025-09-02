import { 
  qs, 
  showNotification, 
  showModal,
  hideModal,
  setupModalClose,
  formatDate,
  formatDateShort
} from './utils.js';

// Función para cargar traducciones
async function loadTranslations(lang, section) {
  try {
    const module = await import(`/src/i18n/${lang}/${section}.json`);
    return module.default || {};
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
  
  const tableBody = qs('foldersTableBody');
  const searchInput = qs('searchInput');
  const itemsPerPageSelect = qs('itemsPerPageSelect');
  const prevPageBtn = qs('prevPageBtn');
  const nextPageBtn = qs('nextPageBtn');
  const pageIndicator = qs('pageIndicator');
  const section = qs('folderSection');
  const uuID = section?.dataset?.uuid;

  const allRows = Array.from(tableBody?.querySelectorAll('tr') || []);

  let currentPage = 1;
  let itemsPerPage = parseInt(itemsPerPageSelect?.value || '10', 10);
  let filteredRows = [...allRows];
  let currentSort = { column: null, direction: 'asc' };

  const params = new URLSearchParams(window.location.search);
  const clientName = params.get('c');

  function renderTable() {
    const start = (currentPage - 1) * itemsPerPage;
    const pageData = filteredRows.slice(start, start + itemsPerPage);

    allRows.forEach(row => {
      row.style.display = 'none';
    });

    pageData.forEach(row => {
      row.style.display = '';
    });
    
    if (pageIndicator) {
      pageIndicator.textContent = `Page ${currentPage} of ${Math.ceil(filteredRows.length / itemsPerPage)}`;
    }
  }

  /**
   * Función para obtener el valor de una celda para ordenamiento
   */
  function getCellValue(row, columnIndex) {
    const cell = row.cells[columnIndex];
    if (!cell) return '';
    
    let value = cell.textContent.trim();
    
    // Para las columnas de fecha, convertir a timestamp
    if (columnIndex === 6) { // fecha_factura
      if (value === '-') return 0;
      return new Date(value).getTime();
    }
    
    return value.toLowerCase();
  }

  /**
   * Función para ordenar las filas
   */
  function sortRows(column, direction) {
    const columnMap = {
      'pc': 0,
      'oc': 1,
      'fecha': 2,
      'moneda': 3,
      'medio_envio': 4,
      'factura': 5,
      'fecha_factura': 6
    };
    
    const columnIndex = columnMap[column];
    if (columnIndex === undefined) return;
    
    filteredRows.sort((a, b) => {
      const valueA = getCellValue(a, columnIndex);
      const valueB = getCellValue(b, columnIndex);
      
      if (direction === 'asc') {
        return valueA > valueB ? 1 : valueA < valueB ? -1 : 0;
      } else {
        return valueA < valueB ? 1 : valueA > valueB ? -1 : 0;
      }
    });
  }

  /**
   * Función para actualizar los iconos de ordenamiento
   */
  function updateSortIcons(activeColumn, direction) {
    // Resetear todos los iconos
    document.querySelectorAll('.sort-icon').forEach(icon => {
      icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />';
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

    if (tableBody) {
      tableBody.innerHTML = folders.map(folder => `
        <tr data-id="${folder.id}" class="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800 text-sm min-h-[600px]">
          <td class="px-6 py-4 items-center gap-3 border-b border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">${folder.pc}</td>
          <td class="px-6 py-4 items-center gap-3 border-b border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">${folder.oc}</td>
          <td class="px-6 py-4 items-center gap-3 border-b border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">-</td>
          <td class="px-6 py-4 items-center gap-3 border-b border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">${folder.currency || '-'}</td>
          <td class="px-6 py-4 items-center gap-3 border-b border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">${folder.medio_envio || '-'}</td>
          <td class="px-6 py-4 items-center gap-3 border-b border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">${folder.factura || '-'}</td>
          <td class="px-6 py-4 items-center gap-3 border-b border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">${formatDateShort(folder.fecha_factura)}</td>
          <td class="w-[25%] px-6 py-4 text-sm border-b border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">
            <div class="flex justify-center items-center gap-3 text-gray-900 dark:text-white">
              <a href="/admin/clients/documents/view/${folder.customer_uuid}?f=${folder.id}&pc=${folder.pc}&c=${clientName}" title="Ver documentos de PC ${folder.pc}" class="hover:text-blue-500 transition">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              </a>
                          <a href="#" title="Ver Lista de items de PC ${folder.pc}" class="hover:text-indigo-500 transition">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16"/>
              </svg>
            </a>
            <a href="#" title="Expandir items de PC ${folder.pc}" class="expand-items-btn hover:text-green-500 transition" data-order-pc="${folder.pc}" data-order-oc="${folder.oc}">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
              </svg>
            </a>
            <a href="#" title="Detalles de la Orden ${folder.pc}" class="order-detail-btn hover:text-blue-500 transition" data-order-id="${folder.id}">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </a>
            </div>
          </td>
        </tr>
      `).join('');

      allRows.length = 0;
      allRows.push(...Array.from(tableBody.querySelectorAll('tr')));
      filteredRows = [...allRows];
      currentPage = 1;
      renderTable();
    }
  }

  searchInput?.addEventListener('input', () => {
    const query = searchInput.value.toLowerCase();
    filteredRows = allRows.filter(row => row.textContent.toLowerCase().includes(query));
    
    // Aplicar ordenamiento actual si existe
    if (currentSort.column) {
      sortRows(currentSort.column, currentSort.direction);
    }
    
    currentPage = 1;
    renderTable();
  });

  itemsPerPageSelect?.addEventListener('change', () => {
    itemsPerPage = parseInt(itemsPerPageSelect.value, 10);
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
    const totalPages = Math.ceil(filteredRows.length / itemsPerPage);
    if (currentPage < totalPages) {
      currentPage += 1;
      renderTable();
    }
  });



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
      
      const response = await fetch(`${apiBase}/api/orders/${pc}/items`, {
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

  /**
   * Event listener para los botones "Ver Lista de items"
   */
  document.addEventListener('click', (e) => {
    const viewItemsBtn = e.target.closest('a[title*="List"], a[title*="items"]');
    if (viewItemsBtn && !viewItemsBtn.classList.contains('expand-items-btn')) {
      e.preventDefault();
      
      const row = viewItemsBtn.closest('tr');
      if (row) {
        const orderId = row.dataset.id;
        const pc = row.cells[0]?.textContent?.trim() || ''; // PC
        const oc = row.cells[1]?.textContent?.trim() || ''; // OC
        const clientNameFromURL = clientName || 'Cliente'; // Nombre del cliente desde la URL
        
        loadOrderItems(orderId, oc, clientNameFromURL);
      }
    }
  });

  renderTable();

  // ===== MODAL DE DETALLES DE ORDEN =====
  const orderDetailModal = qs('orderDetailModal');
  const closeOrderDetailModalBtn = qs('closeOrderDetailModalBtn');

  /**
   * Función para cargar los detalles de una orden
   */
  async function loadOrderDetail(orderId, pc, oc) {
    try {
      console.log('Loading order detail for:', { orderId, pc, oc });
      
      const response = await fetch(`${apiBase}/api/orders/${orderId}/detail`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });

      console.log('Response status:', response.status);
      let orderDetail;

      if (response.ok) {
        orderDetail = await response.json();
        console.log('Order detail data:', orderDetail);
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
        console.log('Created default order detail:', orderDetail);
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
          console.log(`Set ${elementId} to:`, value || '-');
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
      setValue('orderDetailObservaciones', orderDetail.u_observaciones);

      // Mostrar el modal
      orderDetailModal.classList.remove('hidden');
      orderDetailModal.classList.add('flex');
      console.log('Modal should be visible now');

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
  async function toggleItemsExpansion(orderPc, orderOc) {
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
      
      const response = await fetch(`${apiBase}/api/orders/${orderPc}/items`, {
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
      expandedCell.colSpan = 8; // Ajustar según el número de columnas de la tabla de folders
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
   * Event listeners para botones de expansión de items
   */
  document.addEventListener('click', (e) => {
    const expandBtn = e.target.closest('.expand-items-btn');
    if (expandBtn) {
      e.preventDefault();
      const orderPc = expandBtn.dataset.orderPc;
      const orderOc = expandBtn.dataset.orderOc;
      toggleItemsExpansion(orderPc, orderOc);
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

  // Cargar los datos iniciales
  refreshFolders();
} 