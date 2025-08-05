// ===== FUNCIONES GLOBALES Y UTILIDADES =====

// Helper para getElementById (compatibilidad con código existente)
const qs = (id) => document.getElementById(id);

// Helper para querySelector
const querySelector = (selector) => document.querySelector(selector);

// Helper para querySelectorAll
const qsa = (selector) => document.querySelectorAll(selector);

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
        console.log('Notificación duplicada ignorada:', message);
        return;
    }
    
    // Verificar límite máximo de notificaciones (máximo 3)
    if (activeNotifications.size >= 3) {
        console.log('Límite de notificaciones alcanzado, ignorando:', message);
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
    
    // Configurar colores según el tipo
    const colorMap = {
        success: { bg: '#10b981', text: '#ffffff' },
        error: { bg: '#ef4444', text: '#ffffff' },
        warning: { bg: '#f59e0b', text: '#ffffff' },
        info: { bg: '#3b82f6', text: '#ffffff' },
        danger: { bg: '#dc2626', text: '#ffffff' },
        primary: { bg: '#2563eb', text: '#ffffff' },
        secondary: { bg: '#6b7280', text: '#ffffff' },
        dark: { bg: '#1f2937', text: '#ffffff' },
        light: { bg: '#f3f4f6', text: '#1f2937' }
    };
    
    const colors = colorMap[type] || colorMap.info;
    
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
        margin-bottom: 0.5rem !important;
    `;
    
    notification.setAttribute('data-notification', 'true');
    notification.innerHTML = `${icons[type] || icons.info}<span>${message}</span>`;
    
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
    
    const spinner = document.createElement('div');
    spinner.className = 'flex justify-center items-center p-8';
    spinner.innerHTML = `
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span class="ml-2 text-gray-600">Cargando...</span>
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

// ===== VALIDACIÓN DE TOKEN =====
const checkToken = () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/authentication/sign-in';
        return false;
    }
    return true;
};

// ===== CONFIRMACIONES CON SWEETALERT2 =====
const confirmAction = async (title, text, icon = 'warning') => {
    if (typeof Swal === 'undefined') {
        console.error('SweetAlert2 no está disponible');
        return confirm(`${title}\n${text}`);
    }
    
    const result = await Swal.fire({
        title,
        text,
        icon,
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Sí, continuar',
        cancelButtonText: 'Cancelar'
    });
    return result.isConfirmed;
};

const showSuccess = (title, text = '') => {
    if (typeof Swal === 'undefined') {
        console.error('SweetAlert2 no está disponible');
        alert(`${title}\n${text}`);
        return;
    }
    
    return Swal.fire({
        title,
        text,
        icon: 'success',
        timer: 2000,
        showConfirmButton: false
    });
};

const showError = (title, text = '') => {
    if (typeof Swal === 'undefined') {
        console.error('SweetAlert2 no está disponible');
        alert(`${title}\n${text}`);
        return;
    }
    
    return Swal.fire({
        title,
        text,
        icon: 'error'
    });
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
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
};

const hideModal = (modalId) => {
    const modal = querySelector(modalId);
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
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
    
    // Cerrar haciendo clic fuera del modal
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            hideModal(modalId);
        }
    });
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
    if (innerHTML) element.innerHTML = innerHTML;
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

// ===== EXPORTAR FUNCIONES =====
export {
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
    validateForm,
    createElement,
    clearContainer,
    toggleElement,
    isValidEmail
}; 