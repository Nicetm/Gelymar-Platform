// Importar funciones de utilidad
import { showNotification } from './utils.js';

// Función local para compatibilidad
function qs(selector) {
  return document.querySelector(selector);
}

function showSuccess(message) {
  showNotification(message, 'success');
}

function showError(message) {
  showNotification(message, 'error');
}

function showSpinner() {
  const spinner = qs('#globalSpinner');
  if (spinner) {
    spinner.classList.remove('invisible');
    spinner.classList.add('visible');
  }
}

function hideSpinner() {
  const spinner = qs('#globalSpinner');
  if (spinner) {
    spinner.classList.add('invisible');
    spinner.classList.remove('visible');
  }
}

function getValidToken() {
  const token = localStorage.getItem('token');
  if (!token) return null;
  
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const currentTime = Date.now() / 1000;
    
    if (payload.exp < currentTime) {
      localStorage.removeItem('token');
      return null;
    }
    
    return token;
  } catch (error) {
    console.error('Error validando token:', error);
    localStorage.removeItem('token');
    return null;
  }
}

function confirmAction(title, message, type = 'warning') {
  return new Promise((resolve) => {
    // Crear el modal
    const modal = document.createElement('div');
    modal.id = 'customConfirmModal';
    modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4';
    
    // Iconos según el tipo (con colores que funcionan en modo oscuro)
    const icons = {
      warning: `<svg class="w-12 h-12 text-amber-500 dark:text-amber-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
      </svg>`,
      error: `<svg class="w-12 h-12 text-red-500 dark:text-red-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>`,
      info: `<svg class="w-12 h-12 text-blue-500 dark:text-blue-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>`,
      success: `<svg class="w-12 h-12 text-green-500 dark:text-green-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>`,
      question: `<svg class="w-12 h-12 text-blue-500 dark:text-blue-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>`
    };
    
    // Colores de botones según el tipo
    const buttonColors = {
      warning: 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500',
      error: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
      info: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
      success: 'bg-green-600 hover:bg-green-700 focus:ring-green-500',
      question: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
    };
    
    modal.innerHTML = `
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full mx-4 transform transition-all duration-300 scale-95 opacity-0" id="confirmModalContent">
        <div class="p-6">
          <div class="flex items-center justify-center mb-4">
            ${icons[type] || icons.warning}
          </div>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white text-center mb-2">${title}</h3>
          <p class="text-sm text-gray-600 dark:text-gray-300 text-center mb-6">${message}</p>
          <div class="flex gap-3 justify-end">
            <button id="confirmCancel" class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500">
              Cancelar
            </button>
            <button id="confirmAccept" class="px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${buttonColors[type] || buttonColors.warning}">
              Sí, continuar
            </button>
          </div>
        </div>
      </div>
    `;
    
    // Agregar al DOM
    document.body.appendChild(modal);
    
    // Animar entrada
    setTimeout(() => {
      const content = document.getElementById('confirmModalContent');
      content.classList.remove('scale-95', 'opacity-0');
      content.classList.add('scale-100', 'opacity-100');
    }, 10);
    
    // Event listeners
    const handleCancel = () => {
      animateOut(() => {
        document.body.removeChild(modal);
        resolve(false);
      });
    };
    
    const handleAccept = () => {
      animateOut(() => {
        document.body.removeChild(modal);
        resolve(true);
      });
    };
    
    const animateOut = (callback) => {
      const content = document.getElementById('confirmModalContent');
      content.classList.remove('scale-100', 'opacity-100');
      content.classList.add('scale-95', 'opacity-0');
      setTimeout(callback, 300);
    };
    
    // Event listeners
    document.getElementById('confirmCancel').addEventListener('click', handleCancel);
    document.getElementById('confirmAccept').addEventListener('click', handleAccept);
    
    // Cerrar con Escape
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        handleCancel();
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);
    
    // Cerrar clickeando fuera del modal
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        handleCancel();
      }
    });
  });
}

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

function setupDragAndDrop(dropZone, onFiles) {
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('border-blue-500', 'bg-blue-50');
  });

  dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropZone.classList.remove('border-blue-500', 'bg-blue-50');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('border-blue-500', 'bg-blue-50');
    const files = Array.from(e.dataTransfer.files);
    onFiles(files);
  });
}

function setupScrollShadow(window, head) {
  window.addEventListener('scroll', () => {
    if (window.scrollY > 0) {
      head.classList.add('shadow-md');
    } else {
      head.classList.remove('shadow-md');
    }
  });
}

function showGlobalSpinner() {
  const spinner = qs('#globalSpinner');
  if (spinner) {
    spinner.classList.remove('invisible');
    spinner.classList.add('visible');
  }
}

function hideGlobalSpinner() {
  const spinner = qs('#globalSpinner');
  if (spinner) {
    spinner.classList.add('invisible');
    spinner.classList.remove('visible');
  }
}

