// ===== FUNCIONES GLOBALES Y UTILIDADES =====

// Helper para getElementById (compatibilidad con código existente)
const qs = (id) => document.getElementById(id);

// Helper para querySelector
const querySelector = (selector) => document.querySelector(selector);

// Helper para querySelectorAll
const qsa = (selector) => document.querySelectorAll(selector);

// ===== SISTEMA DE NOTIFICACIONES =====
const showNotification = (message, type = 'info', duration = 4000) => {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg transition-all duration-300 transform translate-x-full`;
    
    const colors = {
        success: 'bg-green-500 text-white',
        error: 'bg-red-500 text-white',
        warning: 'bg-yellow-500 text-white',
        info: 'bg-blue-500 text-white'
    };
    
    notification.className += ` ${colors[type] || colors.info}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Animar entrada
    setTimeout(() => {
        notification.classList.remove('translate-x-full');
    }, 100);
    
    // Auto-remover
    setTimeout(() => {
        notification.classList.add('translate-x-full');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, duration);
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