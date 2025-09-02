// Configuración de servicios
const services = {
    mysql: { port: 3306, container: 'gelymar-platform-mysql', name: 'MySQL Database' },
    backend: { port: 3000, container: 'gelymar-platform-backend', name: 'Backend API' },
    frontend: { port: 2121, container: 'gelymar-platform-frontend', name: 'Frontend' },
    fileserver: { port: 8080, container: 'gelymar-platform-fileserver', name: 'File Server' },
    cronjob: { port: 9615, container: 'gelymar-platform-cron', name: 'Cron Jobs' },
    shell: { port: 8082, container: 'gelymar-platform-monitoring', name: 'Shell Access' }
};

// Variables globales para el usuario
let currentUser = null;
let userAppTypes = [];

// Verificar autenticación
async function checkAuth() {
    const token = localStorage.getItem('monitoring_token');
    const userData = localStorage.getItem('monitoring_user');
    
    if (!token || !userData) {
        window.location.href = 'login.html';
        return;
    }
    
    try {
        // Verificar token con el backend
        const response = await fetch('http://localhost:3000/api/monitoring/verify', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ token })
        });
        
        const data = await response.json();
        
        if (!response.ok || !data.success) {
            // Token inválido, limpiar y redirigir
            localStorage.removeItem('monitoring_token');
            localStorage.removeItem('monitoring_user');
            localStorage.removeItem('authenticated');
            window.location.href = 'login.html';
            return;
        }
        
        // Guardar datos del usuario
        currentUser = data.user;
        userAppTypes = data.user.appTypes || [];
        
        // Actualizar UI con información del usuario
        updateUserInfo();
        
    } catch (error) {
        console.error('Error verificando autenticación:', error);
        // En caso de error de conexión, usar datos locales
        try {
            currentUser = JSON.parse(userData);
            userAppTypes = currentUser.appTypes || [];
            updateUserInfo();
        } catch (e) {
            // Datos corruptos, redirigir a login
            localStorage.clear();
            window.location.href = 'login.html';
        }
    }
}

// Actualizar información del usuario en la UI
function updateUserInfo() {
    if (currentUser) {
        // Ocultar el botón de salir original
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.style.display = 'none';
        }
        
        // Agregar información del usuario al header con menú desplegable
        const headerActions = document.querySelector('.header-actions');
        if (headerActions) {
            const userMenu = document.createElement('div');
            userMenu.className = 'user-menu';
            userMenu.innerHTML = `
                <div class="user-menu-trigger">
                    <span style="color: white; font-weight: 500; margin-right: 10px;">
                        👤 ${currentUser.username}
                    </span>
                    <span style="color: white; font-size: 12px;">▼</span>
                </div>
                <div class="user-menu-dropdown">
                    <button class="user-menu-item" onclick="logout()">🚪 Salir</button>
                </div>
            `;
            headerActions.appendChild(userMenu);
        }
    }
}

// Filtrar servicios según permisos del usuario
function getFilteredServices() {
    if (!userAppTypes || userAppTypes.length === 0) {
        return {}; // Sin permisos
    }
    
    const filtered = {};
    for (const [serviceName, service] of Object.entries(services)) {
        if (userAppTypes.includes(serviceName)) {
            filtered[serviceName] = service;
        }
    }
    
    return filtered;
}

// Ocultar servicios no autorizados
function hideUnauthorizedServices() {
    const filteredServices = getFilteredServices();
    
    for (const serviceName of Object.keys(services)) {
        const serviceCard = document.querySelector(`[data-service="${serviceName}"]`);
        if (serviceCard) {
            if (filteredServices[serviceName]) {
                serviceCard.style.display = 'block';
            } else {
                serviceCard.style.display = 'none';
            }
        }
    }
}

// Actualizar indicador de estado
function updateStatusIndicator(serviceName, status) {
    const indicator = document.getElementById(`${serviceName}-status`);
    const stateElement = document.getElementById(`${serviceName}-state`);
    
    if (indicator && stateElement) {
        indicator.className = `status-indicator ${status}`;
        
        switch (status) {
            case 'online':
                indicator.textContent = '🟢';
                stateElement.textContent = 'En línea';
                stateElement.style.color = '#28a745';
                break;
            case 'offline':
                indicator.textContent = '🔴';
                stateElement.textContent = 'Desconectado';
                stateElement.style.color = '#dc3545';
                break;
            case 'warning':
                indicator.textContent = '🟡';
                stateElement.textContent = 'Advertencia';
                stateElement.style.color = '#ffc107';
                break;
            default:
                indicator.textContent = '⏳';
                stateElement.textContent = 'Verificando...';
                stateElement.style.color = '#6c757d';
        }
    }
}

