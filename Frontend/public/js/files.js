// Importar funciones de utilidad
import { showNotification } from './utils.js';

async function buildErrorFromResponse(response, fallbackMessage = '') {
  let payload = null;
  try {
    payload = await response.json();
  } catch (err) {
    // ignore parse errors
  }
  const message = payload?.message || fallbackMessage || `HTTP ${response.status}: ${response.statusText}`;
  const error = new Error(message);
  if (payload?.code) {
    error.code = payload.code;
  }
  error.status = response.status;
  error.payload = payload;
  return error;
}

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

const normalizeEmailValue = (email) =>
  typeof email === 'string' ? email.trim() : '';

const toBooleanValue = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes';
  }
  return false;
};

function getRecipientMetadataList() {
  return Array.isArray(window.emailRecipientMetadata)
    ? window.emailRecipientMetadata.map((contact) => ({
        ...contact,
        email: normalizeEmailValue(contact?.email),
        sh_documents: toBooleanValue(contact?.sh_documents),
        reports: toBooleanValue(contact?.reports),
        cco: toBooleanValue(contact?.cco),
      })).filter((contact) => contact.email)
    : [];
}

function getCcoEmailsFromMetadata() {
  return getRecipientMetadataList()
    .filter((contact) => contact.cco === true)
    .map((contact) => contact.email)
    .filter(Boolean);
}

function buildRecipientMetadataMap() {
  const map = new Map();
  const list = getRecipientMetadataList();

  list.forEach((contact) => {
    map.set(contact.email.toLowerCase(), contact);
  });

  return map;
}

function getRecipientMetadata(email) {
  const normalized = normalizeEmailValue(email);
  if (!normalized) return null;
  const map = buildRecipientMetadataMap();
  return map.get(normalized.toLowerCase()) || null;
}

let globalValidationMode = '0';

function setGlobalValidationMode(mode) {
  globalValidationMode = String(mode) === '0' ? '0' : '1';
}

function getGlobalValidationMode() {
  return globalValidationMode;
}

function getRestrictionLabel(mode) {
  const normalizedMode = String(mode) === '0' ? '0' : '1';
  return normalizedMode === '0' ? 'SH Docs' : 'Reports';
}

function canSendToEmail(email, mode = getGlobalValidationMode()) {
  const normalizedMode = String(mode) === '0' ? '0' : '1';
  const metadata = getRecipientMetadata(email);
  if (!metadata) return true;
  if (metadata.cco) return true;

  const shEnabled = metadata.sh_documents === true;
  const reportsEnabled = metadata.reports === true;

  if (!shEnabled && !reportsEnabled) {
    return false;
  }

  if (normalizedMode === '0') {
    return shEnabled;
  }

  return reportsEnabled;
}