export function initFilesScript() {
  const section = qs('#filesSection');
  const tableBody = qs('#filesTableBody');
  const searchInput = qs('#searchInput');
  const itemsPerPageSelect = qs('#itemsPerPageSelect');
  const prevPageBtn = qs('#prevPageBtn');
  const nextPageBtn = qs('#nextPageBtn');
  const pageIndicator = qs('#pageIndicator');
  const uploadFileBtn = qs('#uploadFileBtn');
  const createDefaultFilesBtn = qs('#createDefaultFilesBtn');
  const addIcon = qs('#addIcon');
  const spinnerIcon = qs('#spinnerIcon');
  const uploadModal = qs('#uploadModal');
  const uploadCard = uploadModal?.querySelector('.modal-card');

  function showUploadModal() {
    uploadModal.classList.remove('hidden', 'opacity-0');
    uploadModal.classList.add('flex');
    // Trigger card entrance on next frame
    requestAnimationFrame(() => {
      uploadCard.classList.remove('opacity-0', 'scale-90', 'translate-y-6');
    });
  }

  function hideUploadModal() {
    // Start exit animation
    uploadModal.classList.add('opacity-0');
    uploadCard.classList.add('opacity-0', 'scale-90', 'translate-y-6');
    uploadModal.addEventListener(
      'transitionend',
      function handler() {
        uploadModal.removeEventListener('transitionend', handler);
        uploadModal.classList.remove('flex');
        uploadModal.classList.add('hidden');
      },
      { once: true },
    );
  }

  // Close modal when clicking on the backdrop
  uploadModal?.addEventListener('click', (e) => {
    if (e.target === uploadModal) hideUploadModal();
  });

  const uuid = section?.dataset.uuid;
  const folderId = section?.dataset.folderId;
  const apiBase = window.apiBase;
  const fileServer = window.fileServer;
  const lang = window.lang;
  const orderOc = window.orderOc;

  let currentPage = 1;
  let itemsPerPage = parseInt(itemsPerPageSelect?.value || '10', 10);
  const allRows = Array.from(tableBody?.querySelectorAll('tr') || []);
  let filteredRows = [...allRows];

  const params = new URLSearchParams(window.location.search);
  const pc = params.get('pc');

  // Validaciones iniciales
  if (!uuid || !folderId) {
    console.error('Faltan parámetros');
    return;
  }

  // Validar token usando función centralizada
  const token = getValidToken();
  if (!token) {
    return;
  }

  function renderTable() {
    const start = (currentPage - 1) * itemsPerPage;
    const pageData = filteredRows.slice(start, start + itemsPerPage);

    // Limpiar tabla
    tableBody.innerHTML = '';
    
    // Renderizar filas de la página actual
    pageData.forEach(row => {
      tableBody.appendChild(row);
    });
    
    // Si no hay datos, mostrar mensaje
    if (pageData.length === 0) {
      tableBody.innerHTML = `
        <tr class="bg-white dark:bg-gray-900">
          <td colspan="6" class="px-6 py-8 text-center text-gray-500">
            No se encontraron archivos
          </td>
        </tr>
      `;
    }

    const totalPages = Math.ceil(filteredRows.length / itemsPerPage);
    if (pageIndicator) {
      pageIndicator.textContent = `Página ${currentPage} de ${totalPages}`;
    }
  }

  itemsPerPageSelect?.addEventListener('change', () => {
    itemsPerPage = parseInt(itemsPerPageSelect.value, 10);
    currentPage = 1;
    renderTable();
  });

  prevPageBtn?.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      renderTable();
    }
  });

  nextPageBtn?.addEventListener('click', () => {
    const totalPages = Math.ceil(filteredRows.length / itemsPerPage);
    if (currentPage < totalPages) {
      currentPage++;
      renderTable();
    }
  });

  searchInput?.addEventListener('input', () => {
    const query = searchInput.value.toLowerCase();
    filteredRows = allRows.filter(row => {
      const textContent = row.textContent.toLowerCase();
      return textContent.includes(query);
    });
    currentPage = 1;
    renderTable();
  });

  function showGlobalSpinner() {
    const spinner = document.getElementById('globalSpinner');
    if (spinner) {
      spinner.classList.remove('invisible');
      spinner.classList.add('visible');
    }
  }

  function hideGlobalSpinner() {
    const spinner = document.getElementById('globalSpinner');
    if (spinner) {
      spinner.classList.remove('visible');
      spinner.classList.add('invisible');
    }
  }

  function renderFileRow(file) {
    const statusColors = {
      1: '#FF0000',    // Por Generar --> rojo
      2: '#00FF00',    // Generado --> verde
      3: '#00FFFF',    // Enviado --> celeste
      4: '#0000FF'     // Reenviado --> azul
    };

    let actions = `<div class="flex items-center gap-3 justify-center">`;

    if (file.status_id === 1) {
      actions += `
        <div class="relative group">
          <a href="#" class="generate-btn text-gray-900 dark:text-white hover:text-blue-500 transition" data-file-id="${file.id}">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 15.5A3.5 3.5 0 1 0 12 8.5a3.5 3.5 0 0 0 0 7zm7.5-.5a7.49 7.49 0 0 1-1.035 3.743l1.432 1.432a1 1 0 1 1-1.414 1.414l-1.432-1.432A7.49 7.49 0 0 1 12.5 20.5v2a1 1 0 1 1-2 0v-2a7.49 7.49 0 0 1-3.743-1.035l-1.432 1.432a1 1 0 1 1-1.414-1.414l1.432-1.432A7.49 7.49 0 0 1 3.5 15.5h-2a1 1 0 1 1 0-2h2a7.49 7.49 0 0 1 1.035-3.743L3.103 8.325a1 1 0 1 1 1.414-1.414l1.432 1.432A7.49 7.49 0 0 1 11.5 3.5v-2a1 1 0 1 1 2 0v2a7.49 7.49 0 0 1 3.743 1.035l1.432-1.432a1 1 0 1 1 1.414 1.414l-1.432 1.432A7.49 7.49 0 0 1 20.5 11.5h2a1 1 0 1 1 0 2h-2z" />
            </svg>
          </a>
          <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2
                      bg-blue-600 text-white text-xs rounded px-2 py-1 shadow-lg
                      opacity-0 group-hover:opacity-100 transition
                      pointer-events-none whitespace-nowrap z-50">
            ${window.translations?.documentos?.generate_document || 'Generar documento'}
          </div>
        </div>`;
    }

    if (file.status_id === 2) {
      actions += `
        <div class="relative group">
          <a href="#" class="send-btn text-gray-900 dark:text-white hover:text-blue-500 transition" data-file-id="${file.id}" data-file-name="${file.name}" data-order="${file.oc}">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </a>
          <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2
                      bg-blue-600 text-white text-xs rounded px-2 py-1 shadow-lg
                      opacity-0 group-hover:opacity-100 transition
                      pointer-events-none whitespace-nowrap z-50">
            ${window.translations?.documentos?.send_document || 'Enviar documento'}
          </div>
        </div>`;
    }

    if ([3, 4].includes(file.status_id)) {
      actions += `
        <div class="relative group">
          <a href="#" class="resend-btn text-gray-900 dark:text-white hover:text-yellow-500 transition" data-file-id="${file.id}" data-file-name="${file.name}" data-order="${file.oc}">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H7a4 4 0 010-8h1" />
            </svg>
          </a>
          <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2
                      bg-yellow-600 text-white text-xs rounded px-2 py-1 shadow-lg
                      opacity-0 group-hover:opacity-100 transition
                      pointer-events-none whitespace-nowrap z-50">
            ${window.translations?.documentos?.resend_document || 'Reenviar documento'}
          </div>
        </div>`;
    }

    if ([2, 3, 4].includes(file.status_id)) {
      actions += `
        <div class="relative group">
          <a href="#" onclick="downloadFile(${file.id})" class="text-gray-900 dark:text-white hover:text-blue-500 transition">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
          </a>
          <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2
                      bg-blue-600 text-white text-xs rounded px-2 py-1 shadow-lg
                      opacity-0 group-hover:opacity-100 transition
                      pointer-events-none whitespace-nowrap z-50">
            ${window.translations?.documentos?.view_document || 'Ver documento'}
          </div>
        </div>`;
    }

    // Definir archivos por defecto que no deben tener botón de eliminar
    const defaultFiles = [
      'Recepcion de orden',
      'Aviso de Embarque', 
      'Aviso de entrega',
      'Aviso de Disponibilidad de Orden'
    ];
    
    const isDefaultFile = defaultFiles.includes(file.name);
    
    actions += `
      <div class="relative group">
        <a href="#" class="edit-btn text-gray-900 dark:text-white hover:text-blue-500 transition" data-file-id="${file.id}">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </a>
        <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2
                    bg-blue-600 text-white text-xs rounded px-2 py-1 shadow-lg
                    opacity-0 group-hover:opacity-100 transition
                    pointer-events-none whitespace-nowrap z-50">
          ${window.translations?.documentos?.edit_document || 'Editar documento'}
        </div>
      </div>`;
      
    // Solo mostrar botón de eliminar si NO es un archivo por defecto
    if (!isDefaultFile) {
      actions += `
        <div class="relative group">
          <a href="#" class="delete-btn text-gray-900 dark:text-white hover:text-red-500 transition" data-file-id="${file.id}">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 7h12M10 11v6M14 11v6M5 7l1 12a2 2 0 002 2h8a2 2 0 002-2l1-12M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
            </svg>
          </a>
          <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2
                      bg-red-600 text-white text-xs rounded px-2 py-1 shadow-lg
                      opacity-0 group-hover:opacity-100 transition
                      pointer-events-none whitespace-nowrap z-50">
            ${window.translations?.documentos?.delete_document || 'Eliminar documento'}
          </div>
        </div>`;
    }
    
    actions += `</div>`;

    return `
      <tr data-id="${file.id}" class="transition-colors duration-150 hover:bg-gray-100 dark:hover:bg-gray-800 hover:shadow-[0_1px_3px_rgba(0,0,0,0.12)]">
        <td class="px-6 py-4 text-sm editable-filename cursor-pointer" data-id="${file.id}">
          <div class="inline-flex items-center gap-1 relative group">
            <span class="filename-text block truncate">${file.name}</span>
            <svg class="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5 M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2
                        bg-blue-600 text-white text-xs rounded px-2 py-1 shadow-lg
                        opacity-0 group-hover:opacity-100 transition
                        pointer-events-none whitespace-nowrap z-50">
              ${window.translations?.documentos?.double_click_to_edit || 'Doble clic para editar'}
            </div>
          </div>
        </td>
        <td class="px-4 py-3">
          <div class="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" class="mr-2">
              <circle cx="12" cy="12" r="6" fill="${statusColors[file.status_id] || '#808080'}"/>
            </svg>
            ${file.status_name || '-'}
          </div>
        </td>
        <td class="px-6 py-4 items-center gap-3">${new Date(file.created_at).toLocaleString("es-CL")}</td>
        <td class="px-6 py-4 items-center gap-3">${new Date(file.updated_at).toLocaleString("es-CL")}</td>
        <td data-v="${file.is_visible_to_client}" class="px-6 py-4 text-center">
          <div class="relative group">
            <label class="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                class="sr-only peer visibility-toggle"
                data-file-id="${file.id}"
                ${(file.is_visible_to_client == 1 || file.is_visible_to_client === true) ? 'checked' : ''} />
              <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
            <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2
                        bg-blue-600 text-white text-xs rounded px-2 py-1 shadow-lg
                        opacity-0 group-hover:opacity-100 transition
                        pointer-events-none whitespace-nowrap z-50">
              ${window.translations?.documentos?.enable_client_visibility || 'Habilitar documento al cliente'}
            </div>
          </div>
        </td>
        <td class="px-6 py-4 items-center gap-3">${actions}</td>
      </tr>
    `;
  }

  async function refreshFiles() {
    try {
      const res = await fetch(`${apiBase}/api/files/${uuid}?f=${folderId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const files = await res.json();

      if (tableBody) {
        // Limpiar tabla
        tableBody.innerHTML = '';
        
        // Renderizar filas
        files.forEach(file => {
          const rowHtml = renderFileRow(file);
          tableBody.insertAdjacentHTML('beforeend', rowHtml);
        });
        
        // Si no hay datos, mostrar mensaje
        if (files.length === 0) {
          tableBody.innerHTML = `
            <tr class="bg-white dark:bg-gray-900">
              <td colspan="6" class="px-6 py-8 text-center text-gray-500">
                No se encontraron archivos
              </td>
            </tr>
          `;
        }

        allRows.length = 0;
        allRows.push(...Array.from(tableBody.querySelectorAll('tr')));
        filteredRows = [...allRows];
        currentPage = 1;
        
        // Actualizar estado del botón de crear archivos por defecto
        updateCreateDefaultFilesButtonState(files.length);
        
        // Adjuntar event listeners a los checkboxes de visibilidad
        attachVisibilityEvents();
      }
    } catch (error) {
      console.error('DEBUG - refreshFiles - Error:', error);
      showNotification('Error al cargar archivos', 'error');
    }
  }

  function updateCreateDefaultFilesButtonState(filesCount) {
    if (createDefaultFilesBtn) {
      createDefaultFilesBtn.disabled = filesCount > 0;
    }
  }

  async function sendDocument(fileId, orderNumber, customMessage, action) {
    try {
      const res = await fetch(`${apiBase}/api/files/${action}/${fileId}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ orderNumber, customMessage })
      });

      const data = await res.json();

      if (!res.ok) {
        // Si es error específico de email no configurado
        if (data.error === 'NO_EMAIL_CONFIGURED') {
          showNotification(data.message, 'error');
          return;
        }
        showNotification(data.message || 'Error al enviar documento', 'error');
        return;
      }

      const message = action === 'send' ? 'Documento enviado correctamente' : 'Documento reenviado correctamente';
      showNotification(message, 'success');
      await refreshFiles();
    } catch (error) {
      console.error('Error enviando documento:', error);
      showNotification('Error al enviar documento', 'error');
    }
  }

  function openMessageModal(fileId, fileName, order, action) {
    const orderInput = qs('#orderNumber');
    const docInput = qs('#orderDocument');
    const messageInput = qs('#customMessage');

    if (orderInput) orderInput.value = order || '';
    if (docInput) docInput.value = fileName || '';
    if (messageInput) messageInput.value = '';
    
    // Guardar datos para usar en el event listener
    window.currentMessageData = { fileId, action };
    
    showModal('#messageModal');
  }

  // Función para abrir archivos en modal de forma segura
  window.downloadFile = async (fileId) => {
    try {
      if (!token) {
        showNotification('Debes iniciar sesión para ver archivos', 'error');
        return;
      }

      const response = await fetch(`${apiBase}/api/files/download/${fileId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        if (response.status === 403) {
          showNotification('No tienes permisos para acceder a este archivo', 'error');
        } else if (response.status === 404) {
          showNotification('Archivo no encontrado', 'error');
        } else {
          showNotification('Error al cargar archivo', 'error');
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
      const fileUrl = `/files/${fileId}?token=${token}`;
      window.open(fileUrl, '_blank');

    } catch (error) {
      console.error('Error cargando archivo:', error);
      showNotification('Error de conexión al cargar archivo', 'error');
    }
  };

  // Función para abrir modal con archivo
  function openFileModal(fileId, filename) {
    // Crear modal si no existe
    let modal = document.getElementById('file-viewer-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'file-viewer-modal';
      modal.className = 'fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50 hidden';
      modal.innerHTML = `
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-6xl max-h-[90vh] w-full mx-4 flex flex-col">
          <div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white" id="file-modal-title">${filename}</h3>
            <div class="flex items-center space-x-2">
              <button id="download-file-btn" class="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors" title="Descargar archivo">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
              </button>
              <button id="close-file-modal" class="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors" title="Cerrar">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
          </div>
          <div class="flex-1 p-4 overflow-hidden">
            <div id="file-content" class="w-full h-full flex items-center justify-center">
              <div class="text-center">
                <div class="inline-flex items-center justify-center w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full mb-4">
                  <svg class="w-6 h-6 text-blue-600 dark:text-blue-400 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
                <p class="text-sm text-gray-600 dark:text-gray-400">Cargando archivo...</p>
              </div>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      // Event listeners
      document.getElementById('close-file-modal').addEventListener('click', closeFileModal);
      document.getElementById('download-file-btn').addEventListener('click', async () => {
        try {
          const token = localStorage.getItem('token');
          const response = await fetch(`${apiBase}/api/files/download/${fileId}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
          } else {
            showNotification('Error al descargar archivo', 'error');
          }
        } catch (error) {
          showNotification('Error al descargar archivo', 'error');
        }
      });
      
      // Cerrar con ESC
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
          closeFileModal();
        }
      });
    }

    // Configurar contenido
    document.getElementById('file-modal-title').textContent = filename;
    
    // Mostrar modal primero
    modal.classList.remove('hidden');
    
    // Cargar archivo con token temporal
    loadFileWithToken(fileId);
  }

  // Función para cargar archivo con token temporal
  async function loadFileWithToken(fileId) {
    const fileContent = document.getElementById('file-content');
    
    try {
      console.log('🔍 apiBase:', apiBase);
      console.log('🔍 fileId:', fileId);
      
      // Usar endpoint con token como parámetro de consulta
      const token = localStorage.getItem('token');
      const iframeUrl = `${apiBase}/api/files/view-with-token/${fileId}?token=${encodeURIComponent(token)}`;
      console.log('URL del iframe:', iframeUrl);
      
      // Crear iframe con URL completa
      const iframe = document.createElement('iframe');
      iframe.id = 'file-iframe';
      iframe.className = 'w-full h-full border-0 rounded';
      iframe.src = iframeUrl;
      iframe.style.display = 'none';
      
      iframe.onload = function() {
        this.style.display = 'block';
      };
      
      iframe.onerror = function() {
        showFileError();
      };
      
      fileContent.innerHTML = '';
      fileContent.appendChild(iframe);
    } catch (error) {
      console.error('Error cargando archivo:', error);
      showFileError();
    }
  }

  // Función para cerrar modal
  function closeFileModal() {
    const modal = document.getElementById('file-viewer-modal');
    if (modal) {
      modal.classList.add('hidden');
      // Limpiar iframe para liberar memoria
      const iframe = document.getElementById('file-iframe');
      if (iframe) {
        iframe.src = '';
      }
    }
  }

  // Event delegation para botones de generar
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('.generate-btn');
    if (!btn) return;
    
    e.preventDefault();
    const { fileId } = btn.dataset;

    const confirmed = await confirmAction(
      '¿Generar documento?',
      'Esto generará un nuevo documento PDF.',
      'info'
    );

    if (confirmed) {
      // Mostrar loading en el botón
      const originalText = btn.innerHTML;
      btn.innerHTML = '<svg class="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path></svg>';
      btn.disabled = true;

      try {
        // Obtener idioma del localStorage
        const lang = localStorage.getItem('lang') || 'es';
        
        const res = await fetch(`${apiBase}/api/files/generate/${fileId}`, {
          method: 'POST',
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ lang })
        });

        if (!res.ok) throw new Error('Error al generar archivo');
        showNotification('Documento generado correctamente', 'success');
      } catch (err) {
        showNotification('Error al generar documento', 'error');
      } finally {
        // Restaurar botón
        btn.innerHTML = originalText;
        btn.disabled = false;
        await refreshFiles();
      }
    }
  });

  // Event delegation para botones de enviar/reenviar
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.send-btn, .resend-btn');
    if (!btn) return;
    e.preventDefault();

    const { fileId, fileName, order } = btn.dataset;
    const action = btn.classList.contains('send-btn') ? 'send' : 'resend';
    openMessageModal(fileId, fileName, order, action);
  });



  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('.delete-btn');
    if (!btn) return;

    e.preventDefault();
    const fileId = btn.dataset.fileId;

    const confirmed = await confirmAction(
      '¿Estás seguro?',
      'Esta acción eliminará el documento de forma permanente',
      'warning'
    );

    if (confirmed && fileId) {
      try {
        const res = await fetch(`${apiBase}/api/files/delete/${fileId}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        const data = await res.json();

        if (res.ok) {
          showNotification('Archivo eliminado correctamente', 'success');
          btn.closest('tr')?.remove();
        } else {
          showNotification(data.message || 'Error al eliminar el archivo', 'error');
        }
      } catch (err) {
        showNotification('Error al eliminar el archivo', 'error');
      }
    }
  });

  function openEditFileModal(fileId, currentName, currentVisible) {
    const modal = document.getElementById('editFileModal');
    const nameInput = document.getElementById('editFileName');
    const visibleSelect = document.getElementById('editFileVisible');
    
    // Llenar el modal con los datos actuales
    nameInput.value = currentName;
    visibleSelect.value = currentVisible ? '1' : '0';
    
    // Mostrar el modal usando la función correcta
    showModal('#editFileModal');
    
    // Enfocar el input
    nameInput.focus();
  }

  // Event delegation para botones de editar
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('.edit-btn');
    if (!btn) return;

    e.preventDefault();
    
    // Remover clase clicked de otros botones
    document.querySelectorAll('.edit-btn').forEach(b => b.classList.remove('clicked'));
    // Agregar clase clicked al botón actual
    btn.classList.add('clicked');
    
    const fileId = btn.dataset.fileId;

    const row = btn.closest('tr');
    const span = row?.querySelector('.filename-text');
    const currentName = span?.textContent?.trim() || '';
    const visibleCell = row?.querySelector('[data-v]');
    const currentVisible = visibleCell?.dataset?.v === '1';

    openEditFileModal(fileId, currentName, currentVisible);
  });

  // Event delegation para doble clic en nombre de archivo
  document.addEventListener('dblclick', async (e) => {
    const span = e.target.closest('.filename-text');
    if (!span) return;

    // Remover clase clicked de otros spans
    document.querySelectorAll('.filename-text').forEach(s => s.classList.remove('clicked'));
    // Agregar clase clicked al span actual
    span.classList.add('clicked');

    const cell = span.closest('.editable-filename');
    const fileId = cell?.dataset?.id;
    const currentName = span.textContent.trim();

    openRenameFileModal(fileId, currentName, span);
  });

  function openRenameFileModal(fileId, currentName, spanElement) {
    const modal = document.getElementById('renameFileModal');
    const nameInput = document.getElementById('renameFileName');
    
    // Llenar el modal con el nombre actual
    nameInput.value = currentName;
    
    // Mostrar el modal usando la función correcta
    showModal('#renameFileModal');
    
    // Enfocar el input
    nameInput.focus();
  }

  // Event listeners para el modal de editar archivo
  ['closeEditModalBtn', 'cancelEditBtn'].forEach(id => {
    const element = qs(`#${id}`);
    if (element) {
      element.addEventListener('click', () => {
        hideModal('#editFileModal');
      });
    }
  });

  // Event listener para confirmar edición
  const confirmEditBtn = qs('#confirmEditBtn');
  if (confirmEditBtn) {
    confirmEditBtn.addEventListener('click', async () => {
      const nameInput = document.getElementById('editFileName');
      const visibleSelect = document.getElementById('editFileVisible');
      
      const name = nameInput.value.trim();
      const visible = visibleSelect.value;
      
      if (!name) {
        showNotification('El nombre no puede estar vacío', 'error');
        return;
      }
      
      // Obtener el fileId del botón que abrió el modal
      const editBtn = document.querySelector('.edit-btn.clicked');
      const fileId = editBtn?.dataset?.fileId;
      
      if (!fileId) {
        showNotification('Error: No se pudo identificar el archivo', 'error');
        return;
      }

      // Mostrar confirmación
      const confirmed = await confirmAction(
        '¿Guardar cambios?',
        'Se actualizará el nombre y visibilidad del archivo.',
        'question'
      );

      if (confirmed) {
        // Mostrar loading
        showGlobalSpinner();
        
        try {
          const res = await fetch(`${apiBase}/api/files/rename/${fileId}/`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
              name: name,
              visible: visible === '1'
            })
          });

          const data = await res.json();

          if (res.ok) {
            showNotification('Archivo actualizado correctamente', 'success');
            hideModal('#editFileModal');
            await refreshFiles();
          } else {
            showNotification(data.message || 'Error al actualizar archivo', 'error');
          }
        } catch (err) {
          showNotification('Error de red al actualizar archivo', 'error');
        } finally {
          hideGlobalSpinner();
        }
      }
    });
  }

  // Event listeners para el modal de renombrar archivo
  ['closeRenameModalBtn', 'cancelRenameBtn'].forEach(id => {
    const element = qs(`#${id}`);
    if (element) {
      element.addEventListener('click', () => {
        hideModal('#renameFileModal');
      });
    }
  });

  // Event listener para confirmar renombrar
  const confirmRenameBtn = qs('#confirmRenameBtn');
  if (confirmRenameBtn) {
    confirmRenameBtn.addEventListener('click', async () => {
      const nameInput = document.getElementById('renameFileName');
      
      const newName = nameInput.value.trim();
      
      if (!newName) {
        showNotification('El nombre no puede estar vacío', 'error');
        return;
      }
      
      // Obtener el fileId y span del botón que abrió el modal
      const spanElement = document.querySelector('.filename-text.clicked');
      const cell = spanElement?.closest('.editable-filename');
      const fileId = cell?.dataset?.id;
      
      if (!fileId || !spanElement) {
        showNotification('Error: No se pudo identificar el archivo', 'error');
        return;
      }
      
      if (newName === spanElement.textContent.trim()) {
        hideModal('#renameFileModal');
        return;
      }

      // Mostrar confirmación
      const confirmed = await confirmAction(
        '¿Cambiar nombre?',
        'Se actualizará el nombre del archivo.',
        'question'
      );

      if (confirmed) {
        // Mostrar loading
        showGlobalSpinner();
        
        try {
          const res = await fetch(`${apiBase}/api/files/rename/${fileId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ name: newName })
          });

          const data = await res.json();

          if (res.ok) {
            spanElement.textContent = newName;
            showNotification('Nombre actualizado correctamente', 'success');
            renderTable();
            hideModal('#renameFileModal');
          } else {
            showNotification(data.message || 'Error al cambiar el nombre', 'error');
          }
        } catch (err) {
          showNotification('Error al renombrar archivo', 'error');
        } finally {
          hideGlobalSpinner();
        }
      }
    });
  }


  // Event listener para el botón de crear archivos por defecto
  createDefaultFilesBtn?.addEventListener('click', async () => {
    const confirmed = await confirmAction(
      '¿Crear archivos por defecto?',
      'Se crearán 4 archivos por defecto: Recepción de orden, Aviso de Embarque, Aviso de Recepción de orden y Aviso de Disponibilidad de Orden.',
      'info'
    );

    if (confirmed) {
      // Mostrar loading en el botón
      const originalContent = createDefaultFilesBtn.innerHTML;
      createDefaultFilesBtn.innerHTML = `
        <svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
        </svg>
        <span>Creando...</span>
      `;
      createDefaultFilesBtn.disabled = true;

      try {
        const res = await fetch(`${apiBase}/api/files/create-default/${folderId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          }
        });

        const data = await res.json();

        if (res.ok) {
          showNotification(`Archivos por defecto creados exitosamente: ${data.filesCreated} archivos`, 'success');
          await refreshFiles();
        } else {
          showNotification(data.message || 'Error al crear archivos por defecto', 'error');
        }
      } catch (err) {
        showNotification('Error de red al crear archivos por defecto', 'error');
      } finally {
        // Restaurar botón
        createDefaultFilesBtn.innerHTML = originalContent;
        createDefaultFilesBtn.disabled = false;
      }
    }
  });

  // Event listener para el botón de subir archivo
  uploadFileBtn?.addEventListener('click', () => {
    if (addIcon) addIcon.classList.add('hidden');
    if (spinnerIcon) spinnerIcon.classList.remove('hidden');

    setTimeout(() => {
      const titleElement = qs('#titleFile');
      const clientName = titleElement?.textContent?.replace('Documentos ', '').trim() || '';
      const orderNumber = pc;

      if (spinnerIcon) spinnerIcon.classList.add('hidden');
      if (addIcon) addIcon.classList.remove('hidden');

      if (uploadModal) {
        uploadModal.dataset.clientName = clientName;
        uploadModal.dataset.orderNumber = orderNumber;
        uploadModal.dataset.folderName = pc;
        uploadModal.dataset.folderId = folderId;
      }

      const uploadFileName = qs('#uploadFileName');
      const uploadFileType = qs('#uploadFileType');
      const uploadFileInput = qs('#uploadFileInput');

      if (uploadFileName) uploadFileName.value = '';
      if (uploadFileType) uploadFileType.value = 'PDF';
      if (uploadFileInput) uploadFileInput.value = '';
      
      showUploadModal();
    }, 500);
  });

  // Event listeners para cerrar el modal
  ['cancelUploadBtn', 'closeModalBtn'].forEach(id => {
    const element = qs(`#${id}`);
    if (element) {
      element.addEventListener('click', () => {
        hideUploadModal();

        if (spinnerIcon) spinnerIcon.classList.add('hidden');
        if (addIcon) addIcon.classList.remove('hidden');

        const uploadFileName = qs('#uploadFileName');
        const uploadFileType = qs('#uploadFileType');
        const uploadFileInput = qs('#uploadFileInput');
        const dropZoneText = qs('#dropZoneText');

        if (uploadFileName) uploadFileName.value = '';
        if (uploadFileType) uploadFileType.value = 'PDF';
        if (uploadFileInput) uploadFileInput.value = '';
        if (dropZoneText) dropZoneText.textContent = 'Arrastra el archivo aquí o haz click para seleccionar';
      });
    }
  });

  // Event listener para confirmar la subida
  const confirmUploadBtn = qs('#confirmUploadBtn');
  if (confirmUploadBtn) {
    confirmUploadBtn.addEventListener('click', async () => {
      const fileName = qs('#uploadFileName')?.value?.trim();
      const fileType = qs('#uploadFileType')?.value;
      const pcName = qs('#uploadModal')?.dataset?.folderName;
      const idFolder = qs('#uploadModal')?.dataset?.folderId;
      const isVisibleToCustomer = qs('#isVisibleToClient')?.value;
      const fileObject = qs('#uploadFileInput')?.files?.[0];

      if (!fileName || !fileType || !fileObject) {
        showNotification('Debe completar todos los campos y seleccionar un archivo', 'error');
        return;
      }

      showGlobalSpinner();
      
      try {
        const response = await fetch(`${apiBase}/api/customers/uuid/${uuid}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          }
        });

        if (!response.ok) throw new Error(`Error al obtener cliente: ${response.status}`);

        const { name: clientName } = await response.json();

        const formData = new FormData();
        formData.append('customer_id', uuid);
        formData.append('folder_id', idFolder);
        formData.append('client_name', clientName);
        formData.append('subfolder', pcName);
        formData.append('name', fileName);
        formData.append('file', fileObject);
        formData.append('is_visible_to_customer', isVisibleToCustomer);

        const res = await fetch(`${apiBase}/api/files/upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData
        });

        if (!res.ok) {
          throw new Error('Error al subir archivo');
        }

        showNotification('Archivo subido correctamente', 'success');

        hideUploadModal();

        const uploadFileName = qs('#uploadFileName');
        const uploadFileType = qs('#uploadFileType');
        const uploadFileInput = qs('#uploadFileInput');
        const dropZoneText = qs('#dropZoneText');

        if (uploadFileName) uploadFileName.value = '';
        if (uploadFileType) uploadFileType.value = 'PDF';
        if (uploadFileInput) uploadFileInput.value = '';
        if (dropZoneText) dropZoneText.textContent = 'Arrastra el archivo aquí o haz click para seleccionar';

        await refreshFiles();
      } catch (err) {
        showNotification(err.message || 'Error al subir archivo', 'error');
      } finally {
        hideGlobalSpinner();
      }
    });
  }

  // Event listeners para drag & drop
  const dropZone = qs('#dropZone');
  const fileInput = qs('#uploadFileInput');
  const dropZoneText = qs('#dropZoneText');

  fileInput?.addEventListener('change', () => {
    if (dropZoneText) {
      dropZoneText.textContent = fileInput.files.length > 0
        ? fileInput.files[0].name
        : 'Arrastra el archivo aquí o haz click para seleccionar';
    }
  });

  dropZone?.addEventListener('click', () => fileInput?.click());

  // Configurar drag & drop
  if (dropZone && fileInput) {
    setupDragAndDrop(dropZone, (files) => {
      if (files.length > 0) {
        // Crear un DataTransfer para asignar archivos al input
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(files[0]);
        fileInput.files = dataTransfer.files;
        
        if (dropZoneText) {
          dropZoneText.textContent = files[0].name;
        }
      }
    });
  }

  // Inicializar - Los event listeners se manejan con event delegation
  
  // Cargar archivos al inicializar la página
  refreshFiles();

  /* ---------- visibilidad (checkbox) ---------- */
  // Event listener para checkbox de visibilidad (como en clients.js)
  function attachVisibilityEvents() {
    document.querySelectorAll('.visibility-toggle').forEach(checkbox => {
      checkbox.addEventListener('change', async (e) => {
        const fileId = e.target.dataset.fileId;
        const newVisible = e.target.checked ? 1 : 0;

        // Mantén el nombre actual para el endpoint de actualización
        const row = e.target.closest('tr');
        const currentName = row?.querySelector('.filename-text')?.textContent?.trim() || '';

        try {
          const res = await fetch(`${apiBase}/api/files/rename/${fileId}/`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
              name: currentName,
              visible: newVisible === 1
            })
          });

          if (!res.ok) throw new Error();

          showNotification('Visibilidad actualizada correctamente', 'success');
        } catch (err) {
          // Revierte el estado si hay error
          e.target.checked = !e.target.checked;
          showNotification('Error al actualizar visibilidad', 'error');
        }
      });
    });
  }

  // Configurar sombra en scroll usando función global
  const head = qs('filesHead');
  if (head) {
    setupScrollShadow(window, head);
  }

  // Configurar cierre de modales
  setupModalClose('#messageModal', '#closeMessageModalBtn');
  setupModalClose('#editFileModal', '#closeEditModalBtn');
  setupModalClose('#renameFileModal', '#closeRenameModalBtn');
  setupModalClose('#uploadModal', '#closeUploadModalBtn');

  // Event listeners para el modal de mensaje
  const confirmMessageBtn = qs('#confirmMessageBtn');
  const cancelMessageBtn = qs('#cancelMessageBtn');

  if (confirmMessageBtn) {
    confirmMessageBtn.addEventListener('click', async () => {
      const orderInput = qs('#orderNumber');
      const messageInput = qs('#customMessage');
      
      if (!window.currentMessageData) {
        showNotification('Error: No hay datos de mensaje', 'error');
        return;
      }

      // Cerrar modal primero
      hideModal('#messageModal');

      // Mostrar confirmación
      const confirmed = await confirmAction(
        '¿Enviar documento?',
        'El documento se enviará por correo al cliente.',
        'question'
      );

      if (confirmed) {
        // Mostrar loading global
        showGlobalSpinner();
        
        try {
          await sendDocument(
            window.currentMessageData.fileId, 
            orderInput?.value?.trim() || '', 
            messageInput?.value?.trim() || '', 
            window.currentMessageData.action
          );
        } finally {
          hideGlobalSpinner();
          window.currentMessageData = null;
        }
      } else {
        window.currentMessageData = null;
      }
    });
  }

  if (cancelMessageBtn) {
    cancelMessageBtn.addEventListener('click', () => {
      hideModal('#messageModal');
      window.currentMessageData = null;
    });
  }

  // ===== SISTEMA DE ORDENAMIENTO =====
  
  let currentSort = { column: null, direction: 'asc' };

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
   * Función para ordenar las filas
   */
  function sortRows(column, direction) {
    if (!column) return;
    
    filteredFiles.sort((a, b) => {
      let aVal = a[column];
      let bVal = b[column];
      
      // Manejar valores nulos/undefined
      if (aVal == null) aVal = '';
      if (bVal == null) bVal = '';
      
      // Convertir a string para comparación
      aVal = String(aVal).toLowerCase();
      bVal = String(bVal).toLowerCase();
      
      if (direction === 'asc') {
        return aVal.localeCompare(bVal);
      } else {
        return bVal.localeCompare(aVal);
      }
    });
  }
}