// ===== FUNCIONES GLOBALES Y UTILIDADES =====

// Función de sanitización para prevenir XSS
const sanitizeHTML = (str) => {
  if (typeof str !== 'string') return '';
  
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
};

// Función para crear elementos HTML de forma segura
const createSafeHTML = (template, data) => {
  return template.replace(/\${([^}]+)}/g, (match, key) => {
    const value = data[key];
    return typeof value === 'string' ? sanitizeHTML(value) : '';
  });
};

// Helper para getElementById (compatibilidad con código existente)
const qs = (id) => document.getElementById(id);

// Helper para querySelector
const querySelector = (selector) => document.querySelector(selector);

// Helper para querySelectorAll
const qsa = (selector) => document.querySelectorAll(selector);

const getCommonTranslations = () => {
  if (typeof window === 'undefined') {
    return { comond: {}, getMessage: (value) => (typeof value === 'string' ? value : '') };
  }
  const translations = window.translations || {};
  const comond = translations.comond || {};
  const getMessage = (value) => (typeof value === 'string' ? value : '');
  return { comond, getMessage };
};

// ===== SISTEMA DE NOTIFICACIONES =====
let notificationQueue = [];
let isProcessingQueue = false;
let activeNotifications = new Set();

const showNotification = (message, type = 'info', duration = 4000) => {
    // Crear un ID único para esta notificación
    const notificationId = `${message}-${type}-${Date.now()}`;
    
    // Verificar si ya existe una notificación idéntica
    const existingNotification = Array.from(activeNotifications).find(id => {
        const [existingMessage, existingType] = id.split('-').slice(0, -1);
        return existingMessage === message && existingType === type;
    });
    
    if (existingNotification) {
        // Duplicate notification ignored
        return;
    }
    
    // Verificar límite máximo de notificaciones (máximo 3)
    if (activeNotifications.size >= 3) {
        // Notification limit reached
        return;
    }
    
    // Agregar a la cola
    notificationQueue.push({ message, type, duration, id: notificationId });
    
    // Procesar cola si no está procesando
    if (!isProcessingQueue) {
        processNotificationQueue();
    }
};

