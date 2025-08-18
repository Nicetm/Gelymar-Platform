import { 
  qs, 
  showNotification, 
  confirmAction, 
  showSuccess, 
  showError,
  showModal,
  hideModal,
  setupModalClose,
  showSpinner,
  hideSpinner,
  setupDragAndDrop,
  setupScrollShadow,
  formatDate
} from './utils.js';

export function initFilesScript() {
  const section = qs('filesSection');
  const tableBody = qs('filesTableBody');
  const searchInput = qs('searchInput');
  const itemsPerPageSelect = qs('itemsPerPageSelect');
  const prevPageBtn = qs('prevPageBtn');
  const nextPageBtn = qs('nextPageBtn');
  const pageIndicator = qs('pageIndicator');
  const uploadFileBtn = qs('uploadFileBtn');
  const addIcon = qs('addIcon');
  const spinnerIcon = qs('spinnerIcon');
  const uploadModal = qs('uploadModal');
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
  const apiBase = window.apiBase || section?.dataset.apiBase;
  const fileServer = section?.dataset.fileServer;
  const lang = window.lang || section?.dataset.lang;

  let currentPage = 1;
  let itemsPerPage = parseInt(itemsPerPageSelect?.value || '10', 10);
  const allRows = Array.from(tableBody?.querySelectorAll('tr') || []);
  let filteredRows = [...allRows];

  const params = new URLSearchParams(window.location.search);
  const folderId = params.get('f');
  const pc = params.get('pc');

  const token = localStorage.getItem('token');

  // Validaciones iniciales
  if (!uuid || !folderId) {
    console.error('Faltan parámetros');
    return;
  }

  if (!token) {
    window.location.href = '/login';
    return;
  }

  function renderTable() {
    const start = (currentPage - 1) * itemsPerPage;
    const pageData = filteredRows.slice(start, start + itemsPerPage);

    allRows.forEach(row => row.style.display = 'none');
    pageData.forEach(row => row.style.display = '');

    const totalPages = Math.ceil(filteredRows.length / itemsPerPage);
    if (pageIndicator) {
      pageIndicator.textContent = `Page ${currentPage} of ${totalPages}`;
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
    filteredRows = allRows.filter(row => row.textContent.toLowerCase().includes(query));
    currentPage = 1;
    renderTable();
  });

  function showGlobalSpinner() {
    const spinner = qs('globalSpinner');
    if (spinner) {
      spinner.classList.remove('invisible');
      spinner.classList.add('visible');
    }
  }

  function hideGlobalSpinner() {
    const spinner = qs('globalSpinner');
    if (spinner) {
      spinner.classList.remove('visible');
      spinner.classList.add('invisible');
    }
  }

  async function refreshFiles() {
    try {
      console.log('DEBUG - refreshFiles - apiBase:', apiBase);
      console.log('DEBUG - refreshFiles - uuid:', uuid);
      console.log('DEBUG - refreshFiles - folderId:', folderId);
      
      const res = await fetch(`${apiBase}/api/files/${uuid}?f=${folderId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        console.error('DEBUG - refreshFiles - Error response:', res.status, res.statusText);
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const files = await res.json();
      console.log('DEBUG - refreshFiles - Files received:', files);

    if (tableBody) {
      tableBody.innerHTML = files.map(file => {
        const statusColors = {
          1: 'bg-red-500',
          2: 'bg-yellow-400',
          3: 'bg-green-500',
          4: 'bg-blue-500'
        };

        let actions = `<div class="flex items-center gap-3 justify-center">`;

        if (file.status_id === 1) {
          actions += `
            <a href="#" class="generate-btn" data-file-id="${file.id}" title="Generar documento">
              <svg class="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 15.5A3.5 3.5 0 1 0 12 8.5a3.5 3.5 0 0 0 0 7zm7.5-.5a7.49 7.49 0 0 1-1.035 3.743l1.432 1.432a1 1 0 1 1-1.414 1.414l-1.432-1.432A7.49 7.49 0 0 1 12.5 20.5v2a1 1 0 1 1-2 0v-2a7.49 7.49 0 0 1-3.743-1.035l-1.432 1.432a1 1 0 1 1-1.414-1.414l1.432-1.432A7.49 7.49 0 0 1 3.5 15.5h-2a1 1 0 1 1 0-2h2a7.49 7.49 0 0 1 1.035-3.743L3.103 8.325a1 1 0 1 1 1.414-1.414l1.432 1.432A7.49 7.49 0 0 1 11.5 3.5v-2a1 1 0 1 1 2 0v2a7.49 7.49 0 0 1 3.743 1.035l1.432-1.432a1 1 0 1 1 1.414 1.414l-1.432 1.432A7.49 7.49 0 0 1 20.5 11.5h2a1 1 0 1 1 0 2h-2z" />
              </svg>
            </a>`;
        }

        if (file.status_id === 2) {
          actions += `
            <a href="#" class="send-btn" data-file-id="${file.id}" data-file-name="${file.name}" data-order="${pc}" title="Enviar documento">
              <svg class="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </a>`;
        }

        if ([3, 4].includes(file.status_id)) {
          actions += `
            <a href="#" class="resend-btn" data-file-id="${file.id}" data-file-name="${file.name}" data-order="${pc}" title="Reenviar documento">
              <svg class="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H7a4 4 0 010-8h1" />
              </svg>
            </a>`;
        }

        if ([2, 3, 4].includes(file.status_id)) {
          actions += `
            <a href="${fileServer}/${file.path}" target="_blank" class="hover:text-blue-500 transition" title="Ver documento">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
            </a>`;
        }

        actions += `
          <a href="#" class="edit-btn hover:text-blue-500 transition" data-file-id="${file.id}" title="Editar documento">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </a>
          <a href="#" class="delete-btn hover:text-red-500 transition" data-file-id="${file.id}" title="Eliminar documento">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 7h12M10 11v6M14 11v6M5 7l1 12a2 2 0 002 2h8a2 2 0 002-2l1-12M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
            </svg>
          </a>
        </div>`;

        return `
          <tr data-id="${file.id}" class="transition-colors duration-150 hover:bg-gray-100 dark:hover:bg-gray-800 hover:shadow-[0_1px_3px_rgba(0,0,0,0.12)]">
            <td class="px-6 py-4 text-sm editable-filename group cursor-pointer" data-id="${file.id}" title="Doble clic para editar">
              <div class="inline-flex items-center gap-1">
                <span class="filename-text block truncate">${file.name}</span>
                <svg class="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5 M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </div>
            </td>
            <td class="px-4 py-3">
              <div class="flex items-center">
                <span class="w-2.5 h-2.5 rounded-full mr-2 ${statusColors[file.status_id] || 'bg-gray-400'}"></span>
                ${file.status_name || '-'}
              </div>
            </td>
            <td class="px-6 py-4 items-center gap-3">${new Date(file.created_at).toLocaleString("es-CL")}</td>
            <td class="px-6 py-4 items-center gap-3">${new Date(file.updated_at).toLocaleString("es-CL")}</td>
            <td data-v="${file.is_visible_to_client}" class="px-6 py-4 text-center">
              <label class="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  class="sr-only peer visibility-toggle"
                  data-file-id="${file.id}"
                  ${file.is_visible_to_client ? 'checked' : ''} />
                <div
    } catch (error) {
      console.error('DEBUG - refreshFiles - Error:', error);
      showNotification('Error al cargar archivos', 'error');
    }
                  class="w-9 h-5 bg-gray-200 rounded-full transition-colors
                    peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-500
                    peer-checked:bg-primary-600 dark:bg-gray-700 dark:peer-checked:bg-primary-500"></div>
                <div
                  class="absolute left-1 top-1 w-3 h-3 bg-white rounded-full transition-transform
                    peer-checked:translate-x-4"></div>
              </label>
            </td>
            <td class="px-6 py-4 items-center gap-3">${actions}</td>
          </tr>`;
      }).join('');

      allRows.length = 0;
      allRows.push(...Array.from(tableBody.querySelectorAll('tr')));
      filteredRows = [...allRows];
      currentPage = 1;
      renderTable();
    }
  } catch (error) {
    console.error('DEBUG - refreshFiles - Error:', error);
    showNotification('Error al cargar archivos', 'error');
  }
  }

  async function sendDocument(fileId, orderNumber, customMessage, action) {
    const confirmed = await confirmAction(
      '¿Enviar documento?',
      'El documento se enviará por correo al cliente.',
      'question'
    );

    if (confirmed) {
      try {
        const res = await fetch(`${apiBase}/api/files/${action}/${fileId}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ orderNumber, customMessage })
        });

        if (!res.ok) throw new Error();

        const message = action === 'send' ? 'Documento enviado correctamente' : 'Documento reenviado correctamente';
        showNotification(message, 'success');
        await refreshFiles();
        attachGenerateEvents();
        attachSendResendEvents();
      } catch (err) {
        console.error(err);
        showNotification('Error al enviar el documento', 'error');
      }
    }
  }

  function openMessageModal(fileId, fileName, order, action) {
    const modal = qs('messageModal');
    const orderInput = qs('orderNumber');
    const docInput = qs('orderDocument');
    const messageInput = qs('customMessage');
    const confirmBtn = qs('confirmMessageBtn');
    const cancelBtn = qs('cancelMessageBtn');

    if (orderInput) orderInput.value = order;
    if (docInput) docInput.value = fileName;
    if (messageInput) messageInput.value = '';
    
    showModal('#messageModal');

    if (confirmBtn) {
      confirmBtn.onclick = async () => {
        hideModal('#messageModal');
        showGlobalSpinner();

        try {
          await sendDocument(fileId, orderInput?.value?.trim() || '', messageInput?.value?.trim() || '', action);
        } finally {
          hideGlobalSpinner();
        }
      };
    }

    if (cancelBtn) {
      cancelBtn.onclick = () => {
        hideModal('#messageModal');
      };
    }
  }

  function attachGenerateEvents() {
    document.querySelectorAll('.generate-btn').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.preventDefault();
        const { fileId } = btn.dataset;

        const confirmed = await confirmAction(
          '¿Generar documento?',
          'Esto generará un nuevo documento PDF.',
          'info'
        );

        if (confirmed) {
          showGlobalSpinner();
          try {
            const res = await fetch(`${apiBase}/api/files/generate/${fileId}`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}` }
            });

            if (!res.ok) throw new Error('Error al generar archivo');
            showNotification('Documento generado correctamente', 'success');
          } catch (err) {
            showNotification('Error al generar documento', 'error');
          } finally {
            hideGlobalSpinner();
            await refreshFiles();
            attachGenerateEvents();
            attachSendResendEvents();
          }
        }
      });
    });
  }

  function attachSendResendEvents() {
    tableBody?.addEventListener('click', e => {
      const btn = e.target.closest('.send-btn, .resend-btn');
      if (!btn) return;
      e.preventDefault();

      const { fileId, fileName, order } = btn.dataset;
      const action = btn.classList.contains('send-btn') ? 'send' : 'resend';
      openMessageModal(fileId, fileName, order, action);
    });
  }



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
    
    // Mostrar el modal
    modal.classList.remove('hidden');
    
    // Enfocar el input
    nameInput.focus();
  }

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
    
    // Mostrar el modal
    modal.classList.remove('hidden');
    
    // Enfocar el input
    nameInput.focus();
  }

  // Event listeners para el modal de editar archivo
  ['closeEditModalBtn', 'cancelEditBtn'].forEach(id => {
    const element = qs(id);
    if (element) {
      element.addEventListener('click', () => {
        const modal = document.getElementById('editFileModal');
        modal.classList.add('hidden');
      });
    }
  });

  // Event listener para confirmar edición
  const confirmEditBtn = qs('confirmEditBtn');
  if (confirmEditBtn) {
    confirmEditBtn.addEventListener('click', async () => {
      const nameInput = document.getElementById('editFileName');
      const visibleSelect = document.getElementById('editFileVisible');
      const modal = document.getElementById('editFileModal');
      
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
          modal.classList.add('hidden');
          await refreshFiles();
          attachGenerateEvents();
          attachSendResendEvents();
        } else {
          showNotification(data.message || 'Error al actualizar archivo', 'error');
        }
      } catch (err) {
        showNotification('Error de red al actualizar archivo', 'error');
      }
    });
  }

  // Event listeners para el modal de renombrar archivo
  ['closeRenameModalBtn', 'cancelRenameBtn'].forEach(id => {
    const element = qs(id);
    if (element) {
      element.addEventListener('click', () => {
        const modal = document.getElementById('renameFileModal');
        modal.classList.add('hidden');
      });
    }
  });

  // Event listener para confirmar renombrar
  const confirmRenameBtn = qs('confirmRenameBtn');
  if (confirmRenameBtn) {
    confirmRenameBtn.addEventListener('click', async () => {
      const nameInput = document.getElementById('renameFileName');
      const modal = document.getElementById('renameFileModal');
      
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
        modal.classList.add('hidden');
        return;
      }
      
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
          modal.classList.add('hidden');
        } else {
          showNotification(data.message || 'Error al cambiar el nombre', 'error');
        }
      } catch (err) {
        showNotification('Error al renombrar archivo', 'error');
      }
    });
  }


  // Event listener para el botón de subir archivo
  uploadFileBtn?.addEventListener('click', () => {
    if (addIcon) addIcon.classList.add('hidden');
    if (spinnerIcon) spinnerIcon.classList.remove('hidden');

    setTimeout(() => {
      const titleElement = qs('titleFile');
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

      const uploadFileName = qs('uploadFileName');
      const uploadFileType = qs('uploadFileType');
      const uploadFileInput = qs('uploadFileInput');

      if (uploadFileName) uploadFileName.value = '';
      if (uploadFileType) uploadFileType.value = 'PDF';
      if (uploadFileInput) uploadFileInput.value = '';
      
      showUploadModal();
    }, 500);
  });

  // Event listeners para cerrar el modal
  ['cancelUploadBtn', 'closeModalBtn'].forEach(id => {
    const element = qs(id);
    if (element) {
      element.addEventListener('click', () => {
        hideUploadModal();

        if (spinnerIcon) spinnerIcon.classList.add('hidden');
        if (addIcon) addIcon.classList.remove('hidden');

        const uploadFileName = qs('uploadFileName');
        const uploadFileType = qs('uploadFileType');
        const uploadFileInput = qs('uploadFileInput');
        const dropZoneText = qs('dropZoneText');

        if (uploadFileName) uploadFileName.value = '';
        if (uploadFileType) uploadFileType.value = 'PDF';
        if (uploadFileInput) uploadFileInput.value = '';
        if (dropZoneText) dropZoneText.textContent = 'Arrastra el archivo aquí o haz click para seleccionar';
      });
    }
  });

  // Event listener para confirmar la subida
  const confirmUploadBtn = qs('confirmUploadBtn');
  if (confirmUploadBtn) {
    confirmUploadBtn.addEventListener('click', async () => {
      const fileName = qs('uploadFileName')?.value?.trim();
      const fileType = qs('uploadFileType')?.value;
      const pcName = qs('uploadModal')?.dataset?.folderName;
      const idFolder = qs('uploadModal')?.dataset?.folderId;
      const isVisibleToCustomer = qs('isVisibleToClient')?.value;
      const fileObject = qs('uploadFileInput')?.files?.[0];

      console.log('DEBUG - Valores del modal:', {
        fileName, fileType, pcName, idFolder, isVisibleToCustomer,
        fileObject: fileObject ? { name: fileObject.name, size: fileObject.size } : null
      });

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

        console.log('DEBUG - FormData creado:', {
          customer_id: uuid,
          folder_id: idFolder,
          client_name: clientName,
          subfolder: pcName,
          name: fileName,
          is_visible_to_customer: isVisibleToCustomer
        });

        const res = await fetch(`${apiBase}/api/files/upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData
        });

        if (!res.ok) throw new Error('Error al subir archivo');

        showNotification('Archivo subido correctamente', 'success');

        hideUploadModal();

        const uploadFileName = qs('uploadFileName');
        const uploadFileType = qs('uploadFileType');
        const uploadFileInput = qs('uploadFileInput');
        const dropZoneText = qs('dropZoneText');

        if (uploadFileName) uploadFileName.value = '';
        if (uploadFileType) uploadFileType.value = 'PDF';
        if (uploadFileInput) uploadFileInput.value = '';
        if (dropZoneText) dropZoneText.textContent = 'Arrastra el archivo aquí o haz click para seleccionar';

        await refreshFiles();
        attachGenerateEvents();
        attachSendResendEvents();
      } catch (err) {
        showNotification(err.message || 'Error al subir archivo', 'error');
      } finally {
        hideGlobalSpinner();
      }
    });
  }

  // Event listeners para drag & drop
  const dropZone = qs('dropZone');
  const fileInput = qs('uploadFileInput');
  const dropZoneText = qs('dropZoneText');

  fileInput?.addEventListener('change', () => {
    if (dropZoneText) {
      dropZoneText.textContent = fileInput.files.length > 0
        ? fileInput.files[0].name
        : 'Arrastra el archivo aquí o haz click para seleccionar';
    }
  });

  dropZone?.addEventListener('click', () => fileInput?.click());

  // Configurar drag & drop usando función global
  if (dropZone && fileInput) {
    setupDragAndDrop(dropZone, (files) => {
      if (files.length > 0) {
        fileInput.files = files;
        if (dropZoneText) {
          dropZoneText.textContent = files[0].name;
        }
      }
    });
  }

  // Inicializar
  renderTable();
  attachGenerateEvents();
  attachSendResendEvents();

  /* ---------- visibilidad (checkbox) ---------- */
  tableBody?.addEventListener('change', async (e) => {
    const checkbox = e.target.closest('.visibility-toggle');
    if (!checkbox) return;

    const fileId = checkbox.dataset.fileId;
    const newVisible = checkbox.checked ? 1 : 0;

    // Mantén el nombre actual para el endpoint de actualización
    const row = checkbox.closest('tr');
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

      // Actualiza el atributo data-v para reflejar el nuevo estado
      row?.querySelector('[data-v]')?.setAttribute('data-v', String(newVisible));
      showNotification('Visibilidad actualizada correctamente', 'success');
    } catch (err) {
      // Revierte el estado si hay error
      checkbox.checked = !checkbox.checked;
      showNotification('Error al actualizar visibilidad', 'error');
    }
  });

  // Configurar sombra en scroll usando función global
  const head = qs('filesHead');
  if (head) {
    setupScrollShadow(window, head);
  }
}