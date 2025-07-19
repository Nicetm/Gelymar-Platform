import { 
  qs, 
  showNotification, 
  showModal,
  hideModal,
  setupModalClose,
  formatDate
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
  const apiBase = import.meta.env?.PUBLIC_API_URL || 'http://localhost:3000';
  
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
  const addFolderBtn = qs('addFolderBtn');
  const addIcon = qs('addIcon');
  const spinnerIcon = qs('spinnerIcon');
  const allRows = Array.from(tableBody?.querySelectorAll('tr') || []);

  let currentPage = 1;
  let itemsPerPage = parseInt(itemsPerPageSelect?.value || '10', 10);
  let filteredRows = [...allRows];

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
          <td class="px-6 py-4 items-center gap-3">${folder.name}</td>
          <td class="px-4 py-3 break-all text-blue-600 dark:text-blue-400">${folder.path}</td>
          <td class="px-6 py-4 items-center gap-3">${formatDate(folder.created_at)}</td>
          <td class="px-6 py-4 items-center text-center gap-3">${folder.fileCount}</td>
          <td class="w-[25%] px-6 py-4 text-sm">
            <div class="flex justify-center items-center gap-3 text-gray-900 dark:text-white">
              <a href="/admin/clients/documents/view/${folder.customer_uuid}?f=${folder.id}&pc=${folder.name}&c=${clientName}" title="Ver documentos en ${folder.name}" class="hover:text-blue-500 transition">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              </a>
              <a href="#" title="Ver Lista de archivos de ${folder.name}" class="hover:text-indigo-500 transition">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16"/>
                </svg>
              </a>
              <a href="#" title="Editar ${folder.name}" class="hover:text-green-500 transition">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536M9 11l6.586-6.586a2 2 0 112.828 2.828L11.828 13.83a2 2 0 01-.586.414L9 15l.756-2.243a2 2 0 01.414-.586z" />
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19 20H5" />
                </svg>
              </a>
              <a href="#" title="Eliminar ${folder.name}" class="hover:text-red-500 transition">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 7h12M10 11v6M14 11v6M5 7l1 12a2 2 0 002 2h8a2 2 0 002-2l1-12M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
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

  addFolderBtn?.addEventListener('click', () => {
    if (addIcon) addIcon.classList.add('hidden');
    if (spinnerIcon) spinnerIcon.classList.remove('hidden');
    
    setTimeout(() => {
      const uploadModal = qs('addFolderModal');
      if (spinnerIcon) spinnerIcon.classList.add('hidden');
      if (addIcon) addIcon.classList.remove('hidden');
      
      if (uploadModal) {
        uploadModal.dataset.clientName = clientName;
        showModal('#addFolderModal');
      }
    }, 500);
  });

  // Configurar cierre del modal manualmente
  const cancelUploadBtn = qs('cancelUploadBtn');
  const closeModalBtn = qs('closeModalBtn');
  
  if (cancelUploadBtn) {
    cancelUploadBtn.addEventListener('click', () => {
      hideModal('#addFolderModal');
      const uploadFolderName = qs('uploadFolderName');
      if (uploadFolderName) uploadFolderName.value = '';
    });
  }
  
  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', () => {
      hideModal('#addFolderModal');
      const uploadFolderName = qs('uploadFolderName');
      if (uploadFolderName) uploadFolderName.value = '';
    });
  }

  const confirmUploadBtn = qs('confirmUploadBtn');
  if (confirmUploadBtn) {
    confirmUploadBtn.addEventListener('click', async () => {
      const folderName = qs('uploadFolderName')?.value?.trim();
      const folderMessage = qs('folderMessage');
      
      if (folderMessage) {
        folderMessage.textContent = '';
        folderMessage.classList.add('hidden');
      }

      if (!folderName) {
        showNotification(messages.folders?.folderNameRequired || "El campo N° SAP es obligatorio", "warning");
        return;
      }

      try {
        const response = await fetch(`${apiBase}/api/customers/uuid/${uuID}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`${messages.folders?.getCustomerError || 'Error al obtener cliente'}: ${response.status} - ${errorText}`);
        }

        const customer = await response.json();
        const customerId = customer.id;

        const res = await fetch(`${apiBase}/api/directories/create`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({ 
            customer_id: customerId, 
            name: folderName,
            path: `${clientName}/${folderName}`
          })
        });

        const result = await res.json();
        if (!res.ok) throw new Error(result.message);

        await refreshFolders();
        hideModal('#addFolderModal');
        
        const uploadFolderName = qs('uploadFolderName');
        if (uploadFolderName) uploadFolderName.value = '';

        showNotification(messages.folders?.folderCreatedSuccess || "Carpeta creada correctamente", "success");

      } catch (err) {
        showNotification(err.message || (messages.folders?.folderCreatedError || 'Error al crear carpeta'), "error");
      }
    });
  }

  renderTable();
} 