const processNotificationQueue = async () => {
    if (notificationQueue.length === 0) {
        isProcessingQueue = false;
        return;
    }
    
    isProcessingQueue = true;
    const { message, type, duration, id } = notificationQueue.shift();
    
    // Agregar a notificaciones activas
    activeNotifications.add(id);
    
    const notification = document.createElement('div');
    
    const isDark = document.documentElement.classList.contains('dark');
    const colorMap = {
        success: {
            light: { bg: '#ffffff', text: '#059669', border: '#10b981' },
            dark: { bg: '#111827', text: '#34d399', border: '#10b981' }
        },
        error: {
            light: { bg: '#ffffff', text: '#dc2626', border: '#ef4444' },
            dark: { bg: '#111827', text: '#f87171', border: '#ef4444' }
        },
        warning: {
            light: { bg: '#ffffff', text: '#d97706', border: '#f59e0b' },
            dark: { bg: '#111827', text: '#fbbf24', border: '#f59e0b' }
        },
        info: {
            light: { bg: '#ffffff', text: '#2563eb', border: '#3b82f6' },
            dark: { bg: '#111827', text: '#60a5fa', border: '#3b82f6' }
        },
        danger: {
            light: { bg: '#ffffff', text: '#b91c1c', border: '#dc2626' },
            dark: { bg: '#111827', text: '#f87171', border: '#dc2626' }
        },
        primary: {
            light: { bg: '#ffffff', text: '#1d4ed8', border: '#2563eb' },
            dark: { bg: '#111827', text: '#60a5fa', border: '#2563eb' }
        },
        secondary: {
            light: { bg: '#ffffff', text: '#6b7280', border: '#9ca3af' },
            dark: { bg: '#111827', text: '#d1d5db', border: '#6b7280' }
        },
        dark: {
            light: { bg: '#ffffff', text: '#111827', border: '#1f2937' },
            dark: { bg: '#111827', text: '#e5e7eb', border: '#374151' }
        },
        light: {
            light: { bg: '#ffffff', text: '#111827', border: '#e5e7eb' },
            dark: { bg: '#111827', text: '#e5e7eb', border: '#374151' }
        }
    };

    const palette = colorMap[type] || colorMap.info;
    const colors = isDark ? palette.dark : palette.light;
    
    // Configurar iconos
    const icons = {
        success: `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
        </svg>`,
        error: `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>`,
        warning: `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>`,
        info: `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>`,
        danger: `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>`,
        primary: `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>`,
        secondary: `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>`,
        dark: `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>`,
        light: `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>`
    };
    
    // Calcular posición basada en notificaciones existentes
    const existingNotifications = document.querySelectorAll('[data-notification]');
    const topOffset = 4 + (existingNotifications.length * 4); // 4rem + 4rem por cada notificación
    
    // Aplicar estilos inline para garantizar visibilidad
    notification.style.cssText = `
        position: fixed !important;
        top: ${topOffset}rem !important;
        right: 1rem !important;
        z-index: 99999999 !important;
        padding: 1rem 1.5rem !important;
        border-radius: 0.5rem !important;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05) !important;
        transition: all 0.3s ease !important;
        transform: translateX(100%) !important;
        display: flex !important;
        align-items: center !important;
        gap: 0.75rem !important;
        min-width: 300px !important;
        max-width: 500px !important;
        word-wrap: break-word !important;
        font-size: 14px !important;
        font-weight: 500 !important;
        background-color: ${colors.bg} !important;
        color: ${colors.text} !important;
        border: 1px solid ${colors.border} !important;
        margin-bottom: 0.5rem !important;
    `;
    
    notification.setAttribute('data-notification', 'true');
    notification.innerHTML = `${icons[type] || icons.info}<span>${sanitizeHTML(message)}</span>`;
    
    document.body.appendChild(notification);
    
    // Animar entrada
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Auto-remover
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
                // Remover de notificaciones activas
                activeNotifications.delete(id);
                // Reposicionar notificaciones restantes
                repositionNotifications();
            }
        }, 300);
    }, duration);
    
    // Procesar siguiente notificación después de un pequeño delay
    setTimeout(() => {
        processNotificationQueue();
    }, 200);
};

// Funciones helper para diferentes tipos de notificaciones
const showSuccessNotification = (message, duration = 4000) => {
    showNotification(message, 'success', duration);
};

const showErrorNotification = (message, duration = 4000) => {
    showNotification(message, 'error', duration);
};

const showWarningNotification = (message, duration = 4000) => {
    showNotification(message, 'warning', duration);
};

const showInfoNotification = (message, duration = 4000) => {
    showNotification(message, 'info', duration);
};

const showDangerNotification = (message, duration = 4000) => {
    showNotification(message, 'danger', duration);
};

const showPrimaryNotification = (message, duration = 4000) => {
    showNotification(message, 'primary', duration);
};

const showSecondaryNotification = (message, duration = 4000) => {
    showNotification(message, 'secondary', duration);
};

const showDarkNotification = (message, duration = 4000) => {
    showNotification(message, 'dark', duration);
};

const showLightNotification = (message, duration = 4000) => {
    showNotification(message, 'light', duration);
};

const repositionNotifications = () => {
    const notifications = document.querySelectorAll('[data-notification]');
    notifications.forEach((notification, index) => {
        const topOffset = 4 + (index * 4);
        notification.style.top = `${topOffset}rem`;
    });
};

// ===== SISTEMA DE SPINNER =====
const showSpinner = (container) => {
    if (!container) return;
    
    // Si el contenedor ya tiene un spinner, no agregar otro
    if (container.querySelector('.animate-spin')) return;

    const { comond, getMessage } = getCommonTranslations();
    
    const spinner = document.createElement('div');
    spinner.className = 'flex justify-center items-center p-8';
    spinner.innerHTML = `
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span class="ml-2 text-gray-600">${getMessage(comond.loading)}</span>
    `;
    container.appendChild(spinner);
};

const hideSpinner = (container) => {
    if (!container) return;
    
    const spinner = container.querySelector('.animate-spin');
    if (spinner && spinner.parentElement) {
        spinner.parentElement.remove();
    }
};

