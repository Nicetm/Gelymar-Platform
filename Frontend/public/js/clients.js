// public/js/clients.js
import { 
  qs, 
  showNotification, 
  confirmAction, 
  showSuccess, 
  showError,
  clearContainer,
  isValidEmail
} from './utils.js';

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
            <div class="relative group">
              <a href="/admin/clients/folders/view/${customer.uuid}?c=${customer.name}" class="hover:text-blue-500 transition">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              </a>
              <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2
                          bg-blue-600 text-white text-xs rounded px-2 py-1 shadow-lg
                          opacity-0 group-hover:opacity-100 transition
                          pointer-events-none whitespace-nowrap z-50">
                ${window.translations?.clientes?.view_orders || 'Ver órdenes'}
              </div>
            </div>
            <div class="relative group">
              <a href="#" data-uuid="${customer.uuid}" class="hover:text-blue-500 transition">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 20.5C6.753 20.5 2.5 16.247 2.5 11S6.753 1.5 12 1.5 21.5 5.753 21.5 11 17.247 20.5 12 20.5z"/></svg>
              </a>
              <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2
                          bg-blue-600 text-white text-xs rounded px-2 py-1 shadow-lg
                          opacity-0 group-hover:opacity-100 transition
                          pointer-events-none whitespace-nowrap z-50">
                ${window.translations?.clientes?.view_info || 'Ver información adicional'}
              </div>
            </div>
            <div class="relative group">
              <a href="#" data-uuid="${customer.uuid}" data-name="${customer.name}" class="hover:text-blue-500 transition manage-contacts-btn">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
              </a>
              <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2
                          bg-blue-600 text-white text-xs rounded px-2 py-1 shadow-lg
                          opacity-0 group-hover:opacity-100 transition
                          pointer-events-none whitespace-nowrap z-50">
                ${window.translations?.clientes?.manage_contacts || 'Gestionar contactos'}
              </div>
            </div>
            <div class="relative group">
              <a href="#" data-uuid="${customer.uuid}" data-name="${customer.name}" class="hover:text-blue-500 transition change-password-btn">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
              </a>
              <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2
                          bg-blue-600 text-white text-xs rounded px-2 py-1 shadow-lg
                          opacity-0 group-hover:opacity-100 transition
                          pointer-events-none whitespace-nowrap z-50">
                ${window.translations?.clientes?.change_password || 'Cambiar contraseña'}
              </div>
            </div>
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
        loadingRow.innerHTML = `
          <td colspan="8" class="px-6 py-8 text-center text-red-500">
            Error al cargar los clientes. <button onclick="location.reload()" class="text-blue-500 hover:underline">Reintentar</button>
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
      showNotification('Datos refrescados automáticamente', 'success');
      
    } catch (error) {
      console.error('Error refrescando datos:', error);
      showNotification('Error al refrescar los datos', 'error');
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
      showNotification('No hay clientes disponibles para exportar', 'warning');
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
    showSuccess(`Se exportaron ${customersToExport.length} clientes a Excel`);
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
        showError('Cliente no encontrado');
        return;
      }
      
      // Llenar el modal de perfil con los datos del cliente
      openProfileModal(customer);
      
    } catch (error) {
      console.error('Error abriendo modal de perfil:', error);
      showError('Error al cargar información del cliente');
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
        showError('Cliente no encontrado');
        return;
      }
      
      // Abrir modal de contactos
      openContactsModal(customer);
      
    } catch (error) {
      console.error('Error abriendo modal de contactos:', error);
      showError('Error al cargar contactos del cliente');
    }
  });

  // ===== FUNCIONES DE MODALES =====
  

  function openContactsModal(customer) {
    // Llenar datos del modal de contactos
    const initials = customer.name ? customer.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'CL';
    
    document.getElementById('contactsInitials').textContent = initials;
    document.getElementById('contactsClientName').textContent = customer.name || 'Sin nombre';
    
    // Limpiar formulario de contactos
    clearContactsForm();
    
    // Cargar contactos existentes
    loadExistingContacts(customer.uuid);
    
    // Mostrar modal
    showModal('#contactsModal');
  }

  function clearContactsForm() {
    const container = document.getElementById('contactsFormContainer');
    if (container) {
      container.innerHTML = '';
    }
  }

  async function loadExistingContacts(customerUuid) {
    try {
      const token = localStorage.getItem('token');
      const apiBase = window.apiBase;
      
      const response = await fetch(`${apiBase}/api/customers/${customerUuid}/contacts`, {
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
    
    // Verificar si hay datos de contacto
    if (!contactData || (!contactData.primary_email && (!contactData.additional_contacts || contactData.additional_contacts.length === 0))) {
      container.innerHTML = `
        <div class="text-center py-8 text-gray-500 dark:text-gray-400">
          <svg class="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <p>No hay contactos registrados</p>
        </div>
      `;
      return;
    }
    
    const additionalContacts = contactData.additional_contacts || [];
    
    let primaryEmailHtml = '';
    
    // Mostrar contactos adicionales si existen
    let additionalContactsHtml = '';
    if (additionalContacts.length > 0) {
      additionalContactsHtml = `
        <div class="mb-4">
          <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Contactos Adicionales</h3>
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead class="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Nombre</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Email</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Teléfono</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody class="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                ${additionalContacts.map(contact => `
                  <tr>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">${contact.nombre || '-'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${contact.email || '-'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${contact.telefono || '-'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 delete-contact-btn" data-contact-idx="${contact.idx}">
                        Eliminar
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } else {
      // Mostrar mensaje cuando no hay contactos adicionales
      additionalContactsHtml = `
        <div class="mb-4">
          <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Contactos Adicionales</h3>
          <div class="text-center py-4 text-gray-500 dark:text-gray-400">
            <p>No hay contactos adicionales registrados</p>
          </div>
        </div>
      `;
    }
    
    container.innerHTML = primaryEmailHtml + additionalContactsHtml;
  }

  // ===== FUNCIONALIDAD DEL MODAL DE CONTACTOS =====
  
  let currentCustomerUuid = null;
  let contactRows = [];

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
    if (e.target.classList.contains('delete-contact-btn')) {
      e.preventDefault();
      const contactIdx = e.target.dataset.contactIdx;
      await deleteContact(contactIdx);
    }
  });

  function addContactRow() {
    const container = document.getElementById('contactsFormContainer');
    if (!container) return;

    const rowId = `contact-row-${Date.now()}`;
    const rowHtml = `
      <div id="${rowId}" class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 p-4 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre</label>
          <input type="text" class="contact-name w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Nombre del contacto">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
          <input type="email" class="contact-email w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="email@ejemplo.com">
        </div>
        <div class="flex items-end">
          <div class="flex-1">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Teléfono</label>
            <input type="tel" class="contact-phone w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="+56 9 1234 5678">
          </div>
          <button type="button" class="ml-2 p-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 remove-contact-row" data-row-id="${rowId}">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    `;
    
    container.insertAdjacentHTML('beforeend', rowHtml);
  }

  // Event listener para remover filas de contacto
  document.addEventListener('click', (e) => {
    const removeBtn = e.target.closest('.remove-contact-row');
    if (removeBtn) {
      e.preventDefault();
      const rowId = removeBtn.dataset.rowId;
      const row = document.getElementById(rowId);
      if (row) {
        row.remove();
      }
    }
  });

  async function saveContacts() {
    if (!currentCustomerUuid) {
      showError('Error: No se ha seleccionado un cliente');
      return;
    }

    // Verificar si el cliente tiene email principal
    try {
      const response = await fetch(`${apiBase}/api/customers/contacts/${currentCustomerUuid}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const contactData = await response.json();
        if (!contactData.primary_email) {
          showError('Para ingresar contactos adicionales debe ingresar el mail principal');
          return;
        }
      }
    } catch (error) {
      console.error('Error verificando email principal:', error);
      showError('Error al verificar email principal del cliente');
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

      if (name || email || phone) {
        if (!name) {
          showError('El nombre es obligatorio para todos los contactos');
          return;
        }
        if (email && !isValidEmail(email)) {
          showError('El email debe tener un formato válido');
          return;
        }

        contacts.push({ name, email, phone });
      }
    }

    if (contacts.length === 0) {
      showError('Debe agregar al menos un contacto');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const apiBase = window.apiBase;

      const response = await fetch(`${apiBase}/api/customers/contacts`, {
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
        showSuccess(`${contacts.length} contacto(s) agregado(s) exitosamente`);
        clearContactsForm();
        loadExistingContacts(currentCustomerUuid);
      } else {
        const error = await response.json();
        showError(error.message || 'Error al agregar contactos');
      }
    } catch (error) {
      console.error('Error agregando contactos:', error);
      showError('Error de red al agregar contactos');
    }
  }

  async function deleteContact(contactIdx) {
    const confirmed = await confirmAction(
      '¿Eliminar contacto?',
      'Esta acción no se puede deshacer.',
      'warning'
    );

    if (!confirmed) return;

    try {
      const token = localStorage.getItem('token');
      const apiBase = window.apiBase;

      const response = await fetch(`${apiBase}/api/customers/contacts/${currentCustomerUuid}/${contactIdx}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (response.ok) {
        showSuccess('Contacto eliminado exitosamente');
        loadExistingContacts(currentCustomerUuid);
      } else {
        const error = await response.json();
        showError(error.message || 'Error al eliminar contacto');
      }
    } catch (error) {
      console.error('Error eliminando contacto:', error);
      showError('Error de red al eliminar contacto');
    }
  }

  // Actualizar la función openContactsModal para guardar el UUID del cliente
  function openContactsModal(customer) {
    // Llenar datos del modal de contactos
    const initials = customer.name ? customer.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'CL';
    
    document.getElementById('contactsInitials').textContent = initials;
    document.getElementById('contactsClientName').textContent = customer.name || 'Sin nombre';
    
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
      showError('Error: No se ha seleccionado un cliente');
      return;
    }

    const emailInput = document.getElementById('profileEmail');
    const newEmail = emailInput?.value?.trim();

    if (!newEmail) {
      showError('El email no puede estar vacío');
      return;
    }

    if (!isValidEmail(newEmail)) {
      showError('El email debe tener un formato válido');
      return;
    }

    const confirmed = await confirmAction(
      '¿Actualizar cliente?',
      'Se actualizará la información del cliente.',
      'question'
    );

    if (!confirmed) return;

    try {
      const token = localStorage.getItem('token');
      const apiBase = window.apiBase;

      const response = await fetch(`${apiBase}/api/customers/${currentCustomerForUpdate.uuid}`, {
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
        showSuccess('Cliente actualizado exitosamente');
        hideModal('#profileModal');
        // Recargar la lista de clientes para reflejar los cambios
        await forceReloadCustomers();
        await loadAndRenderCustomers();
      } else {
        const error = await response.json();
        showError(error.message || 'Error al actualizar cliente');
      }
    } catch (error) {
      console.error('Error actualizando cliente:', error);
      showError('Error de red al actualizar cliente');
    }
  }

  function viewCustomerOrders() {
    if (!currentCustomerForUpdate) {
      showError('Error: No se ha seleccionado un cliente');
      return;
    }

    // Redirigir a la página de órdenes del cliente
    window.location.href = `/admin/clients/folders/view/${currentCustomerForUpdate.uuid}?c=${encodeURIComponent(currentCustomerForUpdate.name)}`;
  }

  // Actualizar la función openProfileModal para guardar el cliente actual
  function openProfileModal(customer) {
    // Llenar datos del modal de perfil
    const initials = customer.name ? customer.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'CL';
    
    document.getElementById('profileInitials').textContent = initials;
    document.getElementById('profileClientName').textContent = customer.name || 'Sin nombre';
    document.getElementById('profileClientRut').textContent = customer.rut || 'Sin RUT';
    document.getElementById('profileCountry').textContent = customer.country || 'Sin país';
    document.getElementById('profileCity').textContent = customer.city || 'Sin ciudad';
    document.getElementById('profilePhone').textContent = customer.phone || 'Sin teléfono';
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
    document.getElementById('changePasswordCustomerName').textContent = customerName;
    
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
      showNotification('Por favor complete todos los campos', 'error');
      return;
    }
    
    if (newPassword.length < 6) {
      showNotification('La contraseña debe tener al menos 6 caracteres', 'error');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      showNotification('Las contraseñas no coinciden', 'error');
      return;
    }
    
    // Mostrar loading
    const saveBtn = document.getElementById('savePasswordBtn');
    const originalText = saveBtn.innerHTML;
    saveBtn.innerHTML = '<svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Cambiando...';
    saveBtn.disabled = true;
    
    try {
      const token = localStorage.getItem('token');
      const apiBase = window.apiBase;
      
      const response = await fetch(`${apiBase}/api/customers/change-password/${currentPasswordCustomerUuid}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ password: newPassword })
      });
      
      if (response.ok) {
        showNotification('Contraseña cambiada exitosamente', 'success');
        hideModal('#changePasswordModal');
      } else {
        const error = await response.json();
        showNotification(error.message || 'Error al cambiar la contraseña', 'error');
      }
    } catch (error) {
      console.error('Error cambiando contraseña:', error);
      showNotification('Error al cambiar la contraseña', 'error');
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
} 