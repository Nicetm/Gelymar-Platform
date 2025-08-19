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



export async function initClientsScript() {
  // Obtener apiBase - usar localhost para JavaScript del cliente
  const apiBase = import.meta.env?.PUBLIC_API_URL || 'http://localhost:3000';
  
  // Usar traducciones ya cargadas por Astro
  const translations = window.translations || {};
  const messages = translations.messages || {};
  const clientes = translations.clientes || {};
  
  // Verificar que todos los elementos necesarios existan
  const searchInput = qs('searchInput');
  const filterWithOrders = qs('filterWithOrders');
  const itemsPerPageSelect = qs('itemsPerPageSelect');
  const prevPageBtn = qs('prevPageBtn');
  const nextPageBtn = qs('nextPageBtn');
  const pageIndicator = qs('pageIndicator');
  const tableBody = qs('customersTableBody');
  
  // Verificar que los elementos críticos existan
  if (!tableBody || !searchInput || !itemsPerPageSelect || !prevPageBtn || !nextPageBtn || !pageIndicator) {
    console.error('Elementos necesarios no encontrados para el paginador');
    return;
  }
  
  const allRows = Array.from(tableBody.querySelectorAll('tr'));

  let currentPage = 1;
  let itemsPerPage = parseInt(itemsPerPageSelect.value, 10);
  let filteredRows = [...allRows];
  let currentSort = { column: null, direction: 'asc' };

  /**
   * Función principal de render de la tabla según búsqueda y paginación.
   * Oculta todas las filas y solo muestra las correspondientes a la página actual.
   */
  function renderTable() {
    allRows.forEach(originalRow => {
      const row = originalRow;
      row.style.display = 'none';
    });

    const start = (currentPage - 1) * itemsPerPage;
    const pageData = filteredRows.slice(start, start + itemsPerPage);
    
    pageData.forEach(originalRow => {
      const row = originalRow;
      row.style.display = '';
    });

    const totalPages = Math.ceil(filteredRows.length / itemsPerPage);
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
    
    // Para la columna de órdenes, convertir a número
    if (columnIndex === 6) { // order_count
      return parseInt(value, 10) || 0;
    }
    
    return value.toLowerCase();
  }

  /**
   * Función para ordenar las filas
   */
  function sortRows(column, direction) {
    const columnMap = {
      'name': 0,
      'rut': 1,
      'email': 2,
      'phone': 3,
      'country': 4,
      'city': 5,
      'order_count': 6
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

  /**
   * Función para filtrar filas según búsqueda y filtro de órdenes
   */
  function filterRows() {
    const query = searchInput.value.toLowerCase();
    const onlyWithOrders = filterWithOrders.checked;
    
    filteredRows = allRows.filter(row => {
      // Filtro por búsqueda de texto
      const text = row.textContent.toLowerCase();
      const matchesSearch = text.includes(query);
      
      // Filtro por órdenes
      let matchesOrderFilter = true;
      if (onlyWithOrders) {
        // Buscar la celda que contiene el número de órdenes (columna 6, índice 6)
        const orderCountCell = row.cells[6]; // La columna "directory" que muestra order_count
        if (orderCountCell) {
          const orderCount = parseInt(orderCountCell.textContent.trim(), 10);
          matchesOrderFilter = orderCount > 0;
        }
      }
      
      return matchesSearch && matchesOrderFilter;
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
   * Filtro por órdenes: muestra solo clientes con órdenes > 0
   */
  filterWithOrders.addEventListener('change', filterRows);

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
    // Obtener las filas filtradas actuales
    const rowsToExport = filteredRows.length > 0 ? filteredRows : allRows;
    
    if (rowsToExport.length === 0) {
              Swal.fire({
          icon: 'warning',
          title: 'No hay datos para exportar',
          text: 'No hay clientes disponibles para exportar.',
          confirmButtonText: window.translations?.comond?.understood || 'Entendido'
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
      'N° Órdenes'
    ];

    // Preparar los datos para exportar
    const data = rowsToExport.map(row => {
      const cells = row.cells;
      return [
        cells[0]?.textContent?.trim() || '', // Nombre
        cells[1]?.textContent?.trim() || '', // RUT
        cells[2]?.textContent?.trim() || '', // Email
        cells[3]?.textContent?.trim() || '', // Teléfono
        cells[4]?.textContent?.trim() || '', // País
        cells[5]?.textContent?.trim() || '', // Ciudad
        cells[6]?.textContent?.trim() || '0' // N° Órdenes
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
    
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `clientes_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url); // Liberar memoria
      
      // Mostrar mensaje de éxito
      Swal.fire({
        icon: 'success',
        title: 'Exportación exitosa',
        text: `Se exportaron ${rowsToExport.length} clientes a Excel.`,
        confirmButtonText: window.translations?.comond?.understood || 'Entendido'
      });
    } else {
      // Fallback para navegadores que no soportan download
      Swal.fire({
        icon: 'error',
        title: 'Error de exportación',
        text: 'Tu navegador no soporta la descarga automática. Copia el contenido manualmente.',
        confirmButtonText: window.translations?.comond?.understood || 'Entendido'
      });
    }
  }

  /**
   * Event listener para el botón de exportar
   */
  const exportExcelBtn = document.getElementById('exportExcelBtn');
  if (exportExcelBtn) {
    exportExcelBtn.addEventListener('click', exportToExcel);
  }

  /**
   * Funcionalidad del modal de perfil
   */
  const profileModal = document.getElementById('profileModal');
  const closeProfileModalBtn = document.getElementById('closeProfileModalBtn');
  const profileEmail = document.getElementById('profileEmail');
  const saveEmailBtn = document.getElementById('saveEmailBtn');
  const viewOrdersBtn = document.getElementById('viewOrdersBtn');
  const updateCustomerBtn = document.getElementById('updateCustomerBtn');

  let currentProfileCustomer = null;
  
  // Obtener el token del localStorage
  const token = localStorage.getItem('token');

  /**
   * Función para obtener las iniciales del nombre
   */
  function getInitials(name) {
    if (!name) return 'CL';
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  /**
   * Función para abrir el modal de perfil
   */
  function openProfileModal(customerData) {
    currentProfileCustomer = customerData;
    
    // Llenar los datos del modal
    document.getElementById('profileInitials').textContent = getInitials(customerData.name);
    document.getElementById('profileClientName').textContent = customerData.name;
    document.getElementById('profileClientRut').textContent = customerData.rut;
    document.getElementById('profileCountry').textContent = customerData.country || 'No especificado';
    document.getElementById('profileCity').textContent = customerData.city || 'No especificado';
    document.getElementById('profilePhone').textContent = customerData.phone || 'No especificado';
    document.getElementById('profileEmail').value = customerData.email || '';
    document.getElementById('profileOrderCount').textContent = customerData.order_count || '0';
    
    // Configurar el link de órdenes
    const ordersLink = `/admin/clients/folders/view/${customerData.uuid}?c=${encodeURIComponent(customerData.name)}`;
    viewOrdersBtn.onclick = () => {
      closeProfileModal();
      window.location.href = ordersLink;
    };
    
    // Mostrar el modal
    profileModal.classList.remove('hidden');
    profileModal.classList.add('flex');
  }

  /**
   * Función para cerrar el modal de perfil
   */
  function closeProfileModal() {
    profileModal.classList.add('hidden');
    profileModal.classList.remove('flex');
    currentProfileCustomer = null;
    
    // Resetear el botón de guardar
    saveEmailBtn.classList.add('hidden');
  }

  /**
   * Event listeners para el modal de perfil
   */
  if (closeProfileModalBtn) {
    closeProfileModalBtn.addEventListener('click', closeProfileModal);
  }

  // Cerrar modal al hacer clic fuera
  if (profileModal) {
    profileModal.addEventListener('click', (e) => {
      if (e.target === profileModal) {
        closeProfileModal();
      }
    });
  }

  // Mostrar botón de guardar cuando se edita el email
  if (profileEmail) {
    profileEmail.addEventListener('input', () => {
      const originalEmail = currentProfileCustomer?.email || '';
      const currentEmail = profileEmail.value;
      
      if (currentEmail !== originalEmail) {
        saveEmailBtn.classList.remove('hidden');
      } else {
        saveEmailBtn.classList.add('hidden');
      }
    });
  }

  // Guardar email
  if (saveEmailBtn) {
    saveEmailBtn.addEventListener('click', async () => {
      if (!currentProfileCustomer) return;
      
      const newEmail = profileEmail.value.trim();
      
      if (!newEmail) {
        Swal.fire({
          icon: 'error',
          title: window.translations?.clientes?.emailRequired || 'Email requerido',
          text: window.translations?.clientes?.emailEmpty || 'El campo email no puede estar vacío.',
          confirmButtonText: window.translations?.comond?.understood || 'Entendido'
        });
        return;
      }

      try {
        const response = await fetch(`${apiBase}/api/customers/${currentProfileCustomer.uuid}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ email: newEmail })
        });

        if (response.ok) {
          // Actualizar el cliente en la lista local
          const customerRow = document.querySelector(`tr[data-id="${currentProfileCustomer.id}"]`);
          if (customerRow) {
            const emailCell = customerRow.cells[2]; // Columna del email
            if (emailCell) {
              emailCell.textContent = newEmail;
            }
          }
          
          // Actualizar el cliente actual
          currentProfileCustomer.email = newEmail;
          
          // Ocultar botón de guardar
          saveEmailBtn.classList.add('hidden');
          
          Swal.fire({
            icon: 'success',
            title: window.translations?.clientes?.customerUpdated || 'Cliente actualizado',
            text: window.translations?.clientes?.customerUpdatedSuccess || 'El cliente se ha actualizado correctamente en la base de datos.',
            confirmButtonText: window.translations?.comond?.understood || 'Entendido'
          });
        } else {
          throw new Error('Error al actualizar el email');
        }
      } catch (error) {
        console.error('Error updating email:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: window.translations?.clientes?.updateError || 'No se pudo actualizar el cliente. Inténtalo de nuevo.',
          confirmButtonText: window.translations?.comond?.understood || 'Entendido'
        });
      }
    });
  }

  // Botón actualizar cliente
  if (updateCustomerBtn) {
    updateCustomerBtn.addEventListener('click', async () => {
      if (!currentProfileCustomer) return;
      
      const newEmail = profileEmail.value.trim();
      
      if (!newEmail) {
        Swal.fire({
          icon: 'error',
          title: window.translations?.clientes?.emailRequired || 'Email requerido',
          text: window.translations?.clientes?.emailEmpty || 'El campo email no puede estar vacío.',
          confirmButtonText: window.translations?.comond?.understood || 'Entendido'
        });
        return;
      }

      try {
        const response = await fetch(`${apiBase}/api/customers/${currentProfileCustomer.uuid}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ email: newEmail })
        });

        if (response.ok) {
          // Actualizar el cliente en la lista local
          const customerRow = document.querySelector(`tr[data-id="${currentProfileCustomer.id}"]`);
          if (customerRow) {
            const emailCell = customerRow.cells[2]; // Columna del email
            if (emailCell) {
              emailCell.textContent = newEmail;
            }
          }
          
          // Actualizar el cliente actual
          currentProfileCustomer.email = newEmail;
          
          // Ocultar botón de guardar
          saveEmailBtn.classList.add('hidden');
          
          // Cerrar el modal
          closeProfileModal();
          
          Swal.fire({
            icon: 'success',
            title: window.translations?.clientes?.customerUpdated || 'Cliente actualizado',
            text: window.translations?.clientes?.customerUpdatedSuccess || 'El cliente se ha actualizado correctamente en la base de datos.',
            confirmButtonText: window.translations?.comond?.understood || 'Entendido'
          });
        } else {
          throw new Error('Error al actualizar el cliente');
        }
      } catch (error) {
        console.error('Error updating customer:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: window.translations?.clientes?.updateError || 'No se pudo actualizar el cliente. Inténtalo de nuevo.',
          confirmButtonText: window.translations?.comond?.understood || 'Entendido'
        });
      }
    });
  }

  /**
   * Event listener para los botones "View more details"
   */
  document.addEventListener('click', (e) => {
    const viewDetailsBtn = e.target.closest('a[data-uuid]');
    if (viewDetailsBtn && !viewDetailsBtn.classList.contains('manage-contacts-btn')) {
      e.preventDefault();
      
      const uuid = viewDetailsBtn.dataset.uuid;
      const customerRow = viewDetailsBtn.closest('tr');
      
      if (customerRow) {
        const customerData = {
          id: customerRow.dataset.id,
          uuid: uuid,
          name: customerRow.cells[0]?.textContent?.trim() || '',
          rut: customerRow.cells[1]?.textContent?.trim() || '',
          email: customerRow.cells[2]?.textContent?.trim() || '',
          phone: customerRow.cells[3]?.textContent?.trim() || '',
          country: customerRow.cells[4]?.textContent?.trim() || '',
          city: customerRow.cells[5]?.textContent?.trim() || '',
          order_count: customerRow.cells[6]?.textContent?.trim() || '0'
        };
        
        openProfileModal(customerData);
      }
    }
  });

  /**
   * Manejo del cambio en cantidad de items por página.
   */
  itemsPerPageSelect.addEventListener('change', () => {
    itemsPerPage = parseInt(itemsPerPageSelect.value, 10);
    currentPage = 1;
    renderTable();
  });

  /**
   * Navegación hacia la página anterior
   */
  prevPageBtn.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage-=1;
      renderTable();
    }
  });

  /**
   * Navegación hacia la página siguiente
   */
  nextPageBtn.addEventListener('click', () => {
    const totalPages = Math.ceil(filteredRows.length / itemsPerPage);
    if (currentPage < totalPages) {
      currentPage+=1;
      renderTable();
    }
  });

  // Render inicial de la tabla al cargar
  renderTable();

  // Funcionalidad del modal de contactos
  let currentClientUuid = null;
  let currentClientName = null;

  // Event listener para abrir modal de contactos
  document.addEventListener('click', (e) => {
    if (e.target.closest('.manage-contacts-btn')) {
      e.preventDefault();
      const btn = e.target.closest('.manage-contacts-btn');
      currentClientUuid = btn.dataset.uuid;
      currentClientName = btn.dataset.name;
      
      // Actualizar header del modal con logo y nombre
      document.getElementById('contactsInitials').textContent = getInitials(currentClientName);
      document.getElementById('contactsClientName').textContent = currentClientName;
      
      // Mostrar modal
      showModal('#contactsModal');
      
      // Cargar contactos existentes
      loadContacts(currentClientUuid);
    }
  });

  // Configurar cierre del modal
  setupModalClose('#contactsModal', '#closeContactsModalBtn, #cancelAddContactBtn');

  // Función para cargar contactos existentes
  async function loadContacts(clientUuid) {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${apiBase}/api/customers/${clientUuid}/contacts`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const tableDiv = qs('existingContactsTable');
      const formContainer = qs('contactsFormContainer');
      
      // Limpiar ambos contenedores
      clearContainer(tableDiv);
      clearContainer(formContainer);

      if (response.ok) {
        const contacts = await response.json();
        if (contacts.length > 0) {
          let tableHtml = `
            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700 table-fixed">
              <thead class="bg-gray-100 dark:bg-gray-800 sticky top-0 z-10">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">Name</th>
                  <th class="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">Email</th>
                  <th class="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
          `;
          contacts.forEach(contact => {
            tableHtml += `
              <tr class="hover:bg-gray-100 dark:hover:bg-gray-800 transition">
                <td class="px-4 py-2 border-b border-gray-200 dark:border-gray-700">${contact.name}</td>
                <td class="px-4 py-2 border-b border-gray-200 dark:border-gray-700">${contact.email}</td>
                <td class="px-4 py-2 border-b border-gray-200 dark:border-gray-700 text-center">
                  <button class="delete-existing-contact-btn text-red-500 hover:text-red-700 transition" data-contact-id="${contact.id}" title="Eliminar">
                    <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </td>
              </tr>
            `;
          });
          tableHtml += `</tbody></table>`;
          tableDiv.innerHTML = tableHtml;
        }
        // Siempre deja al menos una fila vacía para agregar nuevos
        addContactRow();
      } else {
        addContactRow();
      }
    } catch (error) {
      clearContainer(qs('existingContactsTable'));
      clearContainer(qs('contactsFormContainer'));
      addContactRow();
    }
  }

  // Event listener para eliminar contactos
  document.addEventListener('click', async (e) => {
    if (e.target.closest('.delete-existing-contact-btn')) {
      const btn = e.target.closest('.delete-existing-contact-btn');
      const contactId = btn.dataset.contactId;
      
      const confirmed = await confirmAction(
        '¿Estás seguro?',
        '¿Deseas eliminar este contacto?'
      );
      
      if (confirmed) {
        try {
          const token = localStorage.getItem('token');
          const response = await fetch(`${apiBase}/api/customer/contacts/${contactId}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          if (response.ok) {
            await loadContacts(currentClientUuid);
            showNotification('Contacto eliminado correctamente', 'success');
          } else {
            showNotification('Error al eliminar contacto', 'error');
          }
        } catch (error) {
          showNotification('Error al eliminar contacto', 'error');
        }
      }
    }
  });

  // Función para limpiar formulario de contacto
  function clearContactForm() {
    const container = qs('contactsFormContainer');
    // Mantener solo la primera fila
    const firstRow = container.querySelector('.contact-row');
    clearContainer(container);
    container.appendChild(firstRow);
    
    // Limpiar los campos de la primera fila
    firstRow.querySelector('.contact-name').value = '';
    firstRow.querySelector('.contact-email').value = '';
  }

  // Helper para agregar una fila de contacto nueva
  function addContactRow() {
    const container = qs('contactsFormContainer');
    const newRow = document.createElement('div');
    const isFirstRow = container.querySelectorAll('.contact-row').length === 0;
    newRow.className = 'contact-row flex gap-2 mb-2 items-end';

    newRow.innerHTML = `
      <div class="flex-1">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
        <input type="text" class="contact-name w-full mt-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <div class="flex-1">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
        <input type="email" class="contact-email w-full mt-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <div class="flex items-end pt-4">
        ${isFirstRow ? '' : `<button class="remove-contact-row text-red-500 hover:text-red-700 transition" title="Eliminar">
          <svg class="w-5 h-12 inline" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>`}
      </div>
    `;
    container.appendChild(newRow);
  }

  // Event listener para el botón "+"
  document.addEventListener('click', (e) => {
    if (e.target.closest('#addContactRowBtn')) {
      addContactRow();
    }
    if (e.target.closest('.remove-contact-row')) {
      const row = e.target.closest('.contact-row');
      row.remove();
    }
  });

  // Event listener para agregar nuevos contactos
  const addContactBtn = qs('addContactBtn');
  if (addContactBtn) {
    addContactBtn.addEventListener('click', async () => {
      // Validar que todos los contactos tengan nombre y email
      const contactRows = document.querySelectorAll('.contact-row');
      const contacts = [];
      let invalid = false;
      contactRows.forEach(row => {
        const name = row.querySelector('.contact-name').value.trim();
        const email = row.querySelector('.contact-email').value.trim();
        if (!name || !email) {
          invalid = true;
        }
        if (!isValidEmail(email)) {
          invalid = true;
        }
        contacts.push({ name, email });
      });
      if (invalid) {
        showNotification(messages.clients.addContactValidation, 'error');
        return;
      }

      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${apiBase}/api/customers/contacts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            customer_id: currentClientUuid,
            contacts
          })
        });

        if (response.ok) {
          // Cierra el modal
          hideModal('#contactsModal');
          const message = contacts.length > 1 
            ? `${contacts.length} ${messages.clients.contactsAddedPlural}`
            : `1 ${messages.clients.contactsAdded}`;
          showNotification(message, 'success');
        } else {
          const error = await response.json();
          showNotification(error.message || messages.clients.addContactError, 'error');
        }
      } catch (error) {
        showNotification(messages.clients.addContactError, 'error');
      }
    });
  }
} 