// ===== VALIDACIÓN DE TOKENS =====
const validateToken = (token) => {
  if (!token) return false;
  
  try {
    const [, payloadBase64] = token.split('.');
    const payload = JSON.parse(atob(payloadBase64));
    const exp = payload.exp * 1000;
    const now = Date.now();
    
    // Token expirado si faltan menos de 5 minutos
    return (exp - now) > (5 * 60 * 1000);
  } catch (error) {
    return false;
  }
};

const getValidToken = () => {
  const token = localStorage.getItem('token');
  if (!validateToken(token)) {
    localStorage.removeItem('token');
    window.location.href = '/authentication/sign-in';
    return null;
  }
  return token;
};

// ===== VALIDACIÓN DE TOKEN (MANTENER COMPATIBILIDAD) =====
const checkToken = () => {
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = '/authentication/sign-in';
    return false;
  }
  return true;
};

// ===== CONFIRMACIONES CON SWEETALERT2 =====
// ===== MODAL DE CONFIRMACIÓN PERSONALIZADO =====
const confirmAction = async (title, message, type = 'warning', options = {}) => {
    return new Promise((resolve) => {
        const { comond, getMessage } = getCommonTranslations();
        const {
          confirmButtonText = getMessage(comond.confirm) || 'Confirm',
          cancelButtonText = getMessage(comond.cancel) || 'Cancel',
          loadingText = 'Procesando...',
          onConfirm = null
        } = options || {};

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
            </svg>`
        };
        
        // Colores de botones según el tipo
        const buttonColors = {
            warning: 'background-color: #ea580c;',
            error: 'background-color: #dc2626;',
            info: 'background-color: #2563eb;',
            success: 'background-color: #16a34a;'
        };
        const buttonHoverColors = {
            warning: '#c2410c',
            error: '#b91c1c',
            info: '#1d4ed8',
            success: '#15803d'
        };
        
        modal.innerHTML = `
            <div class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full mx-4 transform transition-all duration-300 scale-95 opacity-0" id="confirmModalContent">
                <div class="p-6">
                    <div class="flex items-center justify-center mb-4" id="confirmModalIcon">
                        ${icons[type] || icons.warning}
                    </div>
                    <h3 class="text-lg font-semibold text-gray-900 dark:text-white text-center mb-2" id="confirmModalTitle">${title}</h3>
                    <p class="text-sm text-gray-600 dark:text-gray-300 text-center mb-6" id="confirmModalMessage">${message}</p>
                    <div class="flex flex-col sm:flex-row sm:justify-end gap-3" id="confirmModalButtons">
                        <button id="confirmCancelBtn" class="text-xs w-full sm:w-auto px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 transition">${cancelButtonText}</button>
                        <button id="confirmAcceptBtn" class="text-xs w-full sm:w-auto px-4 py-2 rounded-lg text-white focus:outline-none focus:ring-2 transition" style="${buttonColors[type] || buttonColors.warning}" onmouseover="this.style.backgroundColor='${buttonHoverColors[type] || buttonHoverColors.warning}'" onmouseout="this.style.cssText='${buttonColors[type] || buttonColors.warning}'">${confirmButtonText}</button>
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
        
        // Función para mostrar estado de loading
        const showLoading = () => {
            const iconContainer = document.getElementById('confirmModalIcon');
            const titleEl = document.getElementById('confirmModalTitle');
            const messageEl = document.getElementById('confirmModalMessage');
            const buttonsContainer = document.getElementById('confirmModalButtons');
            
            // Cambiar icono a spinner
            iconContainer.innerHTML = `
                <svg class="w-12 h-12 text-blue-500 dark:text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
            `;
            
            // Actualizar texto
            titleEl.textContent = loadingText;
            messageEl.textContent = '';
            
            // Ocultar botones
            buttonsContainer.innerHTML = '';
        };
        
        // Event listeners
        const handleCancel = () => {
            animateOut(() => {
                document.body.removeChild(modal);
                resolve(false);
            });
        };
        
        const handleAccept = async () => {
            // Si hay un callback onConfirm, ejecutarlo y mostrar loading
            if (onConfirm && typeof onConfirm === 'function') {
                showLoading();
                try {
                    await onConfirm();
                    animateOut(() => {
                        document.body.removeChild(modal);
                        resolve(true);
                    });
                } catch (error) {
                    console.error('Error en onConfirm:', error);
                    animateOut(() => {
                        document.body.removeChild(modal);
                        resolve(true);
                    });
                }
            } else {
                animateOut(() => {
                    document.body.removeChild(modal);
                    resolve(true);
                });
            }
        };
        
        const animateOut = (callback) => {
            const content = document.getElementById('confirmModalContent');
            content.classList.remove('scale-100', 'opacity-100');
            content.classList.add('scale-95', 'opacity-0');
            setTimeout(callback, 300);
        };
        
        // Event listeners
        document.getElementById('confirmCancelBtn').addEventListener('click', handleCancel);
        document.getElementById('confirmAcceptBtn').addEventListener('click', handleAccept);
        
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
};

const showSuccess = (title, text = '') => {
    const message = text ? `${title}\n${text}` : title;
    showSuccessNotification(message);
};

const showError = (title, text = '') => {
    const message = text ? `${title}\n${text}` : title;
    showErrorNotification(message);
};

// ===== PAGINACIÓN =====
const createPagination = (totalPages, currentPage, onPageChange) => {
    const paginationContainer = querySelector('.pagination');
    if (!paginationContainer) return;
    
    paginationContainer.innerHTML = '';
    
    // Botón anterior
    const prevBtn = document.createElement('button');
    prevBtn.className = `px-3 py-2 mx-1 rounded ${currentPage === 1 ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-500 text-white hover:bg-blue-600'}`;
    prevBtn.textContent = 'Anterior';
    prevBtn.disabled = currentPage === 1;
    prevBtn.onclick = () => onPageChange(currentPage - 1);
    paginationContainer.appendChild(prevBtn);
    
    // Números de página
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);
    
    for (let i = startPage; i <= endPage; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.className = `px-3 py-2 mx-1 rounded ${i === currentPage ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`;
        pageBtn.textContent = i;
        pageBtn.onclick = () => onPageChange(i);
        paginationContainer.appendChild(pageBtn);
    }
    
    // Botón siguiente
    const nextBtn = document.createElement('button');
    nextBtn.className = `px-3 py-2 mx-1 rounded ${currentPage === totalPages ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-500 text-white hover:bg-blue-600'}`;
    nextBtn.textContent = 'Siguiente';
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.onclick = () => onPageChange(currentPage + 1);
    paginationContainer.appendChild(nextBtn);
};

// ===== BÚSQUEDA =====
const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};