function getFilesContext() {
  const section = document.getElementById('filesSection');
  const dataset = section?.dataset || {};
  const basePath = dataset.basePath || '/admin';
  const clientsPath = dataset.clientsPath || `${basePath}/clients`;
  const foldersPath = dataset.foldersPath || `${clientsPath}/folders/view`;

  return {
    section,
    basePath,
    clientsPath,
    foldersPath,
    apiBase: dataset.apiBase || window.apiBase || '',
    fileServer: dataset.fileServer || window.fileServer || '',
    uuid: dataset.uuid || null,
    folderId: dataset.folderId || null,
    pc: dataset.pc || null,
    factura: dataset.factura || window.orderFactura || null,
  };
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
    const comond = window.translations?.comond || {};
    const cancelLabel = comond.cancel;
    const confirmLabel = comond.confirm;
    const understoodLabel = comond.understood;
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
      warning: 'bg-orange-600 hover:bg-orange-700 focus:ring-orange-500',
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
              ${cancelLabel}
            </button>
            <button id="confirmAccept" class="px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${buttonColors[type] || buttonColors.warning}">
              ${type === 'error' ? understoodLabel : confirmLabel}
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

  const translations = window.translations || {};
  const documentos = translations.documentos || {};
  const comond = translations.comond || {};
  const messages = translations.messages || {};
  const messagesDocs = messages.documentos || messages.files || {};

  const getMessage = (value) => (typeof value === 'string' && value.length > 0 ? value : '');

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

  const {
    apiBase,
    fileServer,
    uuid,
    folderId,
    pc: pcFromDataset,
    factura: facturaFromDataset,
  } = getFilesContext();

  const lang = window.lang;
  const orderOc = window.orderOc;

  let currentPage = 1;
  let itemsPerPage = parseInt(itemsPerPageSelect?.value || '10', 10);
  const hideActions = tableBody?.dataset?.hideActions === '1';
  const colSpan = hideActions ? 7 : 8;
  let allFiles = [];
  let filteredFiles = [];
  let currentSort = { column: null, direction: 'asc' };

  const params = new URLSearchParams(window.location.search);
  const pc = params.get('pc') || pcFromDataset || window.orderPc || '';
  const facturaFromParams = params.get('factura') || null;
  const resolvedFactura = facturaFromParams || facturaFromDataset || window.orderFactura || null;

  // Validaciones iniciales
  if (!uuid) {
    console.error('Falta UUID');
    return;
  }

  // Validar token usando función centralizada
  const token = getValidToken();
  if (!token) {
    return;
  }

  const titleElement = qs('#titleFile');
  const titleSuffix = ` - ${getMessage(documentos.title)}`;
  let resolvedClientName = '';

  const readClientNameFromTitle = () => {
    if (!titleElement) return '';
    const text = (titleElement.textContent || '').trim();
    if (!text) return '';
    if (text.includes(' - ')) {
      const [namePart] = text.split(' - ');
      return (namePart || '').trim();
    }
    return text;
  };

  const syncClientNameToTitle = (name) => {
    if (!name || !titleElement) return;
    resolvedClientName = name.trim();
    titleElement.textContent = `${resolvedClientName}${titleSuffix}`;
  };

  resolvedClientName = readClientNameFromTitle();

  if (!resolvedClientName && uuid) {
    (async () => {
      try {
        const res = await fetch(`${apiBase}/api/customers/rut/${encodeURIComponent(uuid)}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) return;
        const customerInfo = await res.json();
        const name = typeof customerInfo?.name === 'string'
          ? customerInfo.name.trim()
          : typeof customerInfo?.Nombre === 'string'
            ? customerInfo.Nombre.trim()
            : '';
        if (name) {
          syncClientNameToTitle(name);
        }
      } catch (error) {
        console.error('Error obteniendo nombre del cliente:', error);
      }
    })();
  }

  setupEmailRecipientsEditor([]);

  async function loadDocumentTypes() {
    const select = qs('#uploadFileName');
    if (!select) return;

    try {
      const res = await fetch(`${apiBase}/api/document-types`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        throw await buildErrorFromResponse(res);
      }

      const types = await res.json();
      select.innerHTML = '';
      const placeholderOption = document.createElement('option');
      placeholderOption.value = '';
      placeholderOption.disabled = true;
      placeholderOption.selected = true;
      placeholderOption.textContent = `- ${getMessage(documentos.selectDocumentName)} -`;
      select.appendChild(placeholderOption);

      if (Array.isArray(types)) {
        types.forEach((docType) => {
          const option = document.createElement('option');
          option.value = docType.id;
          option.dataset.fileName = docType.name;
          option.textContent = docType.name;
          select.appendChild(option);
        });
      }
    } catch (error) {
      console.error('Error cargando tipos de documentos:', error);
    }
  }

  async function loadRecipients() {
    try {
      let customerEmail = '';
      let contactData = null;

      const customerResponse = await fetch(`${apiBase}/api/customers/rut/${encodeURIComponent(uuid)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (customerResponse.ok) {
        const customerInfo = await customerResponse.json();
        const normalizedEmail = typeof customerInfo?.email === 'string'
          ? customerInfo.email.trim()
          : typeof customerInfo?.primary_email === 'string'
            ? customerInfo.primary_email.trim()
            : '';
        if (normalizedEmail) {
          customerEmail = normalizedEmail;
        }
      }

      const contactsResponse = await fetch(`${apiBase}/api/customers/${uuid}/contacts`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (contactsResponse.ok) {
        contactData = await contactsResponse.json();
      }

      const normalizeEmail = (value) =>
        typeof value === 'string' ? value.trim() : '';

      const toBoolean = (value) => {
        if (typeof value === 'boolean') return value;
        if (typeof value === 'number') return value === 1;
        if (typeof value === 'string') {
          const normalized = value.trim().toLowerCase();
          return normalized === 'true' || normalized === '1' || normalized === 'yes';
        }
        return false;
      };

      const contactEmailMap = new Map();

      const registerContact = (contact) => {
        const rawEmail =
          contact?.email ??
          contact?.primary_email ??
          contact?.contact_email ??
          contact?.correo;
        const email = normalizeEmail(rawEmail);
        if (!email) return;

        const name =
          typeof contact?.name === 'string'
            ? contact.name.trim()
            : typeof contact?.nombre === 'string'
              ? contact.nombre.trim()
              : '';

        const metadata = {
          email,
          name,
          sh_documents: toBoolean(contact?.sh_documents),
          reports: toBoolean(contact?.reports),
          cco: toBoolean(contact?.cco),
        };

        contactEmailMap.set(email.toLowerCase(), metadata);
      };

      if (customerEmail) {
        registerContact({ email: customerEmail, sh_documents: true, reports: true, cco: false });
      }

      if (Array.isArray(contactData?.additional_contacts)) {
        contactData.additional_contacts.forEach(registerContact);
      } else if (typeof contactData?.contact_email === 'string') {
        try {
          const parsed = JSON.parse(contactData.contact_email);
          if (Array.isArray(parsed)) {
            parsed.forEach(registerContact);
          }
        } catch {
          // ignore invalid JSON
        }
      }

      const contactEmailMetadata = Array.from(contactEmailMap.values());
      const emailRecipients = contactEmailMetadata
        .filter((contact) => (contact.sh_documents || contact.reports) && !contact.cco)
        .map((contact) => contact.email);

      window.emailRecipients = emailRecipients;
      window.emailRecipientMetadata = contactEmailMetadata;

      if (window.emailRecipientController?.setBase) {
        window.emailRecipientController.setBase(emailRecipients);
      }
      if (window.emailRecipientController?.addToKnown) {
        window.emailRecipientController.addToKnown(contactEmailMetadata.map((c) => c.email));
      }
    } catch (error) {
      console.error('Error cargando correos de contactos:', error);
    }
  }

  function renderTable() {
    if (!tableBody) return;

    const totalItems = filteredFiles.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage) || 0;

    if (totalPages > 0 && currentPage > totalPages) {
      currentPage = totalPages;
    } else if (totalPages === 0) {
      currentPage = 1;
    }

    const start = (currentPage - 1) * itemsPerPage;
    const pageData = filteredFiles.slice(start, start + itemsPerPage);

    tableBody.innerHTML = '';

    if (pageData.length === 0) {
      tableBody.innerHTML = `
        <tr class="bg-white dark:bg-gray-900">
          <td colspan="${colSpan}" class="px-6 py-8 text-center text-gray-500">
            ${getMessage(documentos.noFilesFound)}
          </td>
        </tr>
      `;
    } else {
      pageData.forEach(file => {
        const rowHtml = renderFileRow(file);
        tableBody.insertAdjacentHTML('beforeend', rowHtml);
      });
    }

    if (pageIndicator) {
      const pageLabel = getMessage(documentos.pageIndicator);
      const ofLabel = getMessage(documentos.pageIndicatorSeparator);
      pageIndicator.textContent = `${pageLabel} ${totalPages === 0 ? 0 : currentPage} ${ofLabel} ${totalPages}`;
    }

    setupFloatingTooltips(tableBody);
    attachVisibilityEvents();
  }

  function filterFiles({ resetPage = true } = {}) {
    const query = (searchInput?.value || '').toLowerCase().trim();

    if (!query) {
      filteredFiles = [...allFiles];
    } else {
      filteredFiles = allFiles.filter(file => {
        const searchableText = [
          file.name,
          file.status_name,
          file.fecha_generacion,
          file.fecha_envio,
          file.fecha_reenvio,
          file.oc,
          file.pc
        ]
          .map(value => (value ?? '').toString().toLowerCase())
          .join(' ');

        return searchableText.includes(query);
      });
    }

    if (resetPage) {
      currentPage = 1;
    }

    if (currentSort.column) {
      sortFiles(currentSort.column, currentSort.direction);
    } else {
      renderTable();
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
    const totalPages = Math.ceil(filteredFiles.length / itemsPerPage) || 0;
    if (totalPages > 0 && currentPage < totalPages) {
      currentPage++;
      renderTable();
    }
  });

  searchInput?.addEventListener('input', () => {
    filterFiles();
  });

  function resolveFileVersionSuffix(file) {
    const sources = [file?.path, file?.name].filter(Boolean).map(String);
    for (const source of sources) {
      const match = source.match(/_v(\d+)\.pdf$/i);
      if (match) {
        return `v_${match[1]}`;
      }
    }
    return '';
  }

  function resolveFileDisplayName(file) {
    const explicit = typeof file?.document_type === 'string' ? file.document_type.trim() : '';
    const versionSuffix = resolveFileVersionSuffix(file);
    if (explicit) return versionSuffix ? `${explicit} ${versionSuffix}` : explicit;
    const full = typeof file?.name === 'string' ? file.name.trim() : '';
    if (!full) return '-';
    const [firstPart] = full.split(' - ');
    const baseName = (firstPart || full).trim();
    return versionSuffix ? `${baseName} ${versionSuffix}` : baseName;
  }

  function escapeHtmlAttribute(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function renderFileRow(file) {
    const statusColors = {
      1: '#FF0000',    // Por Generar --> rojo
      2: '#00FF00',    // Generado --> verde
      3: '#00FFFF',    // Enviado --> celeste
      4: '#0000FF'     // Reenviado --> azul
    };

    const isGeneratedFlag = (file.is_generated === 0 || file.is_generated === '0') ? '0' : '1';

    let actions = '';

    if (!hideActions) {
      actions = `<div class="flex justify-center gap-3 relative">`;

    if (file.status_id === 1) {
      actions += `
        <div class="relative">
          <a href="#"
             class="generate-btn text-gray-900 dark:text-white hover:text-blue-500 transition"
             data-file-id="${file.id}"
             data-tooltip="${getMessage(documentos.generate_document)}"
             aria-label="${getMessage(documentos.generate_document)}">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 15.5A3.5 3.5 0 1 0 12 8.5a3.5 3.5 0 0 0 0 7zm7.5-.5a7.49 7.49 0 0 1-1.035 3.743l1.432 1.432a1 1 0 1 1-1.414 1.414l-1.432-1.432A7.49 7.49 0 0 1 12.5 20.5v2a1 1 0 1 1-2 0v-2a7.49 7.49 0 0 1-3.743-1.035l-1.432 1.432a1 1 0 1 1-1.414-1.414l1.432-1.432A7.49 7.49 0 0 1 3.5 15.5h-2a1 1 0 1 1 0-2h2a7.49 7.49 0 0 1 1.035-3.743L3.103 8.325a1 1 0 1 1 1.414-1.414l1.432 1.432A7.49 7.49 0 0 1 11.5 3.5v-2a1 1 0 1 1 2 0v2a7.49 7.49 0 0 1 3.743 1.035l1.432-1.432a1 1 0 1 1 1.414 1.414l-1.432 1.432A7.49 7.49 0 0 1 20.5 11.5h2a1 1 0 1 1 0 2h-2z" />
            </svg>
          </a>
        </div>`;
    }

    if (file.status_id === 2) {
      actions += `
        <div class="relative">
          <a href="#"
             class="send-btn text-gray-900 dark:text-white hover:text-blue-500 transition"
             data-file-id="${file.id}"
             data-is-generated="${isGeneratedFlag}"
             data-file-name="${file.document_type || file.name}"
             data-order="${file.oc}"
             data-tooltip="${getMessage(documentos.send_document)}"
             aria-label="${getMessage(documentos.send_document)}">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </a>
        </div>`;
    }

    if ([3, 4].includes(file.status_id)) {
      actions += `
        <div class="relative">
          <a href="#"
             class="resend-btn text-gray-900 dark:text-white hover:text-amber-500 transition"
             data-file-id="${file.id}"
             data-is-generated="${isGeneratedFlag}"
             data-file-name="${file.document_type || file.name}"
             data-order="${file.oc}"
             data-tooltip="${getMessage(documentos.resend_document)}"
             aria-label="${getMessage(documentos.resend_document)}">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H7a4 4 0 010-8h1" />
            </svg>
          </a>
        </div>`;
    }

    if (!hideActions && [2, 3, 4].includes(file.status_id)) {
      actions += `
        <div class="relative">
          <a href="#"
             onclick="downloadFile(${file.id}); return false;"
             class="text-gray-900 dark:text-white hover:text-blue-500 transition"
             data-tooltip="${getMessage(documentos.view_document)}"
             aria-label="${getMessage(documentos.view_document)}">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
          </a>
        </div>`;
    }

    if (!hideActions) {
      actions += `
        <div class="relative">
          <a href="#"
             class="edit-btn text-gray-900 dark:text-white hover:text-blue-500 transition"
             data-file-id="${file.id}"
             data-tooltip="${getMessage(documentos.edit_document)}"
             aria-label="${getMessage(documentos.edit_document)}">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </a>
        </div>`;
      actions += `
        <div class="relative">
          <a href="#"
             class="delete-btn text-gray-900 dark:text-white hover:text-red-500 transition"
             data-file-id="${file.id}"
             data-tooltip="${getMessage(documentos.delete_document)}"
             aria-label="${getMessage(documentos.delete_document)}">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 7h12M10 11v6M14 11v6M5 7l1 12a2 2 0 002 2h8a2 2 0 002-2l1-12M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
            </svg>
          </a>
        </div>`;
    }
    
    if (!hideActions) {
      actions += `</div>`;
    }
    }

    const actionsCell = hideActions ? '' : `<td class="sticky right-0 bg-gray-50 dark:bg-gray-700 z-10 px-6 py-4 min-w-[120px] overflow-visible">${actions}</td>`;

    const fullName = typeof file.name === 'string' ? file.name.trim() : '';
    const displayName = resolveFileDisplayName(file);
    const fullNameAttr = escapeHtmlAttribute(fullName);

    return `
      <tr data-id="${file.id}" data-is-generated="${isGeneratedFlag}" class="bg-white dark:bg-gray-900 transition-colors duration-150 hover:bg-gray-100 dark:hover:bg-gray-800 hover:shadow-[0_1px_3px_rgba(0,0,0,0.12)]">
        <td class="px-6 py-4 text-sm editable-filename cursor-pointer" data-id="${file.id}">
          <div class="inline-flex items-center gap-1 relative group">
            <span class="filename-text block truncate" data-full-name="${fullNameAttr}">${displayName}</span>
            <svg class="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5 M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2
                        bg-blue-600 text-white text-xs rounded px-2 py-1 shadow-lg
                        opacity-0 group-hover:opacity-100 transition
                        pointer-events-none whitespace-nowrap z-50">
              ${getMessage(documentos.double_click_to_edit)}
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
        <td class="px-6 py-4 items-center gap-3">${file.fecha_generacion ? new Date(file.fecha_generacion).toLocaleString("es-CL") : '-'}</td>
        <td class="px-6 py-4 items-center gap-3">${file.fecha_envio ? new Date(file.fecha_envio).toLocaleString("es-CL") : '-'}</td>
        <td class="px-6 py-4 items-center gap-3">${file.fecha_reenvio ? new Date(file.fecha_reenvio).toLocaleString("es-CL") : '-'}</td>
        <td data-v="${file.is_visible_to_client}" class="px-6 py-4 text-center">
          <div class="relative group flex items-center justify-center">
            ${file.status_id === 1 ? `
              <div class="inline-flex items-center cursor-not-allowed gap-2 visibility-disabled-wrapper" 
                   data-tooltip="${getMessage(documentos.enable_client_visibility)}"
                   data-status-id="${file.status_id}">
                <input
                  type="checkbox"
                  class="h-4 w-4 rounded border-gray-300 text-blue-600 dark:border-gray-600 dark:bg-gray-700 pointer-events-none opacity-50"
                  ${(file.is_visible_to_client == 1 || file.is_visible_to_client === true) ? 'checked' : ''}
                  disabled />
              </div>
            ` : `
              <label class="inline-flex items-center cursor-pointer gap-2" data-tooltip="${getMessage(documentos.enable_client_visibility)}">
                <input
                  type="checkbox"
                  class="visibility-toggle h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring focus:ring-blue-500 focus:ring-offset-0 dark:border-gray-600 dark:bg-gray-700"
                  data-file-id="${file.id}"
                  data-status-id="${file.status_id}"
                  ${(file.is_visible_to_client == 1 || file.is_visible_to_client === true) ? 'checked' : ''} />
              </label>
            `}
          </div>
        </td>
        ${actionsCell}
      </tr>
    `;
  }

  const floatingTooltipState = {
    el: null,
    currentTarget: null,
    removeTimeout: null,
    globalHandlersBound: false
  };

  function ensureFloatingTooltipElement() {
    if (!floatingTooltipState.el) {
      const tooltip = document.createElement('div');
      tooltip.setAttribute('role', 'tooltip');
      Object.assign(tooltip.style, {
        position: 'fixed',
        zIndex: '10',
        backgroundColor: '#047857',
        color: '#ffffff',
        padding: '6px 10px',
        borderRadius: '6px',
        fontSize: '12px',
        fontWeight: '500',
        lineHeight: '1.4',
        boxShadow: '0 8px 18px rgba(0, 0, 0, 0.25)',
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
        opacity: '0',
        transition: 'opacity 120ms ease',
        maxWidth: '320px',
        textAlign: 'center'
      });
      floatingTooltipState.el = tooltip;
    }
    return floatingTooltipState.el;
  }

  function ensureFloatingTooltipHandlers() {
    if (floatingTooltipState.globalHandlersBound) return;
    floatingTooltipState.globalHandlersBound = true;
    const hideOnChange = () => hideFloatingTooltip();
    window.addEventListener('scroll', hideOnChange, true);
    window.addEventListener('resize', hideOnChange, true);
    window.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        hideFloatingTooltip();
      }
    }, true);
  }

  function positionFloatingTooltip(target, tooltipEl) {
    const rect = target.getBoundingClientRect();
    const tooltipRect = tooltipEl.getBoundingClientRect();
    const spacing = 10;

    let top = rect.top - tooltipRect.height - spacing;
    if (top < spacing) {
      top = rect.bottom + spacing;
    }

    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
    left = Math.min(Math.max(spacing, left), viewportWidth - tooltipRect.width - spacing);

    tooltipEl.style.top = `${Math.round(top)}px`;
    tooltipEl.style.left = `${Math.round(left)}px`;
  }

  function showFloatingTooltip(target) {
    if (!target || !(target instanceof HTMLElement)) return;
    const text = target.getAttribute('data-tooltip');
    if (!text) return;

    ensureFloatingTooltipHandlers();
    clearTimeout(floatingTooltipState.removeTimeout);

    const tooltipEl = ensureFloatingTooltipElement();
    tooltipEl.textContent = text;

    if (!tooltipEl.isConnected) {
      document.body.appendChild(tooltipEl);
    }

    tooltipEl.style.opacity = '0';
    tooltipEl.style.visibility = 'hidden';

    requestAnimationFrame(() => {
      tooltipEl.style.visibility = 'visible';
      positionFloatingTooltip(target, tooltipEl);
      requestAnimationFrame(() => {
        tooltipEl.style.opacity = '1';
      });
    });

    floatingTooltipState.currentTarget = target;
  }

  function hideFloatingTooltip() {
    if (!floatingTooltipState.el) return;
    const tooltipEl = floatingTooltipState.el;
    tooltipEl.style.opacity = '0';
    floatingTooltipState.currentTarget = null;
    clearTimeout(floatingTooltipState.removeTimeout);
    floatingTooltipState.removeTimeout = window.setTimeout(() => {
      if (tooltipEl.parentElement) {
        tooltipEl.parentElement.removeChild(tooltipEl);
      }
      tooltipEl.style.visibility = 'hidden';
    }, 150);
  }

  function handleTooltipEnter(event) {
    showFloatingTooltip(event.currentTarget);
  }

  function handleTooltipLeave(event) {
    const target = event.currentTarget;
    if (floatingTooltipState.currentTarget === target) {
      if (event.type === 'mouseleave' && document.activeElement === target) {
        return;
      }
      hideFloatingTooltip();
    }
  }

  function setupFloatingTooltips(container) {
    if (!container) return;
    const tooltipTargets = container.querySelectorAll('[data-tooltip]');
    tooltipTargets.forEach(target => {
      target.addEventListener('mouseenter', handleTooltipEnter);
      target.addEventListener('mouseleave', handleTooltipLeave);
      target.addEventListener('focus', handleTooltipEnter);
      target.addEventListener('blur', handleTooltipLeave);
    });
  }

  async function refreshFiles() {
    const loadingRow = document.getElementById('loadingRow');
    try {
      const facturaQuery = resolvedFactura ? `&factura=${encodeURIComponent(resolvedFactura)}` : '';
      const pcQuery = pc ? `?pc=${encodeURIComponent(pc)}${facturaQuery}` : (facturaQuery ? `?${facturaQuery.slice(1)}` : '');
      const res = await fetch(`${apiBase}/api/files/${uuid}${pcQuery}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        throw await buildErrorFromResponse(res);
      }

      const files = await res.json();

      allFiles = Array.isArray(files) ? files : [];
      filterFiles({ resetPage: true });

      if (loadingRow) {
        loadingRow.remove();
      }

      // Actualizar estado del botón de crear archivos por defecto
      updateCreateDefaultFilesButtonState(allFiles);
    } catch (error) {
      console.error('DEBUG - refreshFiles - Error:', error);
      if (loadingRow) {
        const errorMessage = getMessage(messagesDocs.loadError);
        const retryLabel = getMessage(documentos.retry);
        loadingRow.innerHTML = `
          <td colspan="${colSpan}" class="px-6 py-8 text-center text-red-500">
            ${errorMessage} <button onclick="location.reload()" class="text-blue-500 hover:underline">${retryLabel}</button>
          </td>
        `;
      } else {
        showNotification(getMessage(documentos.error), 'error');
      }
    }
  }

  function updateCreateDefaultFilesButtonState(files = []) {
    if (!createDefaultFilesBtn) return;
    const names = files.map(f => (f.name || '').toLowerCase());
    const required = [
      'order receipt notice',
      'shipment notice',
      'order delivery notice',
      'availability notice'
    ];
    const hasAll = required.every(r => names.includes(r));
    createDefaultFilesBtn.disabled = hasAll;
  }

  function resolveRecipientState() {
    const editor = document.getElementById('emailRecipientsEditor');
    const controller = window.emailRecipientController;
    let recipients = [];

    if (controller?.getActive) {
      recipients = controller.getActive();
    } else {
      const hiddenInput = editor?.querySelector('#selectedEmailRecipients');
      if (hiddenInput?.value) {
        recipients = hiddenInput.value
          .split(',')
          .map((email) => email.trim())
          .filter(Boolean);
      }
    }

    const noRecipientsMessage =
      controller?.getNoRecipientsMessage?.() ||
      editor?.dataset?.noRecipients ||
      getMessage(documentos.noRecipientsSelected);

    return {
      recipients,
      noRecipientsMessage,
      editor
    };
  }

  function setupEmailRecipientsEditor(initialEmails = []) {
    const editor = document.getElementById('emailRecipientsEditor');
    if (!editor) {
      window.emailRecipientController = {
        getActive: () => Array.isArray(initialEmails) ? [...initialEmails] : [],
        reset: () => {},
        setBase: () => {},
        addToKnown: () => {},
        getNoRecipientsMessage: () => getMessage(documentos.noRecipientsSelected)
      };
      return;
    }

    const dataset = editor.dataset || {};
    const activeContainer = editor.querySelector('#activeEmailChips');
    const availableWrapper = editor.querySelector('#availableEmailsWrapper');
    const availableContainer = editor.querySelector('#availableEmailChips');
    const ccoWrapper = editor.querySelector('#ccoEmailsWrapper');
    const ccoContainer = editor.querySelector('#ccoEmailChips');
    const newEmailInput = editor.querySelector('#newEmailInput');
    const addEmailBtn = editor.querySelector('#addEmailBtn');
    const hiddenInput = editor.querySelector('#selectedEmailRecipients');

    const addPlaceholder = dataset.addPlaceholder || getMessage(documentos.addEmailPlaceholder);
    const addButtonLabel = dataset.addButtonLabel || getMessage(documentos.addEmailButton);
    const removeLabel = dataset.removeLabel || getMessage(documentos.removeEmail);
    const noActiveLabel = dataset.noActive || getMessage(documentos.noActiveEmails);
    const invalidEmailMessage = dataset.invalidEmail || getMessage(documentos.invalidEmail);
    const emailExistsMessage = dataset.emailExists || getMessage(documentos.emailExists);
    const noRecipientsMessage = dataset.noRecipients || getMessage(documentos.noRecipientsSelected);

    if (newEmailInput) {
      newEmailInput.placeholder = addPlaceholder;
    }

    if (addEmailBtn) {
      addEmailBtn.setAttribute('aria-label', addButtonLabel);
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
    const normalize = (email) => (typeof email === 'string' ? email.trim() : '');

    const knownEmails = new Set();
    let baseEmails = [];
    let activeEmails = new Set();
    let validationMode = getGlobalValidationMode();

    const metadataList = getRecipientMetadataList();
    if (metadataList.length) {
      metadataList.forEach((meta) => {
        const normalized = normalize(meta.email);
        if (normalized) {
          knownEmails.add(normalized);
        }
      });
    }

    const syncHiddenInput = () => {
      if (hiddenInput) {
        hiddenInput.value = Array.from(activeEmails).join(',');
      }
    };

    const renderCco = () => {
      if (!ccoWrapper || !ccoContainer) return;
      const ccoEmails = getCcoEmailsFromMetadata();
      if (!ccoEmails.length) {
        ccoWrapper.classList.add('hidden');
        ccoContainer.innerHTML = '';
        return;
      }
      ccoWrapper.classList.remove('hidden');
      ccoContainer.innerHTML = '';
      ccoEmails.forEach((email) => {
        const isActive = activeEmails.has(email);
        const button = document.createElement('button');
        button.type = 'button';
        button.className = isActive
          ? 'inline-flex items-center gap-2 rounded-full border border-green-300 px-3 py-1 text-xs text-green-700 bg-green-50 dark:border-green-700 dark:text-green-200 dark:bg-green-900/30 cursor-default'
          : 'inline-flex items-center gap-1 rounded-full border border-dashed border-gray-300 px-3 py-1 text-xs text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800';
        button.innerHTML = isActive
          ? `<svg class="w-3 h-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-7.5 7.5a1 1 0 01-1.414 0l-3.5-3.5a1 1 0 011.414-1.414l2.793 2.793 6.793-6.793a1 1 0 011.414 0z" clip-rule="evenodd" /></svg><span>${email}</span>`
          : `<svg class="w-3 h-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" /></svg><span>${email}</span>`;
        if (!isActive) {
          button.addEventListener('click', () => {
            activeEmails.add(email);
            renderAll();
          });
        }
        ccoContainer.appendChild(button);
      });
    };

    const renderActive = () => {
      if (!activeContainer) return;
      activeContainer.innerHTML = '';

      if (activeEmails.size === 0) {
        const empty = document.createElement('span');
        empty.className = 'text-xs text-gray-500 dark:text-gray-400';
        empty.textContent = noActiveLabel;
        activeContainer.appendChild(empty);
        return;
      }

      Array.from(activeEmails).forEach((email) => {
        const chip = document.createElement('span');
        const isAllowed = canSendToEmail(email, validationMode);
        chip.className = 'inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium transition-colors';
        if (isAllowed) {
          chip.className += ' bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200';
        } else {
          chip.className += ' bg-red-50 text-red-700 border border-red-300 dark:bg-red-900/40 dark:text-red-200 dark:border-red-700';
          const restrictionLabel = getRestrictionLabel(validationMode);
          chip.dataset.validationRestriction = restrictionLabel;
          chip.title = `${restrictionLabel} deshabilitado para este contacto`;
        }

        const text = document.createElement('span');
        text.textContent = email;

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'text-blue-600 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-100 focus:outline-none';
        removeBtn.setAttribute('aria-label', `${removeLabel} ${email}`);
        removeBtn.innerHTML = '&times;';
        removeBtn.addEventListener('click', () => {
          activeEmails.delete(email);
          renderAll();
        });

        chip.append(text, removeBtn);
        activeContainer.appendChild(chip);
      });
    };

    const renderAvailable = () => {
      if (!availableWrapper || !availableContainer) return;
      availableContainer.innerHTML = '';

      const ccoSet = new Set(getCcoEmailsFromMetadata().map(normalize).filter(Boolean));
      const availableList = Array.from(knownEmails).filter((email) => !activeEmails.has(email) && !ccoSet.has(normalize(email)));
      if (!availableList.length) {
        availableWrapper.classList.add('hidden');
        return;
      }

      availableWrapper.classList.remove('hidden');

      availableList.forEach((email) => {
        const button = document.createElement('button');
        button.type = 'button';
        const isAllowed = canSendToEmail(email, validationMode);
        button.className = isAllowed
          ? 'inline-flex items-center gap-1 rounded-full border border-dashed border-blue-300 px-3 py-1 text-xs text-blue-600 transition hover:bg-blue-50 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-900/30'
          : 'inline-flex items-center gap-1 rounded-full border border-dashed border-red-300 px-3 py-1 text-xs text-red-600 opacity-70 cursor-not-allowed dark:border-red-700 dark:text-red-300';
        button.dataset.validationAllowed = String(isAllowed);
        if (!isAllowed) {
          const restrictionLabel = getRestrictionLabel(validationMode);
          button.title = `${restrictionLabel} deshabilitado para este contacto`;
          button.setAttribute('aria-disabled', 'true');
        }
        button.setAttribute('aria-label', `${addButtonLabel} ${email}`);
        button.innerHTML = `<svg class="w-3 h-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" /></svg><span>${email}</span>`;
        if (isAllowed) {
          button.addEventListener('click', () => {
            activeEmails.add(email);
            renderAll();
          });
        }
        availableContainer.appendChild(button);
      });
    };

    const renderAll = () => {
      renderActive();
      renderAvailable();
      renderCco();
      syncHiddenInput();
    };

    const addEmailToActive = (email) => {
      const normalized = normalize(email);
      if (!normalized) return;

      if (!emailRegex.test(normalized)) {
        showNotification(invalidEmailMessage, 'error');
        return;
      }

      if (activeEmails.has(normalized)) {
        showNotification(emailExistsMessage, 'warning');
        return;
      }

      if (!canSendToEmail(normalized, validationMode)) {
        const restrictionLabel = getRestrictionLabel(validationMode);
        showNotification(
          `${normalized} no tiene habilitado ${restrictionLabel} y no puede recibir este tipo de documento.`,
          'error'
        );
        return;
      }

      activeEmails.add(normalized);
      knownEmails.add(normalized);
      renderAll();
    };

    const addFromInput = () => {
      if (!newEmailInput) return;
      const value = normalize(newEmailInput.value);
      if (!value) return;

      addEmailToActive(value);
      newEmailInput.value = '';
      newEmailInput.focus();
    };

    if (addEmailBtn) {
      addEmailBtn.addEventListener('click', addFromInput);
    }

    if (newEmailInput) {
      newEmailInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          addFromInput();
        }
      });
    }

    const setActiveFrom = (list) => {
      activeEmails.clear();
      if (Array.isArray(list)) {
        list.map(normalize).filter(Boolean).forEach((email) => {
          if (!canSendToEmail(email, validationMode)) return;
          activeEmails.add(email);
          knownEmails.add(email);
        });
      }
      renderAll();
    };

    const setBaseEmails = (list) => {
      const normalizedList = Array.isArray(list)
        ? list.map(normalize).filter(Boolean)
        : [];
      baseEmails = Array.from(new Set(normalizedList));
      baseEmails.forEach((email) => knownEmails.add(email));
      setActiveFrom(baseEmails);
    };

    const initialNormalized = Array.isArray(initialEmails)
      ? initialEmails.map(normalize).filter(Boolean)
      : [];

    initialNormalized.forEach((email) => knownEmails.add(email));
    baseEmails = Array.from(new Set(initialNormalized));
    getCcoEmailsFromMetadata().forEach((email) => {
      const normalized = normalize(email);
      if (normalized && !baseEmails.includes(normalized)) {
        baseEmails.push(normalized);
      }
    });
    setActiveFrom(baseEmails);

    if (!Array.isArray(window.emailRecipientsManual)) {
      window.emailRecipientsManual = Array.from(baseEmails);
    }
    if (!Array.isArray(window.emailRecipientsReports)) {
      window.emailRecipientsReports = Array.from(new Set(
        getRecipientMetadataList()
          .filter((meta) => meta.reports === true)
          .map((meta) => meta.email)
      ));
    }

    window.emailRecipientController = {
      getActive: () => Array.from(activeEmails),
      reset: (list) => {
        if (Array.isArray(list) && list.length) {
          setActiveFrom(list);
        } else {
          setActiveFrom(baseEmails);
        }
      },
      setBase: (list) => {
        setBaseEmails(list);
      },
      addToKnown: (list) => {
        if (!Array.isArray(list)) return;
        list.map(normalize).filter(Boolean).forEach((email) => knownEmails.add(email));
        renderAvailable();
      },
      getNoRecipientsMessage: () => noRecipientsMessage,
      setValidationMode: (mode) => {
        validationMode = String(mode) === '0' ? '0' : '1';
        setGlobalValidationMode(validationMode);
        if (activeEmails.size) {
          activeEmails = new Set(
            Array.from(activeEmails).filter((email) => canSendToEmail(email, validationMode))
          );
        }
        renderAll();
      },
      getValidationMode: () => validationMode
    };
  }

  async function sendDocument(fileId, orderNumber, customMessage, action, providedRecipients = null, providedNoRecipientsMessage = null, validationMode = getGlobalValidationMode(), ccoRecipients = []) {
    const state = resolveRecipientState();
    const recipients = Array.isArray(providedRecipients) ? providedRecipients : state.recipients;
    const emptyMessage = providedNoRecipientsMessage || state.noRecipientsMessage;

    if (!recipients.length) {
      showNotification(emptyMessage, 'warning');
      return false;
    }

    try {
      const res = await fetch(`${apiBase}/api/files/${action}/${fileId}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ orderNumber, customMessage, emails: recipients, cco_emails: Array.isArray(ccoRecipients) ? ccoRecipients : [] })
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error === 'NO_EMAIL_CONFIGURED') {
          showNotification(data.message, 'error');
          return false;
        }
        if (data.error === 'EMAIL_PERMISSION_DENIED' || data.error === 'SH_DOCUMENTS_DISABLED') {
          const blockedEmails = Array.isArray(data.emails) && data.emails.length ? data.emails : [];
          const blockedSuffix = blockedEmails.length ? ` (${blockedEmails.join(', ')})` : '';
          const messageTemplate =
            data.message ||
            getMessage(
              documentos.sendBlockedConfigMessage,
              `No se puede enviar el documento porque la configuración actual no permite enviar este tipo de documento${blockedSuffix}.`
            );
          const message = messageTemplate.replace('{blocked}', blockedSuffix);
          await confirmAction(getMessage(documentos.sendBlockedTitle), message, 'error');
          return false;
        }
        showNotification(data.message || getMessage(documentos.sendError), 'error');
        return false;
      }

      const successMessage =
        data.message ||
        (action === 'send'
          ? getMessage(documentos.sendSuccess)
          : getMessage(documentos.resendSuccess));
      showNotification(successMessage, 'success');

      window.emailRecipients = recipients;
      if (validationMode === '0') {
        window.emailRecipientsManual = recipients;
      } else {
        window.emailRecipientsReports = recipients;
      }
      if (validationMode === '0' && window.emailRecipientController?.setBase) {
        window.emailRecipientController.setBase(recipients);
      }

      await refreshFiles();
      return true;
    } catch (error) {
      console.error('Error enviando documento:', error);
      showNotification(getMessage(documentos.sendError), 'error');
      return false;
    }
  }
  function normalizeForCompare(value) {
    return (value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '');
  }

  function buildDocumentDisplayName(fileName, order) {
    const baseName = fileName || '';
    let cleanedBase = baseName
      .replace(/\s*-\s*Cliente\s*-\s*PO\s*-?\s*/i, ' ')
      .replace(/\s*-\s*PO\s*-?\s*$/i, '')
      .trim();
    const cleanedBaseLower = cleanedBase.toLowerCase();
    const cleanedBaseNormalized = normalizeForCompare(cleanedBase);
    const nameParts = [];
    if (cleanedBase) nameParts.push(cleanedBase);
    const normalizedClient = (resolvedClientName || '').trim();
    if (normalizedClient) {
      const clientLower = normalizedClient.toLowerCase();
      const clientNormalized = normalizeForCompare(normalizedClient);
      if (!cleanedBaseLower.includes(clientLower) && !cleanedBaseNormalized.includes(clientNormalized)) {
        nameParts.push(normalizedClient);
      }
    }
    const normalizedOrder = (order || '').trim();
    if (normalizedOrder) {
      const poText = /\bPO\b/i.test(normalizedOrder) ? normalizedOrder : `PO ${normalizedOrder}`;
      const poLower = poText.toLowerCase();
      const poNormalized = normalizeForCompare(poText);
      if (!cleanedBaseLower.includes('po ') && !cleanedBaseLower.includes(poLower) && !cleanedBaseNormalized.includes(poNormalized)) {
        nameParts.push(poText);
      }
    }
    return nameParts.length ? nameParts.join(' - ') : '-';
  }

  function openMessageModal(fileId, fileName, order, action, isGenerated = '1') {
    const orderDisplay = qs('#orderNumberDisplay');
    const docDisplay = qs('#orderDocumentDisplay');
    const messageInput = qs('#customMessage');
    const validationMode = String(isGenerated) === '0' ? '0' : '1';

    if (orderDisplay) orderDisplay.textContent = order || '-';
    if (docDisplay) {
      docDisplay.textContent = buildDocumentDisplayName(fileName, order);
    }
    if (messageInput) messageInput.value = '';
    if (window.emailRecipientController?.setValidationMode) {
      window.emailRecipientController.setValidationMode(validationMode);
    }
    if (window.emailRecipientController?.reset) {
      const manualDefaults = Array.isArray(window.emailRecipientsManual)
        ? window.emailRecipientsManual
        : Array.isArray(window.emailRecipients)
          ? window.emailRecipients
          : [];
      const reportsDefaults = Array.isArray(window.emailRecipientsReports)
        ? window.emailRecipientsReports
        : Array.from(new Set(
            getRecipientMetadataList()
              .filter((contact) => contact.reports === true)
              .map((contact) => contact.email)
          ));

      const baseRecipients = validationMode === '0' ? manualDefaults : reportsDefaults;
      window.emailRecipientController.reset(baseRecipients);
    }
    
    window.currentMessageData = {
      fileId,
      action,
      order: order || '',
      isGenerated: validationMode,
    };
    
    showModal('#messageModal');
  }

  // Función para abrir archivos en modal de forma segura
  window.downloadFile = async (fileId) => {
    try {
      if (!token) {
        showNotification(getMessage(documentos.authRequired), 'error');
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
          showNotification(getMessage(documentos.noPermission), 'error');
        } else if (response.status === 404) {
          showNotification(getMessage(documentos.fileNotFound), 'error');
        } else {
          showNotification(getMessage(documentos.loadFileError), 'error');
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
      showNotification(getMessage(documentos.loadFileNetworkError), 'error');
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
              <button id="close-file-modal" class="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors" title="${getMessage(comond.close)}">
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
                <p class="text-sm text-gray-600 dark:text-gray-400">${getMessage(documentos.loadingFile)}</p>
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
            showNotification(getMessage(documentos.downloadError), 'error');
          }
        } catch (error) {
          showNotification(getMessage(documentos.downloadError), 'error');
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

  function showFileError() {
    const fileContent = document.getElementById('file-content');
    if (!fileContent) return;
    fileContent.innerHTML = `
      <div class="flex flex-col items-center justify-center h-full text-center px-6">
        <p class="text-sm text-gray-600 dark:text-gray-400">${getMessage(documentos.loadFileError)}</p>
      </div>
    `;
  }

  // Función para cargar archivo con token temporal
  async function loadFileWithToken(fileId) {
    const fileContent = document.getElementById('file-content');
    
    try {     
      // Usar endpoint con token como parámetro de consulta
      const token = localStorage.getItem('token');
      const iframeUrl = `${apiBase}/api/files/view-with-token/${fileId}?token=${encodeURIComponent(token)}`;
      
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

    // Obtener el nombre del archivo desde la fila de la tabla
    const fileRow = btn.closest('tr');
    const fileNameCell = fileRow.querySelector('.filename-text');
    const fileName = fileNameCell?.dataset?.fullName || (fileNameCell ? fileNameCell.textContent.trim() : 'documento');
    const urlParams = new URLSearchParams(window.location.search);
    const orderFromUrl = urlParams.get('oc') || '';
    const order = btn.dataset?.order || orderOc || orderFromUrl || '';
    const displayName = buildDocumentDisplayName(fileName, order);

    const confirmed = await confirmAction(
      getMessage(documentos.confirmGenerateTitle),
      getMessage(documentos.confirmGenerateMessage).replace('{name}', displayName),
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

        if (!res.ok) throw new Error(getMessage(documentos.generateError));
        showNotification(getMessage(documentos.generateSuccess), 'success');
      } catch (err) {
        showNotification(getMessage(documentos.generateError), 'error');
      } finally {
        // Restaurar botón
        btn.innerHTML = originalText;
        btn.disabled = false;
        await refreshFiles();
      }
    }
  });

  // Event delegation para botones de enviar/reenviar
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('.send-btn, .resend-btn');
    if (!btn) return;
    e.preventDefault();

    const { fileId, fileName, order } = btn.dataset;
    const isGeneratedValue = btn.dataset.isGenerated ?? btn.closest('tr')?.dataset?.isGenerated ?? '1';
    
    // Si es un botón de reenviar, preguntar si regenerar primero
    if (btn.classList.contains('resend-btn')) {
      const regenerate = await confirmAction(
        getMessage(documentos.confirmRegenerateTitle),
        getMessage(documentos.confirmRegenerateMessage),
        'question'
      );

      if (regenerate) {
        // Mostrar loading en el botón
        const originalText = btn.innerHTML;
        btn.innerHTML = '<svg class="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path></svg>';
        btn.disabled = true;

        try {
          // Obtener idioma del localStorage
          const lang = localStorage.getItem('lang') || 'es';
          
          // Regenerar el documento
          const res = await fetch(`${apiBase}/api/files/regenerate/${fileId}`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ lang })
          });

          if (!res.ok) throw new Error(getMessage(documentos.regenerateError));
          
          const result = await res.json();
          
          // Después de regenerar, enviar por correo
          const urlParams = new URLSearchParams(window.location.search);
          const finalOrder = order || urlParams.get('oc') || '';
          openMessageModal(fileId, result.fileName, finalOrder, 'resend', isGeneratedValue);
          
        } catch (err) {
          showNotification(getMessage(documentos.regenerateError), 'error');
        } finally {
          // Restaurar botón
          btn.innerHTML = originalText;
          btn.disabled = false;
          await refreshFiles();
        }
      } else {
        // Solo enviar por correo sin regenerar
        const urlParams = new URLSearchParams(window.location.search);
        const finalOrder = order || urlParams.get('oc') || '';
        openMessageModal(fileId, fileName, finalOrder, 'resend', isGeneratedValue);
      }
    } else {
      // Botón de enviar normal - obtener OC de URL si order está vacío
      const urlParams = new URLSearchParams(window.location.search);
      const finalOrder = order || urlParams.get('oc') || '';
      openMessageModal(fileId, fileName, finalOrder, 'send', isGeneratedValue);
    }
  });



  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('.delete-btn');
    if (!btn) return;

    e.preventDefault();
    const fileId = btn.dataset.fileId;

    const confirmed = await confirmAction(
      getMessage(documentos.confirmDeleteTitle),
      getMessage(documentos.confirmDeleteMessage),
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
          showNotification(getMessage(documentos.deleteSuccess), 'success');
          btn.closest('tr')?.remove();
        } else {
          showNotification(data.message || getMessage(documentos.deleteError), 'error');
        }
      } catch (err) {
        showNotification(getMessage(documentos.deleteError), 'error');
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
    const currentName = span?.dataset?.fullName || span?.textContent?.trim() || '';
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
    const currentName = span.dataset?.fullName || span.textContent.trim();

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
        showNotification(getMessage(documentos.nameRequired), 'error');
        return;
      }
      
      // Obtener el fileId del botón que abrió el modal
      const editBtn = document.querySelector('.edit-btn.clicked');
      const fileId = editBtn?.dataset?.fileId;
      
      if (!fileId) {
        showNotification(getMessage(documentos.fileIdentifyError), 'error');
        return;
      }

      // Mostrar confirmación
      const confirmed = await confirmAction(
        getMessage(documentos.confirmEditTitle),
        getMessage(documentos.confirmEditMessage),
        'question'
      );

      if (confirmed) {
        // Mostrar loading
        
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
            showNotification(getMessage(documentos.updateSuccess), 'success');
            hideModal('#editFileModal');
            await refreshFiles();
          } else {
            showNotification(data.message || getMessage(documentos.updateError), 'error');
          }
        } catch (err) {
          showNotification(getMessage(documentos.updateNetworkError), 'error');
        } finally {
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
        showNotification(getMessage(documentos.nameRequired), 'error');
        return;
      }
      
      // Obtener el fileId y span del botón que abrió el modal
      const spanElement = document.querySelector('.filename-text.clicked');
      const cell = spanElement?.closest('.editable-filename');
      const fileId = cell?.dataset?.id;
      
      if (!fileId || !spanElement) {
        showNotification(getMessage(documentos.fileIdentifyError), 'error');
        return;
      }
      
      if (newName === spanElement.textContent.trim()) {
        hideModal('#renameFileModal');
        return;
      }

      // Mostrar confirmación
      const confirmed = await confirmAction(
        getMessage(documentos.confirmRenameTitle),
        getMessage(documentos.confirmRenameMessage),
        'question'
      );

      if (confirmed) {
        // Mostrar loading
        
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
            showNotification(getMessage(documentos.renameSuccess), 'success');
            renderTable();
            hideModal('#renameFileModal');
          } else {
            showNotification(data.message || getMessage(documentos.renameError), 'error');
          }
        } catch (err) {
          showNotification(getMessage(documentos.renameError), 'error');
        } finally {
        }
      }
    });
  }


  // Event listener para el botón de crear archivos por defecto
  createDefaultFilesBtn?.addEventListener('click', async () => {
    const confirmTitle =
      getMessage(documentos.create_default_files_title);
    const confirmMessage =
      getMessage(documentos.create_default_files_message);
    const creatingLabel =
      getMessage(documentos.creating_files);

    const confirmed = await confirmAction(
      confirmTitle,
      confirmMessage,
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
        <span>${creatingLabel}</span>
      `;
      createDefaultFilesBtn.disabled = true;

      try {
        console.log('[CREATE DEFAULT FILES] Sending request with:', {
          pc: window.orderPc,
          oc: window.orderOc,
          factura: resolvedFactura
        });
        
        const res = await fetch(`${apiBase}/api/files/create-default`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            pc: window.orderPc,
            oc: window.orderOc,
            factura: resolvedFactura
          })
        });

        const data = await res.json();

        if (res.ok) {
          const successTemplate = getMessage(documentos.createDefaultSuccess);
          showNotification(successTemplate.replace('{count}', data.filesCreated), 'success');
          await refreshFiles();
        } else {
          if (data && data.code === 'FILES_ALREADY_EXIST') {
            showNotification(getMessage(documentos.createDefaultAlreadyExists), 'warning');
          } else {
            showNotification(data.message || getMessage(documentos.createDefaultError), 'error');
          }
        }
      } catch (err) {
        showNotification(getMessage(documentos.createDefaultNetworkError), 'error');
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
      const clientName = resolvedClientName || readClientNameFromTitle();
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
      const uploadMultipleCheckbox = qs('#uploadMultipleCheckbox');

      if (uploadFileName) uploadFileName.value = '';
      if (uploadFileType) uploadFileType.value = 'PDF';
      if (uploadFileInput) uploadFileInput.value = '';
      if (uploadMultipleCheckbox) uploadMultipleCheckbox.checked = false;
      
      // Reset UI to single file mode
      resetUploadModalToSingleMode();
      
      showUploadModal();
    }, 500);
  });

  // Función para resetear el modal a modo single
  function resetUploadModalToSingleMode() {
    const singleFileSection = qs('#singleFileSection');
    const selectedFilesList = qs('#selectedFilesList');
    const uploadFileInput = qs('#uploadFileInput');
    const dropZoneText = qs('#dropZoneText');
    
    if (singleFileSection) singleFileSection.classList.remove('hidden');
    if (selectedFilesList) {
      selectedFilesList.classList.add('hidden');
      selectedFilesList.innerHTML = '';
    }
    if (uploadFileInput) {
      uploadFileInput.removeAttribute('multiple');
      uploadFileInput.value = '';
    }
    if (dropZoneText) dropZoneText.textContent = getMessage(documentos.dragAndDrop);
  }

  // Event listener para el checkbox de modo múltiple
  const uploadMultipleCheckbox = qs('#uploadMultipleCheckbox');
  if (uploadMultipleCheckbox) {
    uploadMultipleCheckbox.addEventListener('change', (e) => {
      const isMultiple = e.target.checked;
      const singleFileSection = qs('#singleFileSection');
      const selectedFilesList = qs('#selectedFilesList');
      const uploadFileInput = qs('#uploadFileInput');
      const dropZoneText = qs('#dropZoneText');
      
      if (isMultiple) {
        // Modo múltiple: ocultar selector de tipo, habilitar selección múltiple
        if (singleFileSection) singleFileSection.classList.add('hidden');
        if (uploadFileInput) uploadFileInput.setAttribute('multiple', 'multiple');
        if (dropZoneText) dropZoneText.textContent = getMessage(documentos.dragAndDropMultiple) || 'Drag and drop files here or click to select';
      } else {
        // Modo single: mostrar selector de tipo, deshabilitar selección múltiple
        if (singleFileSection) singleFileSection.classList.remove('hidden');
        if (selectedFilesList) {
          selectedFilesList.classList.add('hidden');
          selectedFilesList.innerHTML = '';
        }
        if (uploadFileInput) {
          uploadFileInput.removeAttribute('multiple');
          uploadFileInput.value = '';
        }
        if (dropZoneText) dropZoneText.textContent = getMessage(documentos.dragAndDrop);
      }
    });
  }

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
        const uploadMultipleCheckbox = qs('#uploadMultipleCheckbox');
        const selectedFilesList = qs('#selectedFilesList');

        if (uploadFileName) uploadFileName.value = '';
        if (uploadFileType) uploadFileType.value = 'PDF';
        if (uploadFileInput) uploadFileInput.value = '';
        if (dropZoneText) dropZoneText.textContent = getMessage(documentos.dragAndDrop);
        if (uploadMultipleCheckbox) uploadMultipleCheckbox.checked = false;
        if (selectedFilesList) {
          selectedFilesList.classList.add('hidden');
          selectedFilesList.innerHTML = '';
        }
        
        // Reset to single mode
        resetUploadModalToSingleMode();
      });
    }
  });

  // Event listener para confirmar la subida
  const confirmUploadBtn = qs('#confirmUploadBtn');
  if (confirmUploadBtn) {
    confirmUploadBtn.addEventListener('click', async () => {
      const uploadMultipleCheckbox = qs('#uploadMultipleCheckbox');
      const isMultiple = uploadMultipleCheckbox?.checked;
      
      if (isMultiple) {
        await handleMultipleFileUpload();
      } else {
        await handleSingleFileUpload();
      }
    });
  }

  // Función para manejar subida de un solo archivo (lógica original)
  async function handleSingleFileUpload() {
    const confirmUploadBtn = qs('#confirmUploadBtn');
    const uploadSelect = qs('#uploadFileName');
    const selectedOption = uploadSelect?.selectedOptions?.[0];
    const fileId = selectedOption?.value?.trim();
    const fileName = selectedOption?.dataset?.fileName || selectedOption?.textContent?.trim();
    const fileType = qs('#uploadFileType')?.value;
    const pcName = qs('#uploadModal')?.dataset?.folderName;
    const idFolder = qs('#uploadModal')?.dataset?.folderId;
    const isVisibleToCustomer = qs('#isVisibleToClient')?.value;
    const fileObject = qs('#uploadFileInput')?.files?.[0];
    const orderPc = window.orderPc || pcName || '';
    const orderOc = window.orderOc || '';

    if (!fileId || !fileName || !fileType || !fileObject) {
      showNotification(getMessage(documentos.uploadFieldsRequired), 'error');
      return;
    }

    const originalUploadContent = confirmUploadBtn.innerHTML;
    const uploadingLabel = getMessage(documentos.uploading);
    confirmUploadBtn.innerHTML = `
      <span class="flex items-center gap-2">
        <svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
        </svg>
        <span>${uploadingLabel}</span>
      </span>
    `;
    confirmUploadBtn.disabled = true;

    try {
      const response = await fetch(`${apiBase}/api/customers/rut/${uuid}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error(getMessage(documentos.customerFetchError));

      const { name: clientName } = await response.json();

      const formData = new FormData();
      formData.append('customer_id', uuid);
      formData.append('folder_id', idFolder || '');
      formData.append('client_name', clientName);
      formData.append('subfolder', pcName || orderPc);
      formData.append('pc', orderPc);
      formData.append('oc', orderOc);
      formData.append('name', fileName);
      formData.append('file_id', fileId);
      formData.append('file', fileObject);
      formData.append('is_visible_to_customer', isVisibleToCustomer);

      const res = await fetch(`${apiBase}/api/files/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      if (!res.ok) {
        throw new Error(getMessage(documentos.uploadError));
      }

      showNotification(getMessage(documentos.uploadSuccess), 'success');

      hideUploadModal();

      const uploadFileName = qs('#uploadFileName');
      const uploadFileType = qs('#uploadFileType');
      const uploadFileInput = qs('#uploadFileInput');
      const dropZoneText = qs('#dropZoneText');

      if (uploadFileName) uploadFileName.value = '';
      if (uploadFileType) uploadFileType.value = 'PDF';
      if (uploadFileInput) uploadFileInput.value = '';
      if (dropZoneText) dropZoneText.textContent = getMessage(documentos.dragAndDrop);

      await refreshFiles();
    } catch (err) {
      showNotification(err.message || getMessage(documentos.uploadError), 'error');
    } finally {
      confirmUploadBtn.innerHTML = originalUploadContent;
      confirmUploadBtn.disabled = false;
    }
  }

  // Función para manejar subida de múltiples archivos
  async function handleMultipleFileUpload() {
    const confirmUploadBtn = qs('#confirmUploadBtn');
    const fileType = qs('#uploadFileType')?.value;
    const pcName = qs('#uploadModal')?.dataset?.folderName;
    const idFolder = qs('#uploadModal')?.dataset?.folderId;
    const isVisibleToCustomer = qs('#isVisibleToClient')?.value;
    const fileInput = qs('#uploadFileInput');
    const files = fileInput?.files;
    const orderPc = window.orderPc || pcName || '';
    const orderOc = window.orderOc || '';

    if (!files || files.length === 0) {
      showNotification(getMessage(documentos.uploadFieldsRequired), 'error');
      return;
    }

    const originalUploadContent = confirmUploadBtn.innerHTML;
    confirmUploadBtn.disabled = true;

    try {
      // Obtener información del cliente
      const response = await fetch(`${apiBase}/api/customers/rut/${uuid}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error(getMessage(documentos.customerFetchError));

      const { name: clientName } = await response.json();

      let successCount = 0;
      let failCount = 0;
      const totalFiles = files.length;

      // Subir archivos uno por uno
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Actualizar botón con progreso
        confirmUploadBtn.innerHTML = `
          <span class="flex items-center gap-2">
            <svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
            </svg>
            <span>${getMessage(documentos.uploading)} ${i + 1}/${totalFiles}</span>
          </span>
        `;

        try {
          const formData = new FormData();
          formData.append('customer_id', uuid);
          formData.append('folder_id', idFolder || '');
          formData.append('client_name', clientName);
          formData.append('subfolder', pcName || orderPc);
          formData.append('pc', orderPc);
          formData.append('oc', orderOc);
          formData.append('name', file.name); // Usar nombre original del archivo
          formData.append('file_id', '1'); // Usar file_id genérico para archivos múltiples
          formData.append('file', file);
          formData.append('is_visible_to_customer', isVisibleToCustomer);

          const res = await fetch(`${apiBase}/api/files/upload`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: formData
          });

          if (res.ok) {
            successCount++;
          } else {
            failCount++;
            logger.error(`Error uploading file ${file.name}`);
          }
        } catch (fileError) {
          failCount++;
          logger.error(`Error uploading file ${file.name}:`, fileError);
        }
      }

      // Mostrar resultado
      if (successCount === totalFiles) {
        showNotification(`${successCount} ${getMessage(documentos.filesUploadedSuccessfully) || 'files uploaded successfully'}`, 'success');
      } else if (successCount > 0) {
        showNotification(`${successCount} ${getMessage(documentos.filesUploaded) || 'files uploaded'}, ${failCount} ${getMessage(documentos.filesFailed) || 'failed'}`, 'warning');
      } else {
        showNotification(getMessage(documentos.uploadError), 'error');
      }

      hideUploadModal();

      const uploadFileInput = qs('#uploadFileInput');
      const dropZoneText = qs('#dropZoneText');
      const selectedFilesList = qs('#selectedFilesList');

      if (uploadFileInput) uploadFileInput.value = '';
      if (dropZoneText) dropZoneText.textContent = getMessage(documentos.dragAndDrop);
      if (selectedFilesList) {
        selectedFilesList.classList.add('hidden');
        selectedFilesList.innerHTML = '';
      }

      await refreshFiles();
    } catch (err) {
      showNotification(err.message || getMessage(documentos.uploadError), 'error');
    } finally {
      confirmUploadBtn.innerHTML = originalUploadContent;
      confirmUploadBtn.disabled = false;
    }
  }

  // Event listeners para drag & drop
  const dropZone = qs('#dropZone');
  const fileInput = qs('#uploadFileInput');
  const dropZoneText = qs('#dropZoneText');

  fileInput?.addEventListener('change', () => {
    const uploadMultipleCheckbox = qs('#uploadMultipleCheckbox');
    const isMultiple = uploadMultipleCheckbox?.checked;
    
    if (isMultiple && fileInput.files.length > 0) {
      // Modo múltiple: mostrar lista de archivos
      renderSelectedFilesList(fileInput.files);
    } else if (dropZoneText) {
      // Modo single: mostrar nombre del archivo
      dropZoneText.textContent = fileInput.files.length > 0
        ? fileInput.files[0].name
        : getMessage(documentos.dragAndDrop);
    }
  });

  // Función para renderizar la lista de archivos seleccionados
  function renderSelectedFilesList(files) {
    const selectedFilesList = qs('#selectedFilesList');
    const dropZoneText = qs('#dropZoneText');
    
    if (!selectedFilesList) return;
    
    selectedFilesList.innerHTML = '';
    
    if (files.length === 0) {
      selectedFilesList.classList.add('hidden');
      if (dropZoneText) dropZoneText.textContent = getMessage(documentos.dragAndDropMultiple) || 'Drag and drop files here or click to select';
      return;
    }
    
    selectedFilesList.classList.remove('hidden');
    if (dropZoneText) dropZoneText.textContent = `${files.length} file(s) selected`;
    
    Array.from(files).forEach((file, index) => {
      const fileItem = document.createElement('div');
      fileItem.className = 'flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded-md';
      fileItem.innerHTML = `
        <div class="flex items-center gap-2 flex-1 min-w-0">
          <svg class="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          <span class="text-xs text-gray-700 dark:text-gray-300 truncate" title="${file.name}">${file.name}</span>
          <span class="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">(${formatFileSize(file.size)})</span>
        </div>
        <button type="button" class="remove-file-btn ml-2 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 flex-shrink-0" data-index="${index}">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      `;
      selectedFilesList.appendChild(fileItem);
    });
    
    // Event listeners para botones de eliminar
    selectedFilesList.querySelectorAll('.remove-file-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.currentTarget.dataset.index);
        removeFileFromSelection(index);
      });
    });
  }

  // Función para formatear tamaño de archivo
  function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  // Función para eliminar un archivo de la selección
  function removeFileFromSelection(index) {
    const fileInput = qs('#uploadFileInput');
    if (!fileInput || !fileInput.files) return;
    
    const dt = new DataTransfer();
    const files = Array.from(fileInput.files);
    
    files.forEach((file, i) => {
      if (i !== index) {
        dt.items.add(file);
      }
    });
    
    fileInput.files = dt.files;
    renderSelectedFilesList(fileInput.files);
  }

  dropZone?.addEventListener('click', () => fileInput?.click());

  // Configurar drag & drop
  if (dropZone && fileInput) {
    setupDragAndDrop(dropZone, (files) => {
      const uploadMultipleCheckbox = qs('#uploadMultipleCheckbox');
      const isMultiple = uploadMultipleCheckbox?.checked;
      
      if (files.length > 0) {
        const dataTransfer = new DataTransfer();
        
        if (isMultiple) {
          // Modo múltiple: agregar todos los archivos
          files.forEach(file => dataTransfer.items.add(file));
        } else {
          // Modo single: solo el primer archivo
          dataTransfer.items.add(files[0]);
        }
        
        fileInput.files = dataTransfer.files;
        
        if (isMultiple) {
          renderSelectedFilesList(fileInput.files);
        } else if (dropZoneText) {
          dropZoneText.textContent = files[0].name;
        }
      }
    });
  }

  // Inicializar - Los event listeners se manejan con event delegation
  
  // Cargar archivos al inicializar la página
  loadDocumentTypes();
  loadRecipients();
  refreshFiles();

  /* ---------- visibilidad (checkbox) ---------- */
  // Event listener para checkbox de visibilidad (como en clients.js)
  function attachVisibilityEvents() {
    // Event listener para wrappers de checkboxes deshabilitados
    document.querySelectorAll('.visibility-disabled-wrapper').forEach(wrapper => {
      wrapper.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showNotification(getMessage(documentos.visibilityNotAllowedFileNotCreated) || 'No se puede habilitar la visibilidad porque el archivo aún no ha sido creado', 'warning');
      });
    });

    document.querySelectorAll('.visibility-toggle').forEach(checkbox => {
      checkbox.addEventListener('change', async (e) => {
        const fileId = e.target.dataset.fileId;
        const statusId = parseInt(e.target.dataset.statusId, 10);
        const newVisible = e.target.checked ? 1 : 0;

        // Validar que solo se permita cambiar visibilidad para estados 2 y 3
        if (statusId === 1) {
          e.target.checked = !e.target.checked;
          showNotification(getMessage(documentos.visibilityNotAllowedForStatus1) || 'No se puede cambiar la visibilidad de documentos en estado Pendiente', 'warning');
          return;
        }

        // Mantén el nombre actual para el endpoint de actualización
        const row = e.target.closest('tr');
        const currentName = row?.querySelector('.filename-text')?.dataset?.fullName || row?.querySelector('.filename-text')?.textContent?.trim() || '';

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

          showNotification(getMessage(documentos.visibilityUpdateSuccess), 'success');
        } catch (err) {
          // Revierte el estado si hay error
          e.target.checked = !e.target.checked;
          showNotification(getMessage(documentos.visibilityUpdateError), 'error');
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
  setupModalClose('#messageHelpModal', '#closeMessageHelpModalBtn');
  setupModalClose('#editFileModal', '#closeEditModalBtn');
  setupModalClose('#renameFileModal', '#closeRenameModalBtn');
  setupModalClose('#uploadModal', '#closeUploadModalBtn');
  setupModalClose('#uploadHelpModal', '#closeUploadHelpModalBtn');
  setupModalClose('#uploadHelpModal', '#closeUploadHelpModalFooterBtn');

  const messageHelpBtn = qs('#messageHelpBtn');
  if (messageHelpBtn) {
    messageHelpBtn.addEventListener('click', () => {
      showModal('#messageHelpModal');
    });
  }

  const uploadHelpBtn = qs('#uploadHelpBtn');
  if (uploadHelpBtn) {
    uploadHelpBtn.addEventListener('click', () => {
      showModal('#uploadHelpModal');
    });
  }
  const uploadHelpInlineBtn = qs('#uploadHelpInlineBtn');
  if (uploadHelpInlineBtn) {
    uploadHelpInlineBtn.addEventListener('click', () => {
      showModal('#uploadHelpModal');
    });
  }

  const closeMessageModalBtnEl = qs('#closeMessageModalBtn');
  if (closeMessageModalBtnEl) {
    closeMessageModalBtnEl.addEventListener('click', () => {
      if (window.emailRecipientController?.setValidationMode) {
        window.emailRecipientController.setValidationMode('0');
      }
      window.currentMessageData = null;
    });
  }

  const messageModalElement = qs('#messageModal');
  if (messageModalElement) {
    messageModalElement.addEventListener('click', (e) => {
      if (e.target === messageModalElement) {
        if (window.emailRecipientController?.setValidationMode) {
          window.emailRecipientController.setValidationMode('0');
        }
        window.currentMessageData = null;
      }
    });
  }

  // Event listeners para el modal de mensaje
  const confirmMessageBtn = qs('#confirmMessageBtn');
  const cancelMessageBtn = qs('#cancelMessageBtn');

  const setConfirmLoading = (isLoading) => {
    if (!confirmMessageBtn) return;
    const cancelBtn = cancelMessageBtn;
    const closeBtn = qs('#closeMessageModalBtn');
    const helpBtn = qs('#messageHelpBtn');
    const originalLabel = confirmMessageBtn.dataset.originalLabel || confirmMessageBtn.textContent.trim();

    if (!confirmMessageBtn.dataset.originalLabel) {
      confirmMessageBtn.dataset.originalLabel = originalLabel;
    }

    confirmMessageBtn.disabled = isLoading;
    confirmMessageBtn.classList.toggle('opacity-70', isLoading);
    confirmMessageBtn.classList.toggle('cursor-not-allowed', isLoading);
    if (cancelBtn) {
      cancelBtn.disabled = isLoading;
      cancelBtn.classList.toggle('opacity-70', isLoading);
      cancelBtn.classList.toggle('cursor-not-allowed', isLoading);
    }
    if (closeBtn) {
      closeBtn.disabled = isLoading;
      closeBtn.classList.toggle('opacity-70', isLoading);
      closeBtn.classList.toggle('cursor-not-allowed', isLoading);
    }
    if (helpBtn) {
      helpBtn.disabled = isLoading;
      helpBtn.classList.toggle('opacity-70', isLoading);
      helpBtn.classList.toggle('cursor-not-allowed', isLoading);
    }

    if (isLoading) {
      confirmMessageBtn.innerHTML = `
        <span class="inline-flex items-center gap-2">
          <svg class="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
          </svg>
          <span>${getMessage(comond?.working || comond?.processing || comond?.loading || 'Procesando...')}</span>
        </span>
      `;
    } else {
      confirmMessageBtn.textContent = confirmMessageBtn.dataset.originalLabel || originalLabel;
    }
  };

  if (confirmMessageBtn) {
    confirmMessageBtn.addEventListener('click', async () => {
      const messageInput = qs('#customMessage');

      if (!window.currentMessageData) {
        showNotification(getMessage(documentos.noMessageData), 'error');
        return;
      }

      const { recipients: rawRecipients, noRecipientsMessage } = resolveRecipientState();
      if (!rawRecipients.length) {
        showNotification(noRecipientsMessage, 'warning');
        return;
      }

      // Separar destinatarios normales de CCO según metadata
      const ccoFromSelected = rawRecipients.filter((email) => {
        const meta = getRecipientMetadata(email);
        return meta?.cco === true;
      });
      const recipients = rawRecipients.filter((email) => {
        const meta = getRecipientMetadata(email);
        return !(meta?.cco === true);
      });

      const validationMode = window.currentMessageData?.isGenerated ?? getGlobalValidationMode();
      const invalidRecipients = recipients.filter(
        (email) => !canSendToEmail(email, validationMode)
      );

      if (invalidRecipients.length) {
        const restrictionLabel = getRestrictionLabel(validationMode);
        const blockedTemplate = getMessage(
          documentos.sendBlockedMessage,
          `No se puede enviar el documento a ${invalidRecipients.join(', ')} porque no tienen habilitado ${restrictionLabel}.`
        );
        const blockedMessage = blockedTemplate
          .replace('{emails}', invalidRecipients.join(', '))
          .replace('{restriction}', restrictionLabel);
        await confirmAction(
          getMessage(documentos.sendBlockedTitle),
          blockedMessage,
          'error'
        );
        return;
      }

      const confirmed = await confirmAction(
        getMessage(documentos.confirmSendTitle),
        getMessage(documentos.confirmSendMessage),
        'question'
      );

      if (!confirmed) {
        return;
      }

      try {
        setConfirmLoading(true);
        const ccoRecipients = Array.from(new Set([...getCcoEmailsFromMetadata(), ...ccoFromSelected]));
        const success = await sendDocument(
          window.currentMessageData.fileId,
          window.currentMessageData.order || '',
          messageInput?.value?.trim() || '',
          window.currentMessageData.action,
          recipients,
          noRecipientsMessage,
          validationMode,
          ccoRecipients
        );

        if (!success) {
          return;
        }
        hideModal('#messageModal');
        if (window.emailRecipientController?.setValidationMode) {
          window.emailRecipientController.setValidationMode('0');
        }
        window.currentMessageData = null;
      } finally {
        setConfirmLoading(false);
      }
    });
  }

  if (cancelMessageBtn) {
    cancelMessageBtn.addEventListener('click', () => {
      if (window.emailRecipientController?.setValidationMode) {
        window.emailRecipientController.setValidationMode('0');
      }
      hideModal('#messageModal');
      window.currentMessageData = null;
    });
  }

  // ===== SISTEMA DE ORDENAMIENTO =====

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
    sortFiles(currentSort.column, currentSort.direction);
    
    // Actualizar iconos
    updateSortIcons(currentSort.column, currentSort.direction);
    
    // Re-renderizar tabla
    currentPage = 1;
    renderTable();
  });

  /**
   * Función para ordenar las filas
   */
  function sortFiles(column, direction) {
    if (!column) return;

    const dateColumns = new Set(['fecha_generacion', 'fecha_envio', 'fecha_reenvio']);
    const localeCompareOptions = { numeric: true, sensitivity: 'base' };
    const multiplier = direction === 'desc' ? -1 : 1;

    const getComparableValue = (file) => {
      switch (column) {
        case 'name':
          return file.name ?? '';
        case 'status_name':
          return file.status_name ?? '';
        case 'fecha_generacion':
          return file.fecha_generacion ?? '';
        case 'fecha_envio':
          return file.fecha_envio ?? '';
        case 'fecha_reenvio':
          return file.fecha_reenvio ?? '';
        default:
          return file[column] ?? '';
      }
    };

    filteredFiles.sort((aFile, bFile) => {
      const rawA = getComparableValue(aFile);
      const rawB = getComparableValue(bFile);

      if (dateColumns.has(column)) {
        const timeA = rawA ? new Date(rawA).getTime() : Number.NaN;
        const timeB = rawB ? new Date(rawB).getTime() : Number.NaN;

        const aInvalid = Number.isNaN(timeA);
        const bInvalid = Number.isNaN(timeB);

        if (aInvalid && bInvalid) return 0;
        if (aInvalid) return 1 * multiplier;
        if (bInvalid) return -1 * multiplier;

        if (timeA === timeB) return 0;
        return (timeA - timeB) * multiplier;
      }

      const aValue = rawA.toString().trim().toLowerCase();
      const bValue = rawB.toString().trim().toLowerCase();

      const aEmpty = aValue.length === 0;
      const bEmpty = bValue.length === 0;

      if (aEmpty || bEmpty) {
        if (aEmpty && bEmpty) return 0;
        return aEmpty ? 1 * multiplier : -1 * multiplier;
      }

      const comparison = aValue.localeCompare(bValue, undefined, localeCompareOptions);
      return comparison * multiplier;
    });

    renderTable();
  }
}










