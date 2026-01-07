export function initChatModal(config = {}) {
  if (typeof window === 'undefined') {
    return;
  }

  const {
    apiBase = '',
    apiPublic = '',
    lang = 'es',
    translations = {},
    fileServerUrl = '',
  } = config;

  const resolvedApiBase = apiPublic || apiBase || window.apiBase || '';
  if (resolvedApiBase) {
    window.apiBase = resolvedApiBase;
  }
  if (fileServerUrl) {
    window.fileServerUrl = fileServerUrl;
  }

  window.lang = lang;
  const t = translations || {};
  window.translations = t;

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
  // Elementos del DOM
  const chatModal = document.getElementById('chat-modal');
  const chatPanel = document.getElementById('chat-panel');
  const chatHeader = document.getElementById('chat-header');
  const closeChatBtn = document.getElementById('close-chat-btn');
  const minimizeChatBtn = document.getElementById('minimize-chat-btn');
  const chatMessagesDiv = document.getElementById('chat-messages');
  const chatInput = document.getElementById('chat-input');
  const chatImageInput = document.getElementById('chat-image-input');
  const chatImageBtn = document.getElementById('chat-image-btn');
  const sendMessageBtn = document.getElementById('send-message-btn');
  const chatImageModal = document.getElementById('chat-image-modal');
  const chatImageModalImg = document.getElementById('chat-image-modal-img');
  const chatImageModalClose = document.getElementById('chat-image-modal-close');
  const emojiBtn = document.getElementById('emoji-btn');
  const adminStatusContainer = document.getElementById('chat-admin-status');
  const adminStatusText = document.getElementById('chat-admin-status-text');
  const adminStatusDot = document.getElementById('chat-admin-status-dot');
  const adminNameLabel = document.getElementById('chat-admin-name');
  const adminSelection = document.getElementById('admin-selection');
  const adminList = document.getElementById('admin-list');
  const chatInputArea = document.getElementById('chat-input-area');
  const chatBody = document.getElementById('chat-body');
  
  // Emoticones disponibles
  const emojis = ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '😈', '👿', '👹', '👺', '🤡', '💩', '👻', '💀', '☠️', '👽', '👾', '🤖', '🎃', '😺', '😸', '😹', '😻', '😼', '😽', '😿'];
  
  // Función para mostrar/ocultar emoticones
  function toggleEmojiPicker() {
    let emojiPicker = document.getElementById('emoji-picker');
    
    if (emojiPicker) {
      emojiPicker.remove();
      return;
    }
    
    // Crear el picker de emoticones
    emojiPicker = document.createElement('div');
    emojiPicker.id = 'emoji-picker';
    emojiPicker.className = 'absolute bottom-full right-0 mb-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg p-3 max-w-xs grid grid-cols-8 gap-1 z-50';
    
    emojis.forEach(emoji => {
      const emojiBtn = document.createElement('button');
      emojiBtn.textContent = emoji;
      emojiBtn.className = 'p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-lg';
      emojiBtn.onclick = () => {
        chatInput.value += emoji;
        chatInput.focus();
        emojiPicker.remove();
      };
      emojiPicker.appendChild(emojiBtn);
    });
    
    // Posicionar el picker
    emojiBtn.parentElement.style.position = 'relative';
    emojiBtn.parentElement.appendChild(emojiPicker);
  }
  
  let isTyping = false;
  let socket = null;
  let cachedCustomerId = null;
  let cachedCustomerToken = null;
  let customerIdRequest = null;
  let currentAdminOnline = false;
  let adminStatusInterval = null;
  let adminDisplayName = 'Administrador';
  let selectedAdminId = null;
  let lastAdminActivity = null; // Timestamp de la última actividad del admin
  let isMinimized = false;
  const adminUnreadCounts = new Map();

  function incrementAdminUnread(adminId) {
    if (!adminId) return;
    const key = Number(adminId);
    const current = adminUnreadCounts.get(key) || 0;
    adminUnreadCounts.set(key, current + 1);
    updateAdminUnreadIndicators();
  }

  function resetAdminUnread(adminId) {
    if (!adminId) return;
    adminUnreadCounts.delete(Number(adminId));
    updateAdminUnreadIndicators();
  }

  function updateAdminUnreadIndicators() {
    if (!adminList) return;
    adminList.querySelectorAll('[data-admin-id]').forEach((item) => {
      const adminId = Number(item.dataset.adminId);
      const badge = item.querySelector('.admin-unread-badge');
      if (!badge) return;
      const count = adminUnreadCounts.get(adminId) || 0;
      if (count > 0) {
        badge.textContent = count > 99 ? '99+' : count.toString();
        badge.classList.remove('hidden');
      } else {
        badge.textContent = '';
        badge.classList.add('hidden');
      }
    });
  }
  
  // Función para obtener el customer_id del usuario actual (con caché simple)
  async function getCustomerId() {

    const apiBase = window.apiBase;

    const token = localStorage.getItem('token');
    if (!token) {
      cachedCustomerId = null;
      cachedCustomerToken = null;
      return null;
    }

    if (cachedCustomerToken === token && cachedCustomerId !== null) {
      return cachedCustomerId;
    }

    if (customerIdRequest) {
      return customerIdRequest;
    }

    customerIdRequest = (async () => {
      try {
        const response = await fetch(`${apiBase}/api/auth/me`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
          cachedCustomerId = null;
          cachedCustomerToken = null;
          return null;
        }

        const userData = await response.json();
        cachedCustomerId = userData.customer_id ?? null;
        cachedCustomerToken = token;
        return cachedCustomerId;
      } catch (error) {
        console.error('Error obteniendo customer_id:', error);
        cachedCustomerId = null;
        cachedCustomerToken = null;
        return null;
      } finally {
        customerIdRequest = null;
      }
    })();

    return customerIdRequest;
  }

  // Función para marcar mensajes como leídos por el cliente
  async function markMessagesAsReadByClient(customerIdOverride = null) {

    const apiBase = window.apiBase;

    try {
      const token = localStorage.getItem('token');
      const customerId = customerIdOverride ?? await getCustomerId();

      if (!token || !customerId) {
        return;
      }

      await fetch(`${apiBase}/api/chat/read/${customerId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
    } catch (error) {
      console.error('Error marcando mensajes como leídos por cliente:', error);
    }
  }

  function setAdminDisplayName(name) {
    const sanitized = (name && name.toString().trim()) || t.messages?.chat?.select_agent || 'Seleccionar Agente';
    adminDisplayName = sanitized;
    if (adminNameLabel) {
      adminNameLabel.textContent = adminDisplayName;
    }
  }

  function updateAdminPresence(isOnline) {
    currentAdminOnline = Boolean(isOnline);
    if (adminStatusText) {
      if (selectedAdminId) {
        adminStatusText.textContent = currentAdminOnline ? t.messages?.chat?.online || 'On line' : t.messages?.chat?.offline || 'Off line';
      } else {
        adminStatusText.textContent = t.messages?.chat?.choose_agent || 'Elige un agente para iniciar'; 
      }
    }
    if (adminStatusContainer) {
      adminStatusContainer.classList.remove('text-gray-500', 'dark:text-gray-400', 'text-green-500', 'dark:text-green-400');
      if (selectedAdminId) {
        adminStatusContainer.classList.add(currentAdminOnline ? 'text-green-500' : 'text-gray-500', currentAdminOnline ? 'dark:text-green-400' : 'dark:text-gray-400');
      } else {
        adminStatusContainer.classList.add('text-gray-500', 'dark:text-gray-400');
      }
    }
    if (adminStatusDot) {
      adminStatusDot.classList.remove('bg-green-500', 'bg-gray-400');
      if (selectedAdminId) {
        adminStatusDot.classList.add(currentAdminOnline ? 'bg-green-500' : 'bg-gray-400');
      } else {
        adminStatusDot.classList.add('bg-gray-400');
      }
    }
  }

  function normalizeOnlineFlag(value) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      return value === '1' || value.toLowerCase() === 'true';
    }
    return Number(value) === 1;
  }

  async function refreshAdminOnlineStatus() {

    const apiBase = window.apiBase;

    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      // Si el admin tuvo actividad reciente (menos de 30 segundos), no actualizar el estado
      if (lastAdminActivity && Date.now() - lastAdminActivity < 30000) {
        return;
      }

      const response = await fetch(`${apiBase}/api/chat/admin/status${selectedAdminId ? `?adminId=${selectedAdminId}` : ''}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        updateAdminPresence(false);
        if (selectedAdminId) {
          setAdminDisplayName(adminDisplayName);
        } else {
          setAdminDisplayName(t.messages?.chat?.select_agent || 'Seleccionar Agente');
        }
        return;
      }

      const payload = await response.json();
      const presence = payload?.data ?? payload ?? {};
      // No actualizar el nombre si no hay un admin seleccionado
      if (selectedAdminId) {
        if (typeof presence.name !== 'undefined') {
          setAdminDisplayName(presence.name);
        }
        const isOnline = normalizeOnlineFlag(presence.online);
        updateAdminPresence(isOnline);
      }
    } catch (error) {
      console.error('Error obteniendo estado del administrador:', error);
      updateAdminPresence(false);
      if (selectedAdminId) {
        setAdminDisplayName(adminDisplayName);
      } else {
        setAdminDisplayName(t.messages?.chat?.select_agent || 'Seleccionar Agente');
      }
    }
  }

  function startAdminStatusPolling() {
    if (adminStatusInterval) return;
    adminStatusInterval = setInterval(refreshAdminOnlineStatus, 10000);
  }

  function stopAdminStatusPolling() {
    if (adminStatusInterval) {
      clearInterval(adminStatusInterval);
      adminStatusInterval = null;
    }
  }

  updateAdminPresence(false);
  setAdminDisplayName(t.messages?.chat?.select_agent || 'Seleccionar Agente');

  // Función para cargar lista de administradores
  async function loadAdminList() {

    const apiBase = window.apiBase;

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        return;
      }

      const response = await fetch(`${apiBase}/api/chat/admins`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        return;
      }

      const data = await response.json();
      const admins = data.data || [];

      if (!adminList) return;

      adminList.innerHTML = '';

      if (admins.length === 0) {
        adminList.innerHTML = '<div class="text-center text-gray-500 dark:text-gray-400"><p>No hay agentes disponibles</p></div>';
        return;
      }

      admins.forEach(admin => {
        const adminItem = document.createElement('div');
        adminItem.className = 'flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors';
        adminItem.dataset.adminId = admin.id;
        
        const isOnline = normalizeOnlineFlag(admin.online);
        const statusColor = isOnline ? 'bg-green-500' : 'bg-gray-400';
        const statusText = isOnline ? 'On line' : 'Offline';
        
        adminItem.innerHTML = `
          <div class="flex items-center gap-3">
            <div class="relative w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
              <span class="text-white font-semibold text-sm">${admin.full_name.charAt(0).toUpperCase()}</span>
              <span class="admin-unread-badge absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center hidden"></span>
            </div>
            <div>
              <p class="font-semibold text-sm text-gray-900 dark:text-white">${admin.full_name}</p>
              <div class="flex items-center gap-1">
                <span class="inline-block w-2 h-2 rounded-full ${statusColor}"></span>
                <span class="text-xs text-gray-500 dark:text-gray-400">${statusText}</span>
              </div>
            </div>
          </div>
          <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
          </svg>
        `;

        adminItem.addEventListener('click', () => {
          selectAdmin(admin);
        });

        adminList.appendChild(adminItem);
      });
      updateAdminUnreadIndicators();
    } catch (error) {
      console.error('Error cargando lista de administradores:', error);
      if (adminList) {
        adminList.innerHTML = '<div class="text-center text-red-500"><p>Error cargando agentes: ' + error.message + '</p></div>';
      }
    }
  }

  // Función para seleccionar administrador
  function selectAdmin(admin) {
    selectedAdminId = admin.id;
    setAdminDisplayName(admin.full_name);
    updateAdminPresence(normalizeOnlineFlag(admin.online));
    resetAdminUnread(admin.id);
    
    // Ocultar selección de administradores y mostrar chat
    adminSelection.classList.add('hidden');
    chatMessagesDiv.classList.remove('hidden');
    chatInputArea.classList.remove('hidden');
    
    // Cargar mensajes del chat con el administrador seleccionado
    loadChatMessages();
  }

  // Función para cerrar el modal
  function closeChatModal() {
    if (chatModal && chatInput) {
      chatModal.classList.add('hidden');
      chatInput.blur();
    }
    if (typeof window.notifyClientChatClosed === 'function') {
      window.notifyClientChatClosed();
    }
    setChatMinimized(false);
    stopAdminStatusPolling();
    updateAdminPresence(false);
    
    // Resetear estado
    selectedAdminId = null;
    setAdminDisplayName(t.messages?.chat?.select_agent || 'Seleccionar Agente');
    updateAdminPresence(false); // Resetear estado a "Elige un agente para iniciar"
    adminSelection.classList.remove('hidden');
    chatMessagesDiv.classList.add('hidden');
    chatInputArea.classList.add('hidden');
  }
  
  // Función para enviar mensaje
  function hasSelectedImage() {
    return !!(chatImageInput && chatImageInput.files && chatImageInput.files.length > 0);
  }

  function updateSendButtonState() {
    if (!sendMessageBtn || !chatInput) return;
    sendMessageBtn.disabled = !chatInput.value.trim() && !hasSelectedImage();
  }

  async function uploadChatImage(file, customerId, adminId) {
    const apiBase = window.apiBase;
    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append('image', file);
    formData.append('customer_id', customerId);
    if (adminId) {
      formData.append('admin_id', adminId);
    }

    const response = await fetch(`${apiBase}/api/chat/upload-image`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error('Error subiendo imagen');
    }

    return response.json();
  }

  async function sendMessage() {

    const apiBase = window.apiBase;

    if (!chatInput || !sendMessageBtn || !chatMessagesDiv) return;
    
    const message = chatInput.value.trim();
    const imageFile = chatImageInput?.files?.[0] || null;
    if ((!message && !imageFile) || isTyping) return;
    
    isTyping = true;
    sendMessageBtn.disabled = true;
    
    try {
      let sanitizedMessage = '';
      if (message) {
        // Validar y sanitizar el mensaje
        const validationResult = validateAndSanitizeMessage(message);
        if (!validationResult.isValid) {
          showSecurityWarning(validationResult.reason);
          isTyping = false;
          sendMessageBtn.disabled = false;
          return;
        }
        sanitizedMessage = validationResult.message;
      }

      if (imageFile) {
        const allowedTypes = ['image/jpeg', 'image/png'];
        if (!allowedTypes.includes(imageFile.type)) {
          addMessageToChat('Solo se permiten imagenes JPG o PNG.', 'admin', new Date());
          isTyping = false;
          sendMessageBtn.disabled = false;
          return;
        }
        if (imageFile.size > 5 * 1024 * 1024) {
          addMessageToChat('La imagen supera 5MB.', 'admin', new Date());
          isTyping = false;
          sendMessageBtn.disabled = false;
          return;
        }
      }
      
      let payloadMessage = sanitizedMessage;
      if (imageFile) {
        const customerId = await getCustomerId();
        if (!customerId) {
          throw new Error('customerId no encontrado');
        }
        const uploadResult = await uploadChatImage(imageFile, customerId, selectedAdminId);
        payloadMessage = JSON.stringify({
          type: 'image',
          url: uploadResult.url,
          path: uploadResult.path,
          text: sanitizedMessage
        });
      }

      // Agregar mensaje del usuario (enviado, no leido aun)
      addMessageToChat(payloadMessage, 'user', new Date(), false);
      chatInput.value = '';
      if (chatImageInput) {
        chatImageInput.value = '';
      }
      updateSendButtonState();
      
      // Enviar mensaje a la API
      const token = localStorage.getItem('token');
      const customerId = await getCustomerId();
      
      if (!token || !customerId) {
        console.error('Token o customerId no encontrado');
        return;
      }
      
      const response = await fetch(`${apiBase}/api/chat/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          customer_id: customerId,
          admin_id: selectedAdminId,
          message: payloadMessage,
          sender_role: 'client'
        })
      });
      
      if (!response.ok) {
        throw new Error('Error enviando mensaje');
      }
      
      // Marcar mensajes como leídos
      await fetch(`${apiBase}/api/chat/read/${customerId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      // El mensaje ya se agregó al chat, no necesitamos agregarlo de nuevo
      isTyping = false;
      sendMessageBtn.disabled = false;
    } catch (error) {
      console.error('Error enviando mensaje:', error);
      addMessageToChat('Error enviando mensaje. Inténtalo de nuevo.', 'admin', new Date());
    } finally {
      isTyping = false;
      sendMessageBtn.disabled = false;
    }
  }
  
  // Función para agregar mensaje al chat
  function buildChatImageUrl(rawUrl, rawPath) {
    const baseUrl = window.fileServerUrl || '';
    if (rawPath) {
      const normalizedPath = String(rawPath).replace(/\\/g, '/').replace(/^\/+/, '');
      if (baseUrl) {
        return `${baseUrl.replace(/\/$/, '')}/${normalizedPath}`;
      }
      return `/${normalizedPath}`;
    }
    if (!rawUrl) {
      return '';
    }
    const url = String(rawUrl);
    if (/^https?:\/\//i.test(url)) {
      return url;
    }
    if (baseUrl) {
      return `${baseUrl.replace(/\/$/, '')}/${url.replace(/^\/+/, '')}`;
    }
    return url;
  }

  function parseChatPayload(message) {
    if (typeof message !== 'string') {
      return { type: 'text', text: '' };
    }
    try {
      const parsed = JSON.parse(message);
      if (parsed && parsed.type === 'image' && (parsed.url || parsed.path)) {
        const imageUrl = buildChatImageUrl(parsed.url, parsed.path);
        return {
          type: 'image',
          url: imageUrl,
          text: parsed.text || ''
        };
      }
    } catch (error) {
      // Ignorar JSON invalido
    }
    return { type: 'text', text: message };
  }

  function addMessageToChat(message, sender, createdAt = null, isReadByAdmin = false) {
    if (!chatMessagesDiv) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = `flex ${sender === 'user' ? 'justify-end' : 'justify-start'} mb-2`;

    // 📦 Contenedor en columna (burbuja + metadata)
    const messageContainer = document.createElement('div');
    messageContainer.className = "flex flex-col";

    const messageBubble = document.createElement('div');
    messageBubble.className = `max-w-xs rounded-lg p-3 ${
      sender === 'user' 
        ? 'bg-blue-600 text-white' 
        : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
    }`;

    // Fecha
    let timeString;
    if (createdAt) {
      const date = new Date(createdAt);
      timeString = date.toLocaleString('es-ES', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true
      });
    } else {
      const now = new Date();
      timeString = now.toLocaleString('es-ES', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true
      });
    }

    const content = parseChatPayload(message);
    if (content.type === 'image') {
      const imageEl = document.createElement('img');
      imageEl.src = content.url;
      imageEl.alt = 'Imagen adjunta';
      imageEl.className = 'rounded-lg max-w-[220px] h-auto';
      imageEl.loading = 'lazy';
      imageEl.style.cursor = 'zoom-in';
      imageEl.addEventListener('click', () => {
        if (chatImageModal && chatImageModalImg) {
          chatImageModalImg.src = content.url;
          chatImageModal.classList.remove('hidden');
          chatImageModal.classList.add('flex');
        }
      });
      messageBubble.appendChild(imageEl);
      if (content.text) {
        const textEl = document.createElement('p');
        textEl.className = 'text-sm mt-2';
        textEl.textContent = content.text;
        messageBubble.appendChild(textEl);
      }
    } else {
      const textEl = document.createElement('p');
      textEl.className = 'text-sm';
      textEl.textContent = content.text;
      messageBubble.appendChild(textEl);
    }
    messageContainer.appendChild(messageBubble);

    // Meta (hora + checkmarks)
    const metaDiv = document.createElement('div');
    metaDiv.className = `flex items-center mt-1 ${sender === 'user' ? 'justify-end' : 'justify-start'}`;

    let checkmarks = '';
    if (sender === 'user') {
      if (isReadByAdmin) {
        // ✅ Dos checkmarks verdes pegados
        checkmarks = `
          <span class="flex items-center">
            <svg class="w-3 h-3" fill="#10b981" viewBox="0 0 24 24">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
            </svg>
            <svg class="w-3 h-3 -ml-0.5" fill="#10b981" viewBox="0 0 24 24">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
            </svg>
          </span>`;
      } else {
        // Un check gris oscuro
        checkmarks = `
          <svg class="w-3 h-3" fill="#6b7280" viewBox="0 0 24 24">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
          </svg>`;
      }
    }

    metaDiv.innerHTML = `
      <div class="flex items-center gap-1">
        <p class="text-xs text-gray-500 dark:text-gray-400" style="font-size: 10px;">${timeString}</p>
        ${checkmarks}
      </div>
    `;

    messageContainer.appendChild(metaDiv);
    messageDiv.appendChild(messageContainer);
    chatMessagesDiv.appendChild(messageDiv);

    chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight;
  }

  function closeChatImageModal() {
    if (!chatImageModal) return;
    chatImageModal.classList.add('hidden');
    chatImageModal.classList.remove('flex');
    if (chatImageModalImg) {
      chatImageModalImg.src = '';
    }
  }

  
  // Función para agregar mensaje de seguridad sin timestamp
  function addSecurityMessageToChat(message) {
    if (!chatMessagesDiv) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'flex justify-start mb-2';
    
    const messageBubble = document.createElement('div');
    messageBubble.className = 'max-w-xs rounded-lg p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800';
    
    // Solo mostrar mensaje en la burbuja sin timestamp
    messageBubble.innerHTML = `<p class="text-sm text-red-700 dark:text-red-300">${message}</p>`;
    
    messageDiv.appendChild(messageBubble);
    chatMessagesDiv.appendChild(messageDiv);
    
    // Scroll al final
    chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight;
  }
  
  // Función para cargar mensajes
  async function loadChatMessages() {

    const apiBase = window.apiBase;

    if (!chatMessagesDiv) return;
    
    try {
      const token = localStorage.getItem('token');
      const customerId = await getCustomerId();
      
      if (!token || !customerId) {
        console.error('Token o customerId no encontrado');
        return;
      }
      
      const response = await fetch(`${apiBase}/api/chat/messages/${customerId}?adminId=${selectedAdminId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Error cargando mensajes');
      }
      
      const data = await response.json();
        
      // Usar la función actualizada para evitar duplicados
      updateChatMessages(data.data);
      
      // Marcar como leídos
      await markMessagesAsReadByClient(customerId);
      
    } catch (error) {
      console.error('Error cargando mensajes:', error);
    }
  }
  
  // Función para limpiar y agregar mensajes (evita duplicados)
  function updateChatMessages(messages) {
    if (!chatMessagesDiv) return;
    
    // Limpiar mensajes existentes
    chatMessagesDiv.innerHTML = '';
    
    // Agregar mensaje de bienvenida
    const welcomeMessage = selectedAdminId ? 
      `Hello! My name is ${adminDisplayName}, how can I help you today?` : 
      'Please select an agent to start the conversation.';
    addMessageToChat(welcomeMessage, 'admin');
    
    // Agregar mensajes desde la API (filtrar mensajes de seguridad)
    messages.forEach((msg) => {
      // Mostrar mensajes de seguridad del admin solo en el cliente
      if (msg.sender_role === 'admin' && msg.is_security_message === 1) {
        addSecurityMessageToChat(msg.body);
        return;
      }
      const sender = msg.sender_role === 'client' ? 'user' : 'admin';
      addMessageToChat(msg.body, sender, msg.created_at, msg.is_read_by_admin);
    });
  }
  
  // Hacer las funciones globales para que el botón flotante pueda acceder
  window.loadChatMessages = loadChatMessages;
  window.openChatModal = openChatModal;
  // Socket.io ya maneja las actualizaciones en tiempo real
  window.startChatPolling = () => {};
  window.stopChatPolling = () => {};
  
  // Inicializar Socket.io para el chat del cliente
  function initializeChatSocket() {
    // Verificar que Socket.io esté disponible
    if (typeof io === 'undefined') {
      console.error('Socket.io no está disponible');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      console.error('Token no encontrado para Socket.io');
      return;
    }

    socket = socketService.connect(token);
    
    // Verificar que el socket esté funcionando
    if (socket) {
      socket.on('connect', () => {
        // Verificar si el cliente se unió a su sala
        getCustomerId().then(customerId => {
          if (customerId) {
            // Cliente conectado correctamente
          }
        });
        refreshAdminOnlineStatus();
        if (chatModal && !chatModal.classList.contains('hidden')) {
          startAdminStatusPolling();
        }
      });
    }
    
    // Escuchar mensajes nuevos
    socketService.onNewMessage(async (messageData) => {
      const customerId = await getCustomerId();
      if (!customerId) {
        return;
      }

      if (parseInt(messageData.customer_id) === parseInt(customerId)) {
        const incomingAdminId = parseInt(messageData.admin_id);
        const chatVisible = chatModal && !chatModal.classList.contains('hidden') && !isMinimized;

        if (messageData.sender_role === 'admin' && (!chatVisible || !selectedAdminId || parseInt(selectedAdminId) !== incomingAdminId)) {
          incrementAdminUnread(incomingAdminId);
        }

        // Solo mostrar mensajes del admin seleccionado, no del propio cliente (evitar duplicados)
        if (messageData.sender_role === 'admin' && selectedAdminId && incomingAdminId === parseInt(selectedAdminId)) {
          addMessageToChat(messageData.body, 'admin', new Date(), false);
          updateAdminPresence(true); // Si el admin envía un mensaje, está online
          lastAdminActivity = Date.now(); // Registrar actividad del admin

          if (chatModal && !chatModal.classList.contains('hidden')) {
            await markMessagesAsReadByClient(customerId);
            // No llamar refreshAdminOnlineStatus() aquí para evitar cambiar el estado
          }
        }
      }
    });
    
    // Escuchar actualizaciones de notificaciones para actualizar check verdes
    socketService.onUpdateNotifications(() => {
      // Recargar mensajes para mostrar check verdes actualizados
      loadChatMessages();
      if (chatModal && !chatModal.classList.contains('hidden')) {
        refreshAdminOnlineStatus();
      }
    });
  }
  
  // Función para validar y sanitizar mensajes
  function validateAndSanitizeMessage(message) {
    // Patrones de SQL injection comunes
    const sqlInjectionPatterns = [
      /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute|script|javascript|vbscript|onload|onerror|onclick)\b)/i,
      /(['"`;]|--|\/\*|\*\/|xp_|sp_|@@|0x[0-9a-f]+)/i,
      /(\b(and|or)\s+\d+\s*=\s*\d+)/i,
      /(\b(and|or)\s+['"`]\w+['"`]\s*=\s*['"`]\w+['"`])/i,
      /(\b(union|select)\s+.*\bfrom\b)/i,
      /(\b(insert|update)\s+.*\binto\b)/i,
      /(\b(delete|drop)\s+.*\bfrom\b)/i,
      /(\b(create|alter)\s+.*\b(table|database|user)\b)/i
    ];
    
    // Patrones de XSS
    const xssPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /vbscript:/gi,
      /on\w+\s*=/gi,
      /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
      /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
      /<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi
    ];
    
    // Verificar SQL injection
    for (const pattern of sqlInjectionPatterns) {
      if (pattern.test(message)) {
        return { isValid: false, reason: 'sql_injection' };
      }
    }
    
    // Verificar XSS
    for (const pattern of xssPatterns) {
      if (pattern.test(message)) {
        return { isValid: false, reason: 'xss' };
      }
    }
    
    // Verificar longitud máxima
    if (message.length > 1000) {
      return { isValid: false, reason: 'too_long' };
    }
    
    // Verificar caracteres especiales peligrosos
    const dangerousChars = /[<>{}[\]\\]/g;
    if (dangerousChars.test(message)) {
      return { isValid: false, reason: 'dangerous_chars' };
    }
    
    // Sanitizar el mensaje (escapar HTML)
    const sanitizedMessage = message
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
    
    return { isValid: true, message: sanitizedMessage };
  }
  
  // Función para mostrar advertencia de seguridad
  async function showSecurityWarning(reason) {

    const apiBase = window.apiBase;

    let warningMessage = '';
    
    switch (reason) {
      case 'sql_injection':
        warningMessage = '⚠️ ¡Cuidado! Tu mensaje contiene patrones sospechosos. Por favor, evita usar comandos de base de datos o caracteres especiales.';
        break;
      case 'xss':
        warningMessage = '⚠️ ¡Cuidado! Tu mensaje contiene código potencialmente peligroso. Por favor, escribe solo texto normal.';
        break;
      case 'too_long':
        warningMessage = '⚠️ Tu mensaje es demasiado largo. Por favor, acorta tu mensaje a menos de 1000 caracteres.';
        break;
      case 'dangerous_chars':
        warningMessage = '⚠️ Tu mensaje contiene caracteres especiales no permitidos. Por favor, usa solo texto normal.';
        break;
      default:
        warningMessage = '⚠️ ¡Cuidado con lo que escribes en el chat! Tu mensaje contiene contenido no permitido.';
    }
    
    // Mostrar mensaje de advertencia en el chat sin timestamp
    addSecurityMessageToChat(warningMessage);
    
    // Enviar mensaje de advertencia a la BD con rol admin
    try {
      const token = localStorage.getItem('token');
      const customerId = await getCustomerId();
      
      if (token && customerId) {
        await fetch(`${apiBase}/api/chat/send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            customer_id: customerId,
            message: warningMessage,
            sender_role: 'admin',
            is_security_message: true
          })
        });
      }
    } catch (error) {
      console.error('Error enviando mensaje de seguridad:', error);
    }
  }
  
  // Función para abrir el modal
  function openChatModal() {
    if (chatModal && chatInput) {
      chatModal.classList.remove('hidden');
      
      if (typeof window.clearChatNotification === 'function') {
        window.clearChatNotification();
      }
      if (typeof window.notifyClientChatOpened === 'function') {
        window.notifyClientChatOpened();
      }

      // Resetear estado y mostrar selección de administradores
      selectedAdminId = null;
      adminSelection.classList.remove('hidden');
      chatMessagesDiv.classList.add('hidden');
      chatInputArea.classList.add('hidden');
      
      // Cargar lista de administradores
      loadAdminList();

      stopAdminStatusPolling();
      refreshAdminOnlineStatus();
      startAdminStatusPolling();

      // Inicializar Socket.io si no está inicializado
      if (!socket) {
        initializeChatSocket();
      }
    }
  }
  
  // Event listeners
  closeChatBtn?.addEventListener('click', closeChatModal);

  function setChatMinimized(shouldMinimize) {
    if (!chatPanel) return;
    isMinimized = shouldMinimize;
    chatPanel.classList.toggle('chat-minimized', shouldMinimize);
    if (minimizeChatBtn) {
      const minimizeIcon = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15h14"/></svg>`;
      const restoreIcon = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 8h12M6 16h12"/></svg>`;
      minimizeChatBtn.setAttribute('aria-pressed', shouldMinimize ? 'true' : 'false');
      minimizeChatBtn.innerHTML = shouldMinimize ? restoreIcon : minimizeIcon;
    }
  }

  minimizeChatBtn?.addEventListener('click', (event) => {
    event.stopPropagation();
    setChatMinimized(!isMinimized);
  });

  chatHeader?.addEventListener('click', () => {
    if (isMinimized) {
      setChatMinimized(false);
    }
  });
  
  sendMessageBtn?.addEventListener('click', sendMessage);

  chatImageBtn?.addEventListener('click', () => {
    chatImageInput?.click();
  });
  chatImageInput?.addEventListener('change', async () => {
    updateSendButtonState();
    if (hasSelectedImage() && chatInput && !chatInput.value.trim()) {
      await sendMessage();
    }
  });
  
  chatInput?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  });
  
  chatInput?.addEventListener('input', () => {
    updateSendButtonState();
  });
  
  // Cerrar con Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && chatModal && !chatModal.classList.contains('hidden')) {
      closeChatModal();
    }
    if (e.key === 'Escape' && chatImageModal && !chatImageModal.classList.contains('hidden')) {
      closeChatImageModal();
    }
  });

  chatImageModalClose?.addEventListener('click', closeChatImageModal);
  chatImageModal?.addEventListener('click', (e) => {
    if (e.target === chatImageModal) {
      closeChatImageModal();
    }
  });
  
  // Inicializar chat al cargar la página
  document.addEventListener('DOMContentLoaded', () => {
    refreshAdminOnlineStatus();
    initializeChatSocket();
    setChatMinimized(false);
  });

  // Event listeners for emojis
  emojiBtn?.addEventListener('click', toggleEmojiPicker);

  // Prevenir scroll de la página cuando se hace scroll en el chat
  if (chatMessagesDiv) {
    chatMessagesDiv.addEventListener('wheel', (e) => {
      const { scrollTop, scrollHeight, clientHeight } = chatMessagesDiv;
      const isAtTop = scrollTop === 0;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight;
      
      // Si está en el tope y hace scroll hacia arriba, o en el fondo y hace scroll hacia abajo
      if ((isAtTop && e.deltaY < 0) || (isAtBottom && e.deltaY > 0)) {
        e.preventDefault();
      }
    }, { passive: false });
  }

}