const setupSearch = (searchInput, searchFunction) => {
    if (!searchInput) return;
    
    const debouncedSearch = debounce((value) => {
        searchFunction(value);
    }, 300);
    
    searchInput.addEventListener('input', (e) => {
        debouncedSearch(e.target.value);
    });
};

// ===== GESTIÓN DE MODALES =====
const showModal = (modalId) => {
    const modal = querySelector(modalId);
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        document.body.style.overflow = 'hidden';
    }
};

const hideModal = (modalId) => {
    const modal = querySelector(modalId);
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        document.body.style.overflow = 'auto';
    }
};

const setupModalClose = (modalId, closeSelector = '.close-modal') => {
    const modal = querySelector(modalId);
    if (!modal) return;
    
    // Cerrar con botones (puede ser múltiples selectores separados por coma)
    const selectors = closeSelector.split(',').map(s => s.trim());
    selectors.forEach(selector => {
        const closeBtn = modal.querySelector(selector);
        if (closeBtn) {
            closeBtn.addEventListener('click', () => hideModal(modalId));
        }
    });
    
    // Cerrar con Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
            hideModal(modalId);
        }
    });
    
    // Cerrar haciendo clic fuera del modal (deshabilitado para evitar cierres accidentales)
};

// ===== CONFIGURACIÓN DE DRAG & DROP =====
const setupDragAndDrop = (dropZone, onFileDrop) => {
    if (!dropZone) return;
    
    const handleDragOver = (e) => {
        e.preventDefault();
        dropZone.classList.add('border-blue-500', 'bg-blue-50');
    };
    
    const handleDragLeave = (e) => {
        e.preventDefault();
        dropZone.classList.remove('border-blue-500', 'bg-blue-50');
    };
    
    const handleDrop = (e) => {
        e.preventDefault();
        dropZone.classList.remove('border-blue-500', 'bg-blue-50');
        
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            onFileDrop(files);
        }
    };
    
    dropZone.addEventListener('dragover', handleDragOver);
    dropZone.addEventListener('dragleave', handleDragLeave);
    dropZone.addEventListener('drop', handleDrop);
    
    // Cleanup function
    return () => {
        dropZone.removeEventListener('dragover', handleDragOver);
        dropZone.removeEventListener('dragleave', handleDragLeave);
        dropZone.removeEventListener('drop', handleDrop);
    };
};

