// public/js/clients.js
import { 
  qs, 
  showNotification, 
  confirmAction, 
  showSuccess, 
  showError,
  showModal,
  hideModal,
  setupModalClose,
  clearContainer,
  isValidEmail
} from './utils.js';

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
        console.log('Usando datos del caché (válido)');
        return cachedData;
      }
    }
    console.log('Cargando datos desde API...');
    const token = localStorage.getItem('token');
    const apiBase = window.apiBase;
    const response = await fetch(`${apiBase}/api/customers`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const customers = await response.json();
    saveToCache(customers);
    return customers;
  } catch (error) {
    console.error('Error cargando clientes:', error);
    const cachedData = loadFromCache();
    if (cachedData) {
      console.log('Usando caché expirado debido a error en API');
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
  // Obtener apiBase - usar localhost para JavaScript del cliente
  const apiBase = window.apiBase || section?.dataset.apiBase;
  
  // Usar traducciones ya cargadas por Astro
  const translations = window.translations || {};
  const messages = translations.messages || {};
  const clientes = translations.clientes || {};
  
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
    return `
      <tr data-id="${customer.id}" class="hover:shadow-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition bg-white dark:bg-gray-900">
        <td class="px-6 py-4 items-center gap-3 border-b border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">${customer.name || '-'}</td>
        <td class="px-6 py-4 items-center gap-3 border-b border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">${customer.rut || '-'}</td>
        <td class="px-6 py-4 items-center gap-3 border-b border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">${customer.email || '-'}</td>
        <td class="px-6 py-4 items-center gap-3 border-b border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">${customer.phone || '-'}</td>
        <td class="px-6 py-4 items-center gap-3 border-b border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">${customer.country || '-'}</td>
        <td class="px-6 py-4 items-center gap-3 border-b border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">${customer.city || '-'}</td>
        <td class="px-6 py-4 text-center gap-3 border-b border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">${customer.order_count || 0}</td>
        <td class="px-6 py-4 items-center gap-3 border-b border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">
          <div class="flex justify-center items-center gap-3 text-gray-900 dark:text-white">
            <a href="/admin/clients/folders/view/${customer.uuid}?c=${customer.name}" title="Orders" class="hover:text-yellow-500 transition">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 3h18v4H3z"/><path d="M3 7h18v13H3z"/><path d="M16 3v4"/></svg>
            </a>
            <a href="#" data-uuid="${customer.uuid}" title="Ver" class="hover:text-blue-500 transition">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 20.5C6.753 20.5 2.5 16.247 2.5 11S6.753 1.5 12 1.5 21.5 5.753 21.5 11 17.247 20.5 12 20.5z"/></svg>
            </a>
            <a href="#" data-uuid="${customer.uuid}" data-name="${customer.name}" title="Gestionar contactos" class="hover:text-indigo-500 transition manage-contacts-btn">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
            </a>
          </div>
        </td>
      </tr>
    `;
  }

  // Función para cargar y renderizar clientes
  async function loadAndRenderCustomers() {
    try {
      // Cargar datos usando el caché
      allCustomers = await loadCustomersWithCache();
      filteredCustomers = [...allCustomers];
      
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
        loadingRow.innerHTML = `
          <td colspan="8" class="px-6 py-8 text-center text-red-500">
            Error al cargar los clientes. <button onclick="location.reload()" class="text-blue-500 hover:underline">Reintentar</button>
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
    const pageData = filteredCustomers.slice(start, start + itemsPerPage);
    
    // Limpiar tabla
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
          <td colspan="8" class="px-6 py-8 text-center text-gray-500">
            No se encontraron clientes
          </td>
        </tr>
      `;
    }

    const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);
    // Usar las traducciones inyectadas por Astro
    let pageLabel = (typeof translations !== 'undefined' && translations.pageIndicator) ? translations.pageIndicator : '';
    let ofLabel = (typeof translations !== 'undefined' && translations.pageIndicatorSeparator) ? translations.pageIndicatorSeparator : ' -- ';
    pageIndicator.textContent = `${pageLabel} ${currentPage} ${ofLabel} ${totalPages}`;
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
    filteredCustomers.sort((a, b) => {
      let aValue, bValue;
      
      switch (column) {
        case 'name':
          aValue = (a.name || '').toLowerCase();
          bValue = (b.name || '').toLowerCase();
          break;
        case 'rut':
          aValue = (a.rut || '').toLowerCase();
          bValue = (b.rut || '').toLowerCase();
          break;
        case 'email':
          aValue = (a.email || '').toLowerCase();
          bValue = (b.email || '').toLowerCase();
          break;
        case 'phone':
          aValue = (a.phone || '').toLowerCase();
          bValue = (b.phone || '').toLowerCase();
          break;
        case 'country':
          aValue = (a.country || '').toLowerCase();
          bValue = (b.country || '').toLowerCase();
          break;
        case 'city':
          aValue = (a.city || '').toLowerCase();
          bValue = (b.city || '').toLowerCase();
          break;
        case 'order_count':
          aValue = parseInt(a.order_count) || 0;
          bValue = parseInt(b.order_count) || 0;
          break;
        default:
          return 0;
      }
      
      if (direction === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
  }

  /**
   * Función para exportar tabla a Excel
   */
  function exportToExcel() {
    // Obtener los clientes filtrados actuales
    const customersToExport = filteredCustomers.length > 0 ? filteredCustomers : allCustomers;
    
    if (customersToExport.length === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'No hay datos para exportar',
        text: 'No hay clientes disponibles para exportar.',
        confirmButtonText: 'OK'
      });
      return;
    }

    // Definir los encabezados de las columnas
    const headers = [
      'Nombre',
      'RUT',
      'Email',
      'Teléfono',
      'País',
      'Ciudad',
      'Órdenes'
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
    Swal.fire({
      icon: 'success',
      title: 'Exportación exitosa',
      text: `Se exportaron ${customersToExport.length} clientes a Excel.`,
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
      renderTable();
    });
  });

  // Cargar y renderizar clientes inicialmente
  loadAndRenderCustomers();
} 