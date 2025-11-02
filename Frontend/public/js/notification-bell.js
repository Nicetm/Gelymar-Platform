export function initNotificationBell(config = {}) {
  const {
    apiBase = '',
    apiPublic = '',
    initialUnread = 0,
    roleId = null,
    notificationSettings = {}
  } = config;

  if (typeof window === 'undefined') {
    return;
  }

  const effectiveApiBase = apiPublic || apiBase || window.apiBase || '';
  if (effectiveApiBase) {
    window.apiBase = effectiveApiBase;
  }

  let notifications = [];
  let unreadCount = Number(initialUnread) || 0;
  let previousUnreadCount = unreadCount;
  let isTabBlinking = false;
  let tabBlinkInterval = null;
  const originalTitle = document.title;
  const userRole = localStorage.getItem('userRole') || 'client';
  const numericRoleId = Number(roleId);

  const normalizeEnable = (value) => {
    if (value === undefined || value === null) return false;
    const numeric = Number(value);
    if (!Number.isNaN(numeric)) {
      return numeric === 1;
    }
    return String(value).toLowerCase() === 'true';
  };

  const normalizeRoles = (roles) => {
    if (!Array.isArray(roles)) return [];
    return roles
      .map((value) => Number(value))
      .filter((value) => !Number.isNaN(value));
  };

  const resolveFeature = (key) => {
    const feature = notificationSettings?.[key] || {};
    const featureConfig = feature?.config || {};
    const explicitEnabled = typeof feature?.enabled === 'boolean' ? feature.enabled : null;
    const isEnabledFlag = explicitEnabled !== null ? explicitEnabled : normalizeEnable(featureConfig.enable);
    if (!isEnabledFlag) {
      return { enabled: false, config: featureConfig };
    }

    const roles = normalizeRoles(featureConfig.role_id || featureConfig.roles || []);
    if (!roles.length) {
      return { enabled: true, config: featureConfig };
    }

    if (Number.isNaN(numericRoleId)) {
      return { enabled: false, config: featureConfig };
    }

    return { enabled: roles.includes(numericRoleId), config: featureConfig };
  };

  const ordersFeature = resolveFeature('orders');
  const usersFeature = resolveFeature('users');
  let customersWithoutAccountCount = 0;

  async function fetchCustomersWithoutAccountCount(token) {
    if (!usersFeature.enabled) {
      customersWithoutAccountCount = 0;
      return 0;
    }

    if (!token) {
      return customersWithoutAccountCount;
    }

    try {
      const response = await fetch(`${apiBase}/api/customers/without-account`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) {
        return customersWithoutAccountCount;
      }

      const data = await response.json();
      const customers = Array.isArray(data?.customers) ? data.customers : [];
      customersWithoutAccountCount = customers.length;
      return customersWithoutAccountCount;
    } catch (error) {
      console.warn('No fue posible obtener clientes sin cuenta:', error);
      return customersWithoutAccountCount;
    }
  }

  // Importar showNotification desde utils
  import('/js/utils.js').then(utils => {
    window.showNotification = utils.showNotification;
  });
  
  // Importar funciones necesarias
  async function confirmAction(title, message, type = 'warning') {
    
    return new Promise((resolve) => {
      // Crear el modal
      const modal = document.createElement('div');
      modal.id = 'customConfirmModal';
      modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4';
      
      // Iconos según el tipo
      const icons = {
        warning: `<svg class="w-12 h-12 text-amber-500 dark:text-amber-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>`,
        info: `<svg class="w-12 h-12 text-blue-500 dark:text-blue-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>`
      };
      
      modal.innerHTML = `
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full mx-4 transform transition-all duration-300 scale-95 opacity-0" id="confirmModalContent">
          <div class="p-6">
            <div class="flex items-center justify-center mb-4">
              ${icons[type] || icons.warning}
            </div>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white text-center mb-2">${title}</h3>
            <p class="text-sm text-gray-600 dark:text-gray-300 text-center mb-6 whitespace-pre-line">${message}</p>
            <div class="flex gap-3 justify-end">
              <button id="confirmCancel" class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500">
                No
              </button>
              <button id="confirmAccept" class="px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${type === 'info' ? 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500' : 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500'}">
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
        if (content) {
          content.classList.remove('scale-100', 'opacity-100');
          content.classList.add('scale-95', 'opacity-0');
          setTimeout(callback, 300);
        } else {
          callback();
        }
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
  
  // Socket.io service (inline)
  class SocketService {
    constructor() {
      this.socket = null;
      this.isConnected = false;
      this.reconnectAttempts = 0;
      this.maxReconnectAttempts = 5;
    }

    connect(token) {
      if (this.socket && this.isConnected) {
        return this.socket;
      }

      const apiBase = window.apiBase;
      
      this.socket = io(apiBase, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
      });

      this.socket.on('connect', () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
      });

      this.socket.on('disconnect', (reason) => {
        this.isConnected = false;
      });

      this.socket.on('connect_error', (error) => {
        console.error('Error de conexión Socket.io:', error);
        this.reconnectAttempts++;
        
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          console.error('Máximo de intentos de reconexión alcanzado');
        }
      });

      this.socket.on('reconnect', (attemptNumber) => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
      });

      return this.socket;
    }

    onNewMessage(callback) {
      if (this.socket) {
        this.socket.on('newMessage', callback);
      }
    }

    onUpdateNotifications(callback) {
      if (this.socket) {
        this.socket.on('updateNotifications', callback);
      }
    }
  }

  const socketService = new SocketService();
  let socket = null;
  
  // Función local para obtener token válido
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
  function startTabBlink() {
    if (isTabBlinking || !document.hidden) {
      return;
    }

    isTabBlinking = true;
    tabBlinkInterval = setInterval(() => {
      if (!document.hidden) {
        stopTabBlink();
        return;
      }

      document.title = document.title === originalTitle
        ? `${originalTitle} 🔔 (${unreadCount})`
        : originalTitle;
    }, 1000);
  }

  function stopTabBlink() {
    if (tabBlinkInterval) {
      clearInterval(tabBlinkInterval);
      tabBlinkInterval = null;
    }

    if (isTabBlinking) {
      isTabBlinking = false;
      document.title = originalTitle;
    }
  }


  // Elementos del DOM
  const notificationBell = document.getElementById('notification-bell');
  const notificationDropdown = document.getElementById('notification-dropdown');
  const notificationList = document.getElementById('notification-list');
  const markAllReadBtn = document.getElementById('mark-all-read');
  
  // Función para cargar notificaciones
  async function loadNotifications() {
    
    const apiBase = window.apiBase;

    try {
      // Validar token usando función centralizada
      const token = getValidToken();
      if (!token) return;
      
      const response = await fetch(`${apiBase}/api/chat/summary`, {
headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) return;
      
      const data = await response.json();
      const newUnreadCount = data.data.totalUnread || 0;

      // Obtener alertas de órdenes sin suficientes documentos
      let missingDocs = [];
      let missingDocsCount = 0;
      if (ordersFeature.enabled) {
        try {
          const missingDocsResponse = await fetch(`${apiBase}/api/orders/alerts/missing-documents`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });

          if (missingDocsResponse.ok) {
            const missingDocsData = await missingDocsResponse.json();
            missingDocs = missingDocsData.orders || [];
            missingDocsCount = Number(missingDocsData.count || missingDocs.length || 0);
          }
        } catch (alertError) {
          console.warn('No fue posible obtener alertas de órdenes sin documentos:', alertError);
        }
      }
      
      if (usersFeature.enabled) {
        await fetchCustomersWithoutAccountCount(token);
      } else {
        customersWithoutAccountCount = 0;
      }

      const previousCount = unreadCount;
      unreadCount = newUnreadCount;
      if (usersFeature.enabled) {
        unreadCount += customersWithoutAccountCount;
      }
      if (ordersFeature.enabled) {
        unreadCount += missingDocsCount;
      }

      if (unreadCount > previousCount && document.hidden) {
        startTabBlink();
      }
      if (unreadCount === 0) {
        stopTabBlink();
      }

      // Actualizar badge
      updateNotificationBadge();
      
      // Cargar chats recientes como notificaciones
      notifications = (data.data.recentChats || []).filter((chat) => {
        const unread = Number(chat?.unread_count ?? 0);
        return unread > 0;
      });
      
      if (ordersFeature.enabled && missingDocsCount > 0) {
        const missingDocsNotifications = missingDocs.map(order => ({
          id: `orders-missing-docs-${order.id}`,
          type: 'orders_missing_documents',
          unread: true,
          timestamp: order.fecha_etd || order.fecha || new Date().toISOString(),
          order
        }));
        notifications = [...missingDocsNotifications, ...notifications];
      }
      
      // Agregar notificación de clientes sin cuenta si hay
      if (usersFeature.enabled && customersWithoutAccountCount > 0) {
        notifications.unshift({
          id: 'customers-without-account',
          type: 'customers_without_account',
          message: `${customersWithoutAccountCount} cliente${customersWithoutAccountCount > 1 ? 's' : ''} sin cuenta de usuario`,
          timestamp: new Date().toISOString(),
          unread: true
        });
      }
      
      renderNotifications();
      
    } catch (error) {
      console.error('Error cargando notificaciones:', error);
    }
  }
  
  // Función para actualizar el badge y color de la campanita
  function updateNotificationBadge() {
    const badge = document.getElementById('notification-badge');
    const ping = document.getElementById('notification-ping');
    const bellIcon = notificationBell?.querySelector('svg');
    
    if (unreadCount > 0) {
      // Cambiar color de la campanita a naranja
      if (bellIcon) {
        bellIcon.classList.remove('text-gray-600', 'dark:text-gray-300');
        bellIcon.classList.add('text-orange-500');
      }
      
      if (badge) {
        badge.textContent = unreadCount > 99 ? '99+' : unreadCount.toString();
        badge.classList.remove('hidden');
      }
      if (ping) {
        ping.classList.remove('hidden');
      }
    } else {
      // Restaurar color original de la campanita
      if (bellIcon) {
        bellIcon.classList.remove('text-orange-500');
        bellIcon.classList.add('text-gray-600', 'dark:text-gray-300');
      }

      if (badge) badge.classList.add('hidden');
      if (ping) ping.classList.add('hidden');
      stopTabBlink();
    }
  }
  
  // Función para renderizar notificaciones
  function renderNotifications() {
    if (!notificationList) return;
    
    if (notifications.length === 0) {
      notificationList.innerHTML = `
        <div class="p-3 text-center text-gray-500 dark:text-gray-400">
          <svg class="w-6 h-6 mx-auto mb-2 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <!-- cuerpo -->
            <path d="M12 4c-3.3 0-6 2.7-6 6v3c0 .9-.34 1.7-.95 2.32L4 17h16l-.95-1.68c-.61-.62-.95-1.43-.95-2.32V10c0-3.3-2.7-6-6-6z"/>
            <!-- badajo/sonido -->
            <path d="M10 20a2 2 0 0 0 4 0"/>
          </svg>
          <p class="text-sm">No hay mensajes nuevos</p>
        </div>
      `;
      return;
    }
    
    const notificationsHTML = notifications.map(notification => {
      // Manejar notificación de clientes sin cuenta
      if (notification.type === 'customers_without_account') {
        const formattedDate = new Date(notification.timestamp).toLocaleDateString('es-CL', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
        const formattedTime = new Date(notification.timestamp).toLocaleTimeString('es-CL', {
          hour: '2-digit',
          minute: '2-digit'
        });

        return `
          <div
            class="p-3 border-b border-gray-100 dark:border-gray-700 bg-red-50 dark:bg-red-900/20 cursor-pointer transition-colors customers-without-account-notification"
            data-notification-type="customers_without_account"
          >
            <div class="flex items-start gap-3">
              <svg class="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M12 21a9 9 0 110-18 9 9 0 010 18z"/>
              </svg>
              <div class="flex-1">
                <p class="font-medium text-sm text-gray-900 dark:text-white">
                  Clientes sin cuenta registrados
                </p>
                <p class="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  ${notification.message || '-'}
                </p>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  ${formattedDate} · ${formattedTime}
                </p>
              </div>
              <span class="ml-2 bg-red-500 text-white text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center">
                !
              </span>
            </div>
          </div>
        `;
      }
      
      if (notification.type === 'orders_missing_documents') {
        const order = notification.order || {};
        const etdDate = order.fecha_etd ? new Date(order.fecha_etd).toLocaleDateString('es-CL') : 'Sin ETD';
        const ingresoDate = order.fecha ? new Date(order.fecha).toLocaleDateString('es-CL') : 'Sin fecha';
        return `
          <div
            class="p-3 border-b border-gray-100 dark:border-gray-700 bg-red-50 dark:bg-red-900/20 cursor-pointer transition-colors orders-missing-docs-notification"
            data-order-id="${order.id || ''}"
            data-order-pc="${order.pc || ''}"
            data-order-oc="${order.oc || ''}"
          >
            <div class="flex items-start gap-3">
              <svg class="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M12 21a9 9 0 110-18 9 9 0 010 18z"/>
              </svg>
              <div class="flex-1">
                <p class="font-medium text-sm text-gray-900 dark:text-white">
                  Orden ${order.pc || 'N/A'} · OC ${order.oc || 'N/A'}
                </p>
                <p class="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  Cliente: ${order.customer_name || 'Sin información'}
                </p>
                <p class="text-xs text-gray-600 dark:text-gray-400">
                  Falta documentación mínima
                </p>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  ETD: ${etdDate} · Ingreso: ${ingresoDate}
                </p>
              </div>
              <span class="ml-2 bg-red-500 text-white text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center">
                !
              </span>
            </div>
          </div>
        `;
      }
      
      // Notificaciones de chat normales
      return `
        <div 
          class="p-3 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors notification-item"
          data-customer-id="${notification.customer_id}"
          data-company-name="${notification.company_name}"
          data-online="${notification.online === 1 ? 'true' : 'false'}"
        >
          <div class="flex items-start justify-between">
            <div class="flex-1">
              <p class="font-medium text-sm text-gray-900 dark:text-white flex items-center gap-2">
                <svg class="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
                </svg>
                ${notification.company_name ? notification.company_name.charAt(0).toUpperCase() + notification.company_name.slice(1).toLowerCase() : ''}
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-1">
                <span class="inline-block w-2 h-2 rounded-full ${notification.online === 1 ? 'bg-green-500' : 'bg-gray-400'}"></span>
                ${notification.online === 1 ? 'On line' : 'Offline'}
              </p>
              <p class="text-xs text-gray-600 dark:text-gray-400 truncate">${notification.last_message}</p>
              <p class="text-xs text-gray-500 dark:text-gray-500 mt-1">
                ${new Date(notification.last_message_time).toLocaleString()}
              </p>
            </div>
            ${notification.unread_count > 0 ? `
              <span class="ml-2 bg-red-500 text-white text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center">
                ${notification.unread_count}
              </span>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
    
    notificationList.innerHTML = notificationsHTML;
    
    // Agregar event listeners a los elementos de notificación
    notificationList.querySelectorAll('.notification-item').forEach(item => {
      item.addEventListener('click', () => {
        const customerId = item.getAttribute('data-customer-id');
        const companyName = item.getAttribute('data-company-name');
        
        if (typeof openAdminChat === 'function') {
          const isOnline = item.getAttribute('data-online') === 'true';
          openAdminChat(customerId, companyName, isOnline);
        }
        
        notificationDropdown?.classList.add('hidden');
      });
    });

    const ordersMissingDocsNotifications = notificationList.querySelectorAll('.orders-missing-docs-notification');
    ordersMissingDocsNotifications.forEach(item => {
      item.addEventListener('click', () => {
        const pc = item.getAttribute('data-order-pc') || '';
        const oc = item.getAttribute('data-order-oc') || '';
        const params = [];
        if (pc) params.push('pc=' + encodeURIComponent(pc));
        if (oc) params.push('oc=' + encodeURIComponent(oc));
        const targetUrl = params.length > 0 ? '/admin/orders?' + params.join('&') : '/admin/orders';
        try {
          if (oc) {
            localStorage.setItem('ordersSearchFilter', oc);
          } else if (pc) {
            localStorage.setItem('ordersSearchFilter', pc);
          }
        } catch (storageError) {
          console.warn('No se pudo guardar filtro de órdenes:', storageError);
        }
        notificationDropdown?.classList.add('hidden');
        window.location.href = targetUrl;
      });
    });

    // Agregar event listener para notificación de clientes sin cuenta
    const customersWithoutAccountNotification = notificationList.querySelector('.customers-without-account-notification');
    if (customersWithoutAccountNotification) {
      customersWithoutAccountNotification.addEventListener('click', () => {
        notificationDropdown?.classList.add('hidden');
        openCustomersWithoutAccountModal();
      });
    }
  }
  
  // Event listeners
  notificationBell?.addEventListener('click', (e) => {
    e.stopPropagation();
    notificationDropdown?.classList.toggle('hidden');
    
    // Cargar notificaciones cuando se abre
    if (!notificationDropdown?.classList.contains('hidden')) {
      loadNotifications();
      stopTabBlink();
    }
  });
  
  markAllReadBtn?.addEventListener('click', async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      
      // Marcar todas como leídas
      await fetch(`${apiBase}/api/chat/mark-all-read`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      // Recargar notificaciones
      loadNotifications();
      stopTabBlink();
      
    } catch (error) {
      console.error('Error marcando como leídas:', error);
    }
  });
  
  // Cerrar dropdown al hacer clic fuera
  document.addEventListener('click', (e) => {
    if (!notificationBell?.contains(e.target)) {
      notificationDropdown?.classList.add('hidden');
    }
  });
  
  // Inicializar Socket.io para notificaciones
  function initializeNotificationSocket() {
    // Verificar que Socket.io esté disponible
    if (typeof io === 'undefined') {
      console.error('Socket.io no está disponible');
      return;
    }

    const token = getValidToken();
    if (!token) {
      console.error('Token no encontrado para Socket.io');
      return;
    }

    // Verificar si el token es válido
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Date.now() / 1000;
      
      if (payload.exp < currentTime) {
        console.error('Token expirado para Socket.io');
        return;
      }
      
      socket = socketService.connect(token);
    } catch (error) {
      console.error('Token inválido para Socket.io:', error);
      return;
    }
    
    // Escuchar actualizaciones de notificaciones
    socketService.onUpdateNotifications(() => {
      loadNotifications();
    });
    
    // Escuchar mensajes nuevos
    socketService.onNewMessage((messageData) => {
      // Verificar que el mensaje sea para este usuario
      if (messageData.sender_role !== userRole) {
        // Si es admin, verificar si está hablando con ese cliente
        if (userRole === 'admin' && messageData.sender_role === 'client') {
          // Verificar si el admin está hablando con ese cliente
          const adminChatModal = document.getElementById('admin-chat-modal');
          if (adminChatModal && !adminChatModal.classList.contains('hidden')) {
            // El chat está abierto, verificar si es del cliente actual
            const currentCustomerId = window.currentAdminChatCustomerId;
            if (currentCustomerId && parseInt(messageData.customer_id) === parseInt(currentCustomerId)) {
              return;
            }
          }
        }
        
        // Actualizar contador de notificaciones
        updateNotificationCount();
        
        // Si es admin, actualizar todas las notificaciones
        if (userRole === 'admin') {
          if (window.updateNotificationsImmediately) {
            window.updateNotificationsImmediately();
          }
        }
      }
    });
  }
  
  // Inicializar badge al cargar la página
  updateNotificationBadge();
  
  // Inicializar notificaciones al cargar la página
  document.addEventListener('DOMContentLoaded', () => {
    updateNotificationBadge();
    loadNotifications();
    
    // Inicializar Socket.io para notificaciones
    setTimeout(() => {
      initializeNotificationSocket();
    }, 1000);
  });
  
  // Función global para recargar notificaciones (usada por AdminChatModal)
  window.reloadNotifications = loadNotifications;
  
  // Función para actualizar inmediatamente (sin esperar al polling)
  window.updateNotificationsImmediately = function() {
    loadNotifications();
  };

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      stopTabBlink();
    }
  });

  window.addEventListener('focus', () => {
    stopTabBlink();
  });

  // Función para abrir el modal de clientes sin cuenta
  async function openCustomersWithoutAccountModal() {

    const apiBase = window.apiBase;

    // Crear modal dinámicamente en el body
    const existingModal = document.getElementById('customersWithoutAccountModal');
    if (existingModal) {
      existingModal.remove();
    }

    const modal = document.createElement('div');
    modal.id = 'customersWithoutAccountModal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 dark:bg-black/80 flex justify-center items-center z-[9999]';
    modal.innerHTML = `
      <div class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-6 w-full max-w-4xl mx-4 relative max-h-[90vh] overflow-y-auto shadow-2xl">
        <button id="closeCustomersModalBtn" class="absolute top-3 right-3 text-gray-400 hover:text-red-500 transition dark:text-gray-300 dark:hover:text-red-400">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        
        <div class="flex items-center gap-4 mb-6">
          <div class="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
            <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"/>
            </svg>
          </div>
          <div>
            <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">Clientes sin Cuenta</h2>
            <p class="text-sm text-gray-600 dark:text-gray-400">Lista de clientes que no tienen cuenta de usuario</p>
          </div>
        </div>

        <div class="overflow-hidden rounded-xl shadow ring-1 ring-gray-200 dark:ring-gray-700">
          <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead class="bg-gray-100 dark:bg-gray-800 sticky top-0 z-10">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">Nombre</th>
                <th class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">RUT</th>
                <th class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">Email</th>
                <th class="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">Acciones</th>
              </tr>
            </thead>
            <tbody id="customersWithoutAccountTableBody" class="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
            </tbody>
          </table>
        </div>

      </div>
    `;
    
    document.body.appendChild(modal);

    try {
      const token = getValidToken();
      if (!token) return;

      const response = await fetch(`${apiBase}/api/customers/without-account`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) return;

      const data = await response.json();
      const customers = data.customers || [];

      // Renderizar tabla
      const tableBody = document.getElementById('customersWithoutAccountTableBody');
      if (tableBody) {
        tableBody.innerHTML = customers.map(customer => `
          <tr class="hover:bg-gray-50 dark:hover:bg-gray-800 transition" data-customer-id="${customer.id}">
            <td class="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
              <button class="customer-name-btn text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline transition-colors cursor-pointer" 
                      data-customer-name="${customer.name || ''}">
                ${customer.name ? customer.name.charAt(0).toUpperCase() + customer.name.slice(1).toLowerCase() : 'N/A'}
              </button>
            </td>
            <td class="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">${customer.rut || '-'}</td>
            <td class="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">${customer.email || '-'}</td>
            <td class="px-6 py-4 text-center">
              <button 
                class="px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors create-account-btn"
                data-customer-id="${customer.id}"
                data-customer-name="${customer.name}"
                data-customer-rut="${customer.rut}"
                data-customer-email="${customer.email || ''}"
              >
                Crear Cuenta
              </button>
            </td>
          </tr>
        `).join('');
      }


      // Agregar event listeners a los botones de crear cuenta
      tableBody.querySelectorAll('.create-account-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const customerId = btn.dataset.customerId;
          const customerName = btn.dataset.customerName;
          const customerRut = btn.dataset.customerRut;
          const customerEmail = btn.dataset.customerEmail;
          createCustomerAccount(customerId, customerName, customerRut, customerEmail);
        });
      });

      // Event listener para nombre del cliente (igual que en orders.js)
      tableBody.querySelectorAll('.customer-name-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const customerName = btn.dataset.customerName;
          if (customerName && customerName !== '-') {
            // Guardar el nombre del cliente en localStorage para que clients.js lo pueda leer
            localStorage.setItem('clientSearchFilter', customerName);
            // Navegar a la página de clientes
            window.location.href = '/admin/clients';
          }
        });
      });

      // Agregar event listeners para el modal
      const closeBtn = modal.querySelector('#closeCustomersModalBtn');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          modal.remove();
        });
      }

      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.remove();
        }
      });

    } catch (error) {
      console.error('Error cargando clientes sin cuenta:', error);
    }
  }

  // Función para crear cuenta de cliente
  async function createCustomerAccount(customerId, customerName, customerRut, customerEmail) {

    const apiBase = window.apiBase;

    try {
      // Verificar si el cliente tiene email
      const hasEmail = customerEmail && customerEmail.trim() !== '';
      let confirmed = true;

      if (!hasEmail) {
        confirmed = await confirmAction(
          'Cliente sin email',
          'El cliente al que quieres crear la cuenta no tiene un mail configurado. No podremos notificar la creación de la cuenta.\n¿Quieres continuar?',
          'warning'
        );
      } else {
        confirmed = await confirmAction(
          'Crear cuenta de usuario',
          `Se creará una cuenta usuario y password para el cliente. Lo notificaremos por correo electrónico al ${customerEmail}.\n¿Quieres crear la cuenta?`,
          'info'
        );
      }

      if (!confirmed) {
        return;
      }

      // Obtener datos del cliente por RUT
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          console.error('No hay token de autenticación');
          return;
        }

        const response = await fetch(`${apiBase}/api/customers/by-rut/${encodeURIComponent(customerRut)}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          console.error('Error al obtener datos del cliente');
          return;
        }

        const customerData = await response.json();
        
        // Crear cuenta de usuario
        const createResponse = await fetch(`${apiBase}/api/customers/${customerId}/create-account`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            customerName: customerData.name,
            customerRut: customerData.rut
          })
        });

        if (!createResponse.ok) {
          const errorData = await createResponse.json();
          console.error(`Error: ${errorData.message || 'Error al crear la cuenta'}`);
          return;
        }

        const result = await createResponse.json();
        
        if (window.showNotification) {
          window.showNotification(`Cuenta creada exitosamente para ${customerData.name}`, 'success');
        }
        
        // Remover la fila de la tabla
        const rowToRemove = document.querySelector(`tr[data-customer-id="${customerId}"]`);
        if (rowToRemove) {
          rowToRemove.remove();
        }
        
        // Actualizar contador de clientes sin cuenta
        const updateResponse = await fetch(`${apiBase}/api/customers/without-account`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (updateResponse.ok) {
          const data = await updateResponse.json();
          const customers = Array.isArray(data?.customers) ? data.customers : [];
          customersWithoutAccountCount = customers.length;
        }
        
        // Actualizar contador de notificaciones
        await updateNotificationCount();
        
        // Recargar notificaciones para actualizar la interfaz visual
        loadNotifications();
        
      } catch (error) {
        console.error('Error obteniendo datos del cliente:', error);
      }
      
    } catch (error) {
      console.error('Error creando cuenta:', error);
    }
  }


  // Función para obtener el customer_id del usuario actual
  async function getCustomerId() {

    const apiBase = window.apiBase;

    try {
      const token = localStorage.getItem('token');
      if (!token) return null;
      
      const response = await fetch(`${apiBase}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const userData = await response.json();
        return userData.customer_id;
      }
      return null;
    } catch (error) {
      console.error('Error obteniendo customer_id:', error);
      return null;
    }
  }

  // Función para actualizar contador de notificaciones
  async function updateNotificationCount() {

    const apiBase = window.apiBase;
    
    try {

      const token = localStorage.getItem('token');
      if (!token) return;

      let newCount = unreadCount;

      if (userRole === 'admin') {
        const response = await fetch(`${apiBase}/api/chat/summary`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
          const data = await response.json();
          newCount = data.totalUnread || 0;

          if (usersFeature.enabled) {
            const count = await fetchCustomersWithoutAccountCount(token);
            newCount += count;
          } else {
            customersWithoutAccountCount = 0;
          }

          if (ordersFeature.enabled) {
            try {
              const missingDocsResponse = await fetch(`${apiBase}/api/orders/alerts/missing-documents`, {
                headers: { 'Authorization': `Bearer ${token}` }
              });
              if (missingDocsResponse.ok) {
                const missingDocsData = await missingDocsResponse.json();
                const missingDocsCount = Number(
                  missingDocsData.count ||
                  (Array.isArray(missingDocsData.orders) ? missingDocsData.orders.length : 0) ||
                  0
                );
                newCount += missingDocsCount;
              }
            } catch (error) {
              console.warn('No fue posible actualizar la cuenta de ordenes sin documentos:', error);
            }
          }
        }
      } else {
        const customerId = await getCustomerId();
        if (customerId) {
          const response = await fetch(`${apiBase}/api/chat/unread-count/${customerId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });

          if (response.ok) {
            const data = await response.json();
            newCount = data.count || 0;
          }
        }
      }

      const previousCount = unreadCount;
      unreadCount = newCount;
      previousUnreadCount = unreadCount;

      if (unreadCount > previousCount && document.hidden) {
        startTabBlink();
      }
      if (unreadCount === 0) {
        stopTabBlink();
      }

      updateNotificationBadge();

    } catch (error) {
      console.error('Error actualizando contador de notificaciones:', error);
    }
  }
}