// ===== SOMBRA EN SCROLL =====
const setupScrollShadow = (container, shadowElement) => {
    if (!container || !shadowElement) return;
    
    const handleScroll = () => {
        let scrollTop, scrollHeight, clientHeight;
        
        if (container === window) {
            scrollTop = window.scrollY;
            scrollHeight = document.documentElement.scrollHeight;
            clientHeight = window.innerHeight;
        } else {
            scrollTop = container.scrollTop;
            scrollHeight = container.scrollHeight;
            clientHeight = container.clientHeight;
        }
        
        if (scrollTop > 0) {
            shadowElement.classList.add('shadow-lg');
        } else {
            shadowElement.classList.remove('shadow-lg');
        }
        
        if (scrollTop + clientHeight >= scrollHeight - 5) {
            shadowElement.classList.add('shadow-lg');
        }
    };
    
    container.addEventListener('scroll', handleScroll);
    
    // Cleanup function
    return () => {
        container.removeEventListener('scroll', handleScroll);
    };
};

// ===== FORMATEO DE FECHAS =====
const formatDate = (dateString) => {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    
    return date.toLocaleString('es-CL', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
};

const formatDateShort = (dateString) => {
    if (!dateString) return '-';
    
    // Si ya es un string en formato YYYY-MM-DD, devolverlo tal como está
    if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        return dateString;
    }
    
    // Si es una fecha válida, formatearla como YYYY-MM-DD
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
};

// ===== VALIDACIÓN DE FORMULARIOS =====
const validateForm = (formData, rules) => {
    const errors = {};
    
    for (const [field, rule] of Object.entries(rules)) {
        const value = formData[field];
        
        if (rule.required && (!value || value.trim() === '')) {
            errors[field] = `${field} es requerido`;
            continue;
        }
        
        if (rule.minLength && value && value.length < rule.minLength) {
            errors[field] = `${field} debe tener al menos ${rule.minLength} caracteres`;
            continue;
        }
        
        if (rule.pattern && value && !rule.pattern.test(value)) {
            errors[field] = rule.message || `${field} no es válido`;
        }
    }
    
    return errors;
};

// ===== VALIDACIÓN DE EMAIL =====
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// ===== MANIPULACIÓN DEL DOM =====
const createElement = (tag, className = '', innerHTML = '') => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (innerHTML) element.innerHTML = sanitizeHTML(innerHTML);
    return element;
};

const clearContainer = (container) => {
    if (container) {
        container.innerHTML = '';
    }
};

const toggleElement = (element, show) => {
    if (element) {
        element.classList.toggle('hidden', !show);
    }
};

// ===== FLOATING TOOLTIPS =====
const _floatingTooltipState = {
    el: null,
    currentTarget: null,
    globalHandlersBound: false,
    removeTimeout: null
};

