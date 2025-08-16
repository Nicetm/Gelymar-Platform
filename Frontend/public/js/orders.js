import { qs, showNotification, createPagination, formatDate, setupScrollShadow } from './utils.js';

// Detectar idioma
let lang = localStorage.getItem('lang') || 'es';
// Eliminar toda la lógica de importación dinámica de traducciones
let t = {
  editOrder: "Editar {order}",
  noResults: "Sin resultados",
  searchError: "Error al buscar"
};

export async function initOrdersScript() {
  const buscarBtn = qs('buscarBtn');
  const limpiarBtn = qs('limpiarBtn');
  const tablaBody = qs('resultadosTabla');
  const itemsPerPageSelect = qs('itemsPerPageSelect');
  const pageIndicator = qs('pageIndicator');
  const prevPageBtn = qs('prevPageBtn');
  const nextPageBtn = qs('nextPageBtn');
  const head = document.getElementById('ordersHead');
  
  // Elementos del combobox de clientes
  const clienteInput = qs('cliente');
  const clienteDropdown = qs('clienteDropdown');
  const clienteDropdownIcon = qs('clienteDropdownIcon');
  
  // Elementos de los botones de limpiar
  const clearOrdenBtn = qs('clearOrdenBtn');
  const clearClienteBtn = qs('clearClienteBtn');
  

  // Función para mostrar/ocultar botones de limpiar
  function toggleClearButton(inputElement, clearButton) {
    if (!inputElement || !clearButton) return;
    
    const hasValue = inputElement.value.trim().length > 0;
    clearButton.classList.toggle('hidden', !hasValue);
  }

  // Función para limpiar campo
  function clearField(inputElement, clearButton) {
    if (!inputElement) return;
    
    isClearingField = true; // Activar flag
    
    inputElement.value = '';
    inputElement.focus();
    toggleClearButton(inputElement, clearButton);
    
    // Si es el campo cliente, también cerrar dropdown y recargar lista
    if (inputElement.id === 'cliente' && clienteDropdown) {
      // Recargar la lista de clientes y mostrar inmediatamente
      if (allCustomers.length === 0) {
        loadCustomers().then(() => {
          // Después de cargar, mostrar todas las opciones
          filterCustomers('');
          clienteDropdown.classList.remove('hidden');
          if (clienteDropdownIcon) {
            clienteDropdownIcon.style.transform = 'rotate(180deg)';
          }
          // Desactivar flag después de un delay
          setTimeout(() => {
            isClearingField = false;
          }, 100);
        });
      } else {
        // Si ya hay clientes, mostrar todas las opciones inmediatamente
        filterCustomers('');
        clienteDropdown.classList.remove('hidden');
        if (clienteDropdownIcon) {
          clienteDropdownIcon.style.transform = 'rotate(180deg)';
        }
        // Desactivar flag después de un delay
        setTimeout(() => {
          isClearingField = false;
        }, 100);
      }
    } else {
      isClearingField = false;
    }
  }

  let itemsPerPage = parseInt(itemsPerPageSelect.value, 10);
  let currentPage = 1;
  let currentData = [];
  let allCustomers = []; // Lista de todos los clientes
  let isClearingField = false; // Flag para evitar cierre automático durante limpieza

  function updatePagination() {
    const totalPages = Math.max(1, Math.ceil(currentData.length / itemsPerPage));
    createPagination(totalPages, currentPage, (page) => {
      currentPage = page;
      renderPage();
    });
    pageIndicator.textContent = ` ${currentPage}  -- ${totalPages}`;
  }

  function renderPage() {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageData = currentData.slice(start, end);

    if (pageData.length === 0) {
      tablaBody.innerHTML = `<tr><td colspan="7" class="px-4 py-4 text-center text-gray-400 dark:text-gray-500">${t.noResults}</td></tr>`;
      updatePagination();
      return;
    }

    tablaBody.innerHTML = pageData.map(order => `
      <tr data-id="${order.id}" class="transition-colors duration-150 hover:bg-gray-100 dark:hover:bg-gray-800 hover:shadow-[0_1px_3px_rgba(0,0,0,0.12)]">
        <td class="px-6 py-4 items-center gap-3">${order.pc || '-'}</td>
        <td class="px-6 py-4 items-center gap-3">${order.oc || '-'}</td>
        <td class="px-4 py-3 break-all text-blue-600 dark:text-blue-400">${order.customer_name || '-'}</td>
        <td class="px-6 py-4 items-center gap-3">${formatDate(order.created_at)}</td>
        <td class="px-6 py-4 items-center gap-3">${formatDate(order.updated_at)}</td>
        <td class="px-6 py-4">
          <div class="flex justify-center items-center gap-3 text-gray-900 dark:text-white">
            <a href="/admin/clients/documents/view/${order.customer_uuid}?f=${order.id}&pc=${order.pc}&c=${order.customer_name}" class="go-to-order-btn" title="Ir a la orden">
              <svg class="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M14 3h7m0 0v7m0-7L10 14m-4 0h.01M5 14a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h5a1 1 0 0 0 1-1v-.01" />
              </svg>
            </a>
            <a href="#" title="${t.editOrder.replace('{order}', order.name)}" class="edit-btn hover:text-green-500 transition" data-file-id="${order.id}">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536M9 11l6.586-6.586a2 2 0 112.828 2.828L11.828 13.83a2 2 0 01-.586.414L9 15l.756-2.243a2 2 0 01.414-.586z" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 20H5" />
              </svg>
            </a>
          </div>
        </td>
      </tr>
    `).join('');
    updatePagination();
  }

  function showSkeleton(count = 8) {
    const skeletonRow = `
      <tr class="animate-pulse">
        <td colspan="7" class="px-6 py-4">
          <div class="space-y-2">
            <div class="h-4 w-3/4 bg-gray-300 dark:bg-gray-700 rounded"></div>
            <div class="h-4 w-1/2 bg-gray-300 dark:bg-gray-700 rounded"></div>
          </div>
        </td>
      </tr>`;
    tablaBody.innerHTML = skeletonRow.repeat(count);
  }

  // Función para cargar todos los clientes
  async function loadCustomers() {
    try {
      const token = localStorage.getItem('token');
      const apiBase = buscarBtn?.dataset.apiBase;
      
      const response = await fetch(`${apiBase}/api/customers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const customers = await response.json();
      allCustomers = Array.isArray(customers) ? customers : [];
      return allCustomers;
    } catch (error) {
      console.error('Error cargando clientes:', error);
      allCustomers = [];
      return [];
    }
  }

  // Función para filtrar y mostrar clientes
  function filterCustomers(searchTerm) {
    if (!clienteDropdown) return;
    
    const filtered = allCustomers.filter(customer => 
      customer.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    clienteDropdown.innerHTML = filtered.map(customer => `
      <div class="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer customer-option" 
           data-value="${customer.name}">
        ${customer.name}
      </div>
    `).join('');

    // Mostrar dropdown si hay resultados o si el término de búsqueda está vacío
    if (filtered.length > 0 || searchTerm === '') {
      clienteDropdown.classList.remove('hidden');
    } else {
      clienteDropdown.classList.add('hidden');
    }
  }

  // Función para mostrar/ocultar dropdown
  function toggleCustomerDropdown() {
    if (!clienteDropdown) return;
    
    const isHidden = clienteDropdown.classList.contains('hidden');
    
    if (isHidden) {
      filterCustomers(clienteInput.value);
      clienteDropdown.classList.remove('hidden');
    } else {
      clienteDropdown.classList.add('hidden');
    }
    
    // Rotar icono
    if (clienteDropdownIcon) {
      clienteDropdownIcon.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
    }
  }

  async function performSearch() {
    const cliente = qs('cliente')?.value.trim() ?? '';
    const orden = qs('orden')?.value.trim() ?? '';
    const estado = qs('estado')?.value ?? '';
    const fechaIngreso = qs('fechaIngreso')?.value ?? '';

    const apiBase = buscarBtn?.dataset.apiBase;
    const token = localStorage.getItem('token');

    const filtros = {
      orderName: orden,
      customerName: cliente,
      estado: estado !== 'Todos' && estado !== '' ? estado : undefined,
      fechaIngreso: fechaIngreso || undefined
    };
    Object.keys(filtros).forEach(key => {
      if (filtros[key] === undefined || filtros[key] === '') {
        delete filtros[key];
      }
    });

    showSkeleton();

    try {
      const response = await fetch(`${apiBase}/api/orders/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(filtros)
      });
      const data = await response.json();
      currentData = Array.isArray(data) ? data : [];
      itemsPerPage = parseInt(itemsPerPageSelect.value, 10);
      currentPage = 1;
      renderPage();
    } catch (error) {
      console.error(error);
      tablaBody.innerHTML = `<tr><td colspan="6" class="px-4 py-4 text-center text-red-500">${t.searchError}</td></tr>`;
    }
  }

  function clearFilters() {
    qs('cliente').value = '';
    qs('orden').value = '';
    qs('estado').value = '';
    qs('fechaIngreso').value = '';
    performSearch(); // Recargar todos los registros
  }

  // Event Listeners
  itemsPerPageSelect.addEventListener('change', () => {
    itemsPerPage = parseInt(itemsPerPageSelect.value, 10);
    currentPage = 1;
    renderPage();
  });

  prevPageBtn.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      renderPage();
    }
  });

  nextPageBtn.addEventListener('click', () => {
    const totalPages = Math.ceil(currentData.length / itemsPerPage);
    if (currentPage < totalPages) {
      currentPage++;
      renderPage();
    }
  });

  buscarBtn.addEventListener('click', performSearch);

  limpiarBtn.addEventListener('click', clearFilters);

  // Event listeners para el combobox de clientes
  if (clienteInput) {
    // Cargar clientes al hacer focus
    clienteInput.addEventListener('focus', () => {
      // Recargar clientes si no hay o si se acaban de limpiar
      if (allCustomers.length === 0) {
        loadCustomers();
      }
      toggleCustomerDropdown();
    });

    // Filtrar al escribir
    clienteInput.addEventListener('input', (e) => {
      filterCustomers(e.target.value);
      if (clienteDropdownIcon) {
        clienteDropdownIcon.style.transform = 'rotate(180deg)';
      }
    });

    // Cerrar dropdown al perder focus
    clienteInput.addEventListener('blur', () => {
      setTimeout(() => {
        // Solo cerrar si no se hizo click en el dropdown o en el icono
        if (clienteDropdown && !clienteDropdown.contains(document.activeElement) && !clienteDropdownIcon.contains(document.activeElement)) {
          clienteDropdown.classList.add('hidden');
        }
        if (clienteDropdownIcon) {
          clienteDropdownIcon.style.transform = 'rotate(0deg)';
        }
      }, 200);
    });
  }

  // Click en el icono del dropdown
  if (clienteDropdownIcon) {
    clienteDropdownIcon.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Cargar clientes si es necesario
      if (allCustomers.length === 0) {
        loadCustomers();
      }
      
      // Toggle del dropdown
      const isHidden = clienteDropdown.classList.contains('hidden');
      if (isHidden) {
        filterCustomers(clienteInput.value);
        clienteDropdown.classList.remove('hidden');
        clienteDropdownIcon.style.transform = 'rotate(180deg)';
      } else {
        clienteDropdown.classList.add('hidden');
        clienteDropdownIcon.style.transform = 'rotate(0deg)';
      }
    });
  }

  // Click en las opciones del dropdown
  if (clienteDropdown) {
    clienteDropdown.addEventListener('click', (e) => {
      const option = e.target.closest('.customer-option');
      if (option) {
        const value = option.dataset.value;
        clienteInput.value = value;
        clienteDropdown.classList.add('hidden');
        if (clienteDropdownIcon) {
          clienteDropdownIcon.style.transform = 'rotate(0deg)';
        }
        // Mostrar botón de limpiar después de seleccionar
        toggleClearButton(clienteInput, clearClienteBtn);
      }
    });
  }

  // Event listeners para botones de limpiar
  if (clearOrdenBtn) {
    clearOrdenBtn.addEventListener('click', () => {
      clearField(qs('orden'), clearOrdenBtn);
    });
  }

  if (clearClienteBtn) {
    clearClienteBtn.addEventListener('click', () => {
      clearField(clienteInput, clearClienteBtn);
    });
  }

  // Event listeners para mostrar/ocultar botones de limpiar al escribir
  if (qs('orden')) {
    qs('orden').addEventListener('input', () => {
      toggleClearButton(qs('orden'), clearOrdenBtn);
    });
  }

  if (clienteInput) {
    clienteInput.addEventListener('input', () => {
      toggleClearButton(clienteInput, clearClienteBtn);
    });
  }

  // Event listener global para cerrar dropdown al hacer click fuera
  document.addEventListener('click', (e) => {
    // No cerrar si estamos en proceso de limpiar el campo
    if (isClearingField) return;
    
    const isClickInside = clienteInput?.contains(e.target) || 
                         clienteDropdown?.contains(e.target) || 
                         clienteDropdownIcon?.contains(e.target);
    
    if (!isClickInside && clienteDropdown && !clienteDropdown.classList.contains('hidden')) {
      clienteDropdown.classList.add('hidden');
      if (clienteDropdownIcon) {
        clienteDropdownIcon.style.transform = 'rotate(0deg)';
      }
    }
  });

  // Sombra en scroll
  if (head) setupScrollShadow(window, head);

  // Inicializar paginador
  renderPage();

  // Cargar clientes al inicializar
  loadCustomers();

  // Llamar a la búsqueda inicial al cargar la página
  performSearch();
}

// Función para abrir modal de edición (exportada para uso global)
export async function openEditOrderModal(orderId, currentName) {
  // Implementar lógica del modal de edición aquí

  try {
    // Por ahora solo muestra una notificación
    showNotification('Función de edición en desarrollo', 'info');
    
    // También mostrar una notificación de éxito después de 1 segundo
    setTimeout(() => {
      showNotification('Orden cargada correctamente', 'success');
    }, 1000);
  } catch (error) {
    console.error('Error al mostrar notificación:', error);
  }
} 