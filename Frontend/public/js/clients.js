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

export function initClientsScript() {
  // Obtener apiBase desde las variables de entorno
  const apiBase = import.meta.env?.PUBLIC_API_URL || 'http://localhost:3000';
  
  // Verificar que todos los elementos necesarios existan
  const searchInput = qs('searchInput');
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
    pageIndicator.textContent = `Page ${currentPage} of ${totalPages}`;
  }

  /**
   * Buscador dinámico: filtra las filas según el texto ingresado.
   */
  searchInput.addEventListener('input', () => {
    const query = searchInput.value.toLowerCase();
    filteredRows = allRows.filter(row => {
      const text = row.textContent.toLowerCase();
      return text.includes(query);
    });
    currentPage = 1;
    renderTable();
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
      
      // Actualizar título del modal
      document.getElementById('clientNameTitle').textContent = currentClientName;
      
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
        '¿Eliminar contacto?',
        'Esta acción no se puede deshacer.'
      );
      
      if (confirmed) {
        try {
          const token = localStorage.getItem('token');
          const response = await fetch(`${apiBase}/api/customer-contacts/${contactId}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          if (response.ok) {
            await loadContacts(currentClientUuid);
            showNotification('Contacto eliminado correctamente', 'success');
          } else {
            showNotification('No se pudo eliminar el contacto', 'error');
          }
        } catch (error) {
          showNotification('No se pudo eliminar el contacto', 'error');
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
        showNotification('Todos los contactos deben tener nombre y un email válido', 'error');
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
          showNotification(`${contacts.length} contacto${contacts.length > 1 ? 's' : ''} agregado${contacts.length > 1 ? 's' : ''} correctamente`, 'success');
        } else {
          const error = await response.json();
          showNotification(error.message || 'Error al agregar los contactos', 'error');
        }
      } catch (error) {
        showNotification('Error al agregar los contactos', 'error');
      }
    });
  }
} 