const ensureFloatingTooltipElement = () => {
    if (!_floatingTooltipState.el) {
        const tooltip = document.createElement('div');
        tooltip.setAttribute('role', 'tooltip');
        Object.assign(tooltip.style, {
            position: 'fixed',
            zIndex: '50',
            backgroundColor: '#1f2937',
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
        _floatingTooltipState.el = tooltip;
    }
    return _floatingTooltipState.el;
};

const ensureFloatingTooltipHandlers = () => {
    if (_floatingTooltipState.globalHandlersBound) return;
    _floatingTooltipState.globalHandlersBound = true;
    const hideOnChange = () => hideFloatingTooltip();
    window.addEventListener('scroll', hideOnChange, true);
    window.addEventListener('resize', hideOnChange, true);
    window.addEventListener('keydown', event => {
        if (event.key === 'Escape') hideFloatingTooltip();
    }, true);
};

const positionFloatingTooltip = (target, tooltipEl) => {
    const rect = target.getBoundingClientRect();
    const tooltipRect = tooltipEl.getBoundingClientRect();
    const spacing = 10;

    // Si el elemento está en el sidebar (izquierda de la pantalla), posicionar a la derecha
    const isSidebar = target.closest('#sidebar');
    if (isSidebar) {
        let top = rect.top + (rect.height / 2) - (tooltipRect.height / 2);
        let left = rect.right + spacing;
        tooltipEl.style.top = `${Math.round(top)}px`;
        tooltipEl.style.left = `${Math.round(left)}px`;
        return;
    }

    let top = rect.top - tooltipRect.height - spacing;
    if (top < spacing) top = rect.bottom + spacing;
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
    left = Math.min(Math.max(spacing, left), viewportWidth - tooltipRect.width - spacing);
    tooltipEl.style.top = `${Math.round(top)}px`;
    tooltipEl.style.left = `${Math.round(left)}px`;
};

const showFloatingTooltip = (target) => {
    if (!target || !(target instanceof HTMLElement)) return;
    const text = target.getAttribute('data-tooltip');
    if (!text) return;
    ensureFloatingTooltipHandlers();
    clearTimeout(_floatingTooltipState.removeTimeout);
    const tooltipEl = ensureFloatingTooltipElement();
    tooltipEl.textContent = text;
    if (!tooltipEl.isConnected) document.body.appendChild(tooltipEl);
    tooltipEl.style.opacity = '0';
    tooltipEl.style.visibility = 'hidden';
    requestAnimationFrame(() => {
        tooltipEl.style.visibility = 'visible';
        positionFloatingTooltip(target, tooltipEl);
        requestAnimationFrame(() => { tooltipEl.style.opacity = '1'; });
    });
    _floatingTooltipState.currentTarget = target;
};

const hideFloatingTooltip = () => {
    if (!_floatingTooltipState.el) return;
    const tooltipEl = _floatingTooltipState.el;
    tooltipEl.style.opacity = '0';
    _floatingTooltipState.currentTarget = null;
    clearTimeout(_floatingTooltipState.removeTimeout);
    _floatingTooltipState.removeTimeout = window.setTimeout(() => {
        if (tooltipEl.parentElement) tooltipEl.parentElement.removeChild(tooltipEl);
        tooltipEl.style.visibility = 'hidden';
    }, 150);
};

const handleTooltipEnter = (event) => showFloatingTooltip(event.currentTarget);

const handleTooltipLeave = (event) => {
    const target = event.currentTarget;
    if (_floatingTooltipState.currentTarget === target) {
        if (event.type === 'mouseleave' && document.activeElement === target) return;
        hideFloatingTooltip();
    }
};

const setupFloatingTooltips = (container) => {
    if (!container) return;
    const tooltipTargets = container.querySelectorAll('[data-tooltip]');
    tooltipTargets.forEach(target => {
        target.addEventListener('mouseenter', handleTooltipEnter);
        target.addEventListener('mouseleave', handleTooltipLeave);
        target.addEventListener('focus', handleTooltipEnter);
        target.addEventListener('blur', handleTooltipLeave);
    });
};

// ===== EXPORTAR FUNCIONES =====
export {
    sanitizeHTML,
    createSafeHTML,
    qs,
    querySelector,
    qsa,
    showNotification,
    showSuccessNotification,
    showErrorNotification,
    showWarningNotification,
    showInfoNotification,
    showDangerNotification,
    showPrimaryNotification,
    showSecondaryNotification,
    showDarkNotification,
    showLightNotification,
    showSpinner,
    hideSpinner,
    checkToken,
    validateToken,
    getValidToken,
    confirmAction,
    showSuccess,
    showError,
    createPagination,
    debounce,
    setupSearch,
    showModal,
    hideModal,
    setupModalClose,
    setupDragAndDrop,
    setupScrollShadow,
    formatDate,
    formatDateShort,
    validateForm,
    createElement,
    clearContainer,
    toggleElement,
    isValidEmail,
    setupFloatingTooltips,
    hideFloatingTooltip
}; 