// Verificar todos los servicios
async function checkAllServices() {
    const statusBanner = document.getElementById('statusBanner');
    const globalStatus = document.getElementById('globalStatus');
    
    const filteredServices = getFilteredServices();
    let onlineCount = 0;
    let totalServices = Object.keys(filteredServices).length;
    
    if (totalServices === 0) {
        statusBanner.className = 'status-banner error';
        globalStatus.textContent = '❌ No tienes permisos para ver ningún servicio';
        return;
    }
    
    try {
        // Obtener estado de servicios desde el backend
        const response = await fetch('http://localhost:3000/api/monitoring/status');
        const data = await response.json();
        
        if (data.success) {
            for (const [serviceName, service] of Object.entries(filteredServices)) {
                const status = data.status[serviceName] || 'offline';
                updateStatusIndicator(serviceName, status);
                
                if (status === 'online') {
                    onlineCount++;
                }
            }
        } else {
            // Si falla la petición al backend, mostrar todos como offline
            for (const [serviceName, service] of Object.entries(filteredServices)) {
                updateStatusIndicator(serviceName, 'offline');
            }
        }
    } catch (error) {
        console.error('Error obteniendo estado de servicios:', error);
        // Si hay error de conexión, mostrar todos como offline
        for (const [serviceName, service] of Object.entries(filteredServices)) {
            updateStatusIndicator(serviceName, 'offline');
        }
    }
    
    // Actualizar estado global
    if (onlineCount === totalServices) {
        statusBanner.className = 'status-banner';
        globalStatus.textContent = '✅ Todos los servicios están funcionando correctamente!';
    } else if (onlineCount === 0) {
        statusBanner.className = 'status-banner error';
        globalStatus.textContent = '❌ Todos los servicios están desconectados!';
    } else {
        statusBanner.className = 'status-banner warning';
        globalStatus.textContent = `⚠️ ${onlineCount}/${totalServices} servicios están funcionando`;
    }
}

// Ver logs de un servicio
async function viewLogs(serviceName) {
    const modal = document.getElementById('logsModal');
    const modalTitle = document.getElementById('modalTitle');
    const logsContent = document.getElementById('logsContent');
    
    modalTitle.textContent = `Logs de ${services[serviceName].name}`;
    logsContent.textContent = 'Cargando logs...';
    modal.style.display = 'block';
    
    try {
        // Simular obtención de logs (en producción esto sería una API real)
        const response = await fetch(`/api/logs/${serviceName}`);
        const logs = await response.text();
        logsContent.textContent = logs;
    } catch (error) {
        logsContent.textContent = `Error al cargar logs: ${error.message}\n\nLogs simulados para ${serviceName}:\n[${new Date().toISOString()}] Servicio iniciado\n[${new Date().toISOString()}] Conexión establecida\n[${new Date().toISOString()}] Operación completada`;
    }
}

// Ver métricas de un servicio
function viewMetrics(serviceName) {
    alert(`Métricas de ${services[serviceName].name} - Funcionalidad en desarrollo`);
}

// Cerrar modal
function closeModal() {
    const modal = document.getElementById('logsModal');
    modal.style.display = 'none';
}

// Logout
async function logout() {
    const token = localStorage.getItem('monitoring_token');
    
    if (token) {
        try {
            // Notificar al backend sobre el logout
            await fetch('http://localhost:3000/api/monitoring/logout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ token })
            });
        } catch (error) {
            console.error('Error en logout:', error);
        }
    }
    
    // Limpiar localStorage
    localStorage.removeItem('monitoring_token');
    localStorage.removeItem('monitoring_user');
    localStorage.removeItem('authenticated');
    
    // Redirigir a login
    window.location.href = 'login.html';
}

// Inicializar dashboard
async function initDashboard() {
    await checkAuth();
    
    // Ocultar servicios no autorizados
    hideUnauthorizedServices();
    
    // Verificar servicios inicialmente
    checkAllServices();
    
    // Verificar servicios cada 30 segundos
    setInterval(checkAllServices, 30000);
    
    // Event listeners
    document.getElementById('refreshBtn').addEventListener('click', checkAllServices);
    
    // Event listener para el menú de usuario
    document.addEventListener('click', function(event) {
        const userMenu = document.querySelector('.user-menu');
        const userMenuTrigger = document.querySelector('.user-menu-trigger');
        
        if (userMenu && userMenuTrigger) {
            if (userMenuTrigger.contains(event.target)) {
                userMenu.classList.toggle('active');
            } else if (!userMenu.contains(event.target)) {
                userMenu.classList.remove('active');
            }
        }
    });
    
    // Modal events
    document.querySelector('.close').addEventListener('click', closeModal);
    window.addEventListener('click', (event) => {
        const modal = document.getElementById('logsModal');
        if (event.target === modal) {
            closeModal();
        }
    });
    
    // Hacer funciones globales para onclick
    window.viewLogs = viewLogs;
    window.viewMetrics = viewMetrics;
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', initDashboard); 