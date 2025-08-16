// =============================================================================
// DOCUMENT CENTER - LÓGICA PRINCIPAL
// =============================================================================

// ▸ Variables globales
let currentOrderId = null;
let documents = [];
let filteredDocuments = [];
let currentPage = 1;
const itemsPerPage = 4;

// ▸ Elementos del DOM
const ordersGrid = document.getElementById('orders-grid');
const documentsStats = document.getElementById('documents-stats');
const documentsSection = document.getElementById('documents-section');
const documentsContainer = document.getElementById('documents-container');
const searchInput = document.querySelector('input[placeholder="Search documents..."]');
const typeFilter = document.querySelector('select');

// Verificar que los elementos críticos existan
console.log('🔍 DOM Elements check:');
console.log('ordersGrid:', ordersGrid);
console.log('documentsStats:', documentsStats);
console.log('documentsSection:', documentsSection);
console.log('documentsContainer:', documentsContainer);

// ▸ Configuración de colores para estados
const statusColors = {
  'Unread': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  'Viewed': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  'Reviewed': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
};

// =============================================================================
// FUNCIONES PRINCIPALES
// =============================================================================

/**
 * Inicializa la aplicación
 */
async function init() {

  try {
    // Mostrar loading state
    showLoadingState();

    // Cargar órdenes desde la API si no están disponibles
    if (!window.orders || window.orders.length === 0) {
      await loadOrdersFromAPI();
    }
    
    
    // Ocultar loading y mostrar contenido
    hideLoadingState();
    
    // Renderizar órdenes
    renderOrders();
    
    // Configurar event listeners
    setupEventListeners();
    
    // Seleccionar automáticamente la primera orden si existe
    if (window.orders && window.orders.length > 0) {
      selectOrder(window.orders[0].id);
    }
  } catch (error) {
    hideLoadingState();
    showErrorState('Error cargando órdenes. Por favor, recarga la página.');
  }
}

/**
 * Muestra el estado de loading
 */
function showLoadingState() {
  const loadingState = document.getElementById('loading-state');
  const ordersSection = document.getElementById('orders-section');
  
  if (loadingState) loadingState.classList.remove('hidden');
  if (ordersSection) ordersSection.classList.add('hidden');
}

/**
 * Oculta el estado de loading
 */
function hideLoadingState() {
  const loadingState = document.getElementById('loading-state');
  const ordersSection = document.getElementById('orders-section');
  
  if (loadingState) loadingState.classList.add('hidden');
  if (ordersSection) ordersSection.classList.remove('hidden');
}

/**
 * Muestra estado de error
 */
function showErrorState(message) {
  const loadingState = document.getElementById('loading-state');
  if (loadingState) {
    loadingState.innerHTML = `
      <div class="inline-flex items-center justify-center w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full mb-4">
        <svg class="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">Error</h3>
      <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">${message}</p>
      <button onclick="location.reload()" class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
        Recargar página
      </button>
    `;
  }
}

/**
 * Carga órdenes desde la API
 */
async function loadOrdersFromAPI() {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('No hay token de autenticación');
    }

    const response = await fetch(`${window.apiBase}/api/orders/client/dashboard`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    window.orders = await response.json();
    console.log('✅ Órdenes cargadas desde API:', window.orders.length);
  } catch (error) {
    console.error('❌ Error cargando órdenes desde API:', error);
    throw error;
  }
}



/**
 * Renderiza las órdenes en la grilla
 */
function renderOrders() {
  if (!ordersGrid || !window.orders) return;
  
  ordersGrid.innerHTML = '';
  
  window.orders.forEach(order => {
    const orderCard = document.createElement('div');
    orderCard.className = 'bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 cursor-pointer transition-all duration-200 hover:shadow-md';
    orderCard.dataset.orderId = order.id.toString();
    
    const statusColors = {
      'In Progress': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      'Completed': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      'Pending': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
    };
    
    const priorityColors = {
      'high': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      'medium': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      'low': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
    };
    
    orderCard.innerHTML = `
      <div class="flex items-start justify-between mb-3">
        <div>
          <h4 class="font-semibold text-gray-900 dark:text-white">${order.orderNumber}</h4>
          <p class="text-sm text-gray-600 dark:text-gray-400">${order.clientName}</p>
        </div>
        <div class="flex space-x-2">
          <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusColors[order.status]}">
            ${order.status}
          </span>
          <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${priorityColors[order.priority]}">
            ${order.priority}
          </span>
        </div>
      </div>
      <div class="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
        <span>${order.documents} documents</span>
        <span>Updated ${formatDate(order.lastUpdated)}</span>
      </div>
    `;
    
    orderCard.addEventListener('click', () => selectOrder(order.id));
    ordersGrid.appendChild(orderCard);
  });
}

/**
 * Selecciona una orden y muestra sus documentos
 */
async function selectOrder(orderId) {
  console.log('📋 Selecting order:', orderId);
  
  currentOrderId = orderId;
  
  // Mostrar loading en la sección de documentos
  showDocumentsLoading();
  
  try {
    // Cargar documentos desde la API
    await loadOrderDocumentsFromAPI(orderId);
  } catch (error) {
    console.error('❌ Error cargando documentos:', error);
    // Fallback a datos estáticos si hay error
    documents = window.docsByOrder[orderId] || [];
  }
  
  filteredDocuments = [...documents];
  currentPage = 1;
  
  console.log('📄 Documents for order', orderId, ':', documents);
  console.log('📄 Filtered documents:', filteredDocuments);
  
  // Ocultar loading y actualizar UI
  hideDocumentsLoading();
  renderDocuments(filteredDocuments, currentPage);
  updatePagination();
  updateStatistics();
  
  // Resaltar orden seleccionada
  const orderCards = document.querySelectorAll('[data-order-id]');
  orderCards.forEach(card => {
    card.classList.remove('ring-2', 'ring-blue-500', 'border-blue-500');
  });
  
  const selectedCard = document.querySelector(`[data-order-id="${orderId}"]`);
  if (selectedCard) {
    selectedCard.classList.add('ring-2', 'ring-blue-500', 'border-blue-500');
  }
  
  // Mostrar notificación
  const order = window.orders.find(o => o.id === orderId);
  if (order) {
    showNotification(`Selected order: ${order.orderNumber} - ${order.clientName}`);
  }
}

/**
 * Muestra loading en la sección de documentos
 */
function showDocumentsLoading() {
  const documentsContainer = document.getElementById('documents-container');
  if (documentsContainer) {
    documentsContainer.innerHTML = `
      <div class="text-center py-12">
        <div class="inline-flex items-center justify-center w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full mb-3">
          <svg class="w-4 h-4 text-blue-600 dark:text-blue-400 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </div>
        <p class="text-sm text-gray-600 dark:text-gray-400">Cargando documentos...</p>
      </div>
    `;
  }
}

/**
 * Oculta loading en la sección de documentos
 */
function hideDocumentsLoading() {
  // El loading se oculta automáticamente cuando se renderizan los documentos
}

/**
 * Carga documentos de una orden desde la API
 */
async function loadOrderDocumentsFromAPI(orderId) {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('No hay token de autenticación');
    }

    const response = await fetch(`${window.apiBase}/api/orders/client/${orderId}/documents`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Convertir documentos al formato esperado por el frontend
    documents = data.documents.map(doc => ({
      id: doc.id,
      name: doc.filename,
      type: doc.filetype?.toLowerCase() || 'pdf',
      size: doc.filesize || 0,
      status: doc.status || 'Unread',
      statusColor: doc.statusColor || 'gray',
      created: doc.created,
      updated: doc.updated,
      url: doc.filepath || '#'
    }));
    
    console.log('✅ Documentos cargados desde API:', documents.length);
  } catch (error) {
    console.error('❌ Error cargando documentos desde API:', error);
    throw error;
  }
}

/**
 * Renderiza los documentos
 */
function renderDocuments(docs, page) {
  console.log('🎨 Rendering documents:', docs.length, 'docs, page:', page);
  
  if (!documentsContainer) {
    console.error('❌ documentsContainer not found');
    return;
  }
  
  const startIndex = (page - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const pageDocuments = docs.slice(startIndex, endIndex);

  console.log('📄 Page documents:', pageDocuments.length, 'docs');

  documentsContainer.innerHTML = '';

  pageDocuments.forEach(doc => {
    const typeIcons = {
      'pdf': `<svg class="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
              </svg>`,
      'doc': `<svg class="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>`,
      'img': `<svg class="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
              </svg>`,
      'xlsx': `<svg class="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9h8M8 12h8M8 15h8M8 18h8"/>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 9v9M14 9v9"/>
              </svg>`,
      'ppt': `<svg class="w-6 h-6 text-red-500 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>`,
      'zip': `<svg class="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
              </svg>`,
      'vid': `<svg class="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>
              </svg>`
    };

    const iconBgColors = {
      'pdf': 'bg-red-100 dark:bg-red-900/30',
      'doc': 'bg-blue-100 dark:bg-blue-900/30',
      'img': 'bg-green-100 dark:bg-green-900/30',
      'xlsx': 'bg-green-100 dark:bg-green-900/30',
      'ppt': 'bg-red-100 dark:bg-red-900/30',
      'zip': 'bg-purple-100 dark:bg-purple-900/30',
      'vid': 'bg-red-100 dark:bg-red-900/30'
    };

    const documentDiv = document.createElement('div');
    documentDiv.className = 'p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-200';
    documentDiv.innerHTML = `
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-4">
          <div class="flex-shrink-0">
            <div class="w-12 h-12 ${iconBgColors[doc.type] || 'bg-gray-100 dark:bg-gray-900/30'} rounded-lg flex items-center justify-center">
              ${typeIcons[doc.type] || typeIcons['pdf']}
            </div>
          </div>
          <div>
            <h3 class="text-sm font-medium text-gray-900 dark:text-white">${doc.name || 'Unnamed Document'}</h3>
            <p class="text-sm text-gray-500 dark:text-gray-400">${doc.category || 'Uncategorized'} • ${doc.size || 'Unknown size'} • Updated ${formatDate(doc.updated)}</p>
          </div>
        </div>
        <div class="flex items-center space-x-3">
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[doc.status]}">
            ${doc.status}
          </span>
          <button class="download-btn text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors duration-200" data-doc-id="${doc.id}" title="Download document">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
          </button>
          <button class="view-btn text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors duration-200" data-doc-id="${doc.id}" title="View document">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
            </svg>
          </button>
          <button class="email-btn text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200" data-doc-id="${doc.id}" title="Send document by email">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
            </svg>
          </button>
          ${doc.status !== 'Reviewed' ? `
          <button class="review-btn text-gray-400 hover:text-green-600 dark:hover:text-green-400 transition-colors duration-200" data-doc-id="${doc.id}" title="Mark as reviewed">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </button>
          ` : `
          <button class="unreview-btn text-green-400 hover:text-red-600 dark:hover:text-red-400 transition-colors duration-200" data-doc-id="${doc.id}" title="Mark as not reviewed">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
          `}
        </div>
      </div>
    `;

    // Agregar event listeners a los botones
    const downloadBtn = documentDiv.querySelector('.download-btn');
    const viewBtn = documentDiv.querySelector('.view-btn');
    const emailBtn = documentDiv.querySelector('.email-btn');
    const reviewBtn = documentDiv.querySelector('.review-btn');
    const unreviewBtn = documentDiv.querySelector('.unreview-btn');

    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => downloadDocument(doc.id));
    }
    if (viewBtn) {
      viewBtn.addEventListener('click', () => viewDocument(doc.id));
    }
    if (emailBtn) {
      emailBtn.addEventListener('click', () => openEmailModal(doc.id));
    }
    if (reviewBtn) {
      reviewBtn.addEventListener('click', () => markAsReviewed(doc.id));
    }
    if (unreviewBtn) {
      unreviewBtn.addEventListener('click', () => markAsNotReviewed(doc.id));
    }

    documentsContainer.appendChild(documentDiv);
  });
}

/**
 * Actualiza las estadísticas
 */
function updateStatistics() {
  const totalDocs = filteredDocuments.length;
  
  // Calcular documentos recientes (últimos 7 días)
  const recentDocs = filteredDocuments.filter(doc => {
    const date = new Date(doc.updated);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    return diffInHours < 168; // 7 días
  }).length;
  
  // Calcular documentos nuevos hoy
  const todayDocs = filteredDocuments.filter(doc => {
    const date = new Date(doc.updated);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    return diffInHours < 24; // Hoy
  }).length;
  
  // Calcular documentos no leídos
  const unreadDocs = filteredDocuments.filter(doc => 
    doc.status === 'Unread'
  ).length;
  
  // Calcular documentos revisados
  const reviewedDocs = filteredDocuments.filter(doc => 
    doc.status === 'Reviewed'
  ).length;

  // Calcular progreso de revisión
  const reviewProgress = totalDocs > 0 ? (reviewedDocs / totalDocs) * 100 : 0;

  // Actualizar elementos principales
  const totalDocsElement = document.getElementById('total-docs');
  const recentDocsElement = document.getElementById('recent-docs');
  const pendingDocsElement = document.getElementById('pending-docs');
  
  if (totalDocsElement) totalDocsElement.textContent = totalDocs.toString();
  if (recentDocsElement) recentDocsElement.textContent = recentDocs.toString();
  if (pendingDocsElement) pendingDocsElement.textContent = unreadDocs.toString();
  
  // Actualizar información adicional
  const pendingInfo = document.getElementById('pending-info');
  if (pendingInfo) {
    if (unreadDocs === 0) {
      pendingInfo.textContent = 'All read';
    } else if (unreadDocs === 1) {
      pendingInfo.textContent = '1 remaining';
    } else {
      pendingInfo.textContent = `${unreadDocs} remaining`;
    }
  }
  
  const recentInfo = document.getElementById('recent-info');
  if (recentInfo) {
    if (todayDocs === 0) {
      recentInfo.textContent = 'No new today';
    } else if (todayDocs === 1) {
      recentInfo.textContent = '1 new today';
    } else {
      recentInfo.textContent = `${todayDocs} new today`;
    }
  }
  
  // Actualizar elemento de documentos revisados
  const reviewedDocsElement = document.getElementById('reviewed-docs');
  if (reviewedDocsElement) {
    reviewedDocsElement.textContent = `${reviewedDocs}/${totalDocs}`;
  }
  
  // Actualizar barra de progreso
  const progressBar = document.getElementById('reviewed-progress');
  if (progressBar) {
    progressBar.style.width = `${reviewProgress}%`;
    
    // Cambiar color de la barra según el progreso
    if (reviewProgress >= 80) {
      progressBar.className = 'bg-green-600 h-2 rounded-full transition-all duration-300';
    } else if (reviewProgress >= 50) {
      progressBar.className = 'bg-yellow-600 h-2 rounded-full transition-all duration-300';
    } else {
      progressBar.className = 'bg-purple-600 h-2 rounded-full transition-all duration-300';
    }
  }
}

/**
 * Actualiza la paginación
 */
function updatePagination() {
  const totalPages = Math.ceil(filteredDocuments.length / itemsPerPage);
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, filteredDocuments.length);

  const paginationInfo = document.getElementById('pagination-info');
  if (paginationInfo) {
    paginationInfo.textContent = `Showing ${startItem}-${endItem} of ${filteredDocuments.length} documents`;
  }

  // Generar botones de página dinámicamente
  const pageNumbersContainer = document.getElementById('page-numbers');
  if (pageNumbersContainer) {
    pageNumbersContainer.innerHTML = '';

    for (let i = 1; i <= totalPages; i++) {
      const pageBtn = document.createElement('button');
      pageBtn.className = `page-btn px-3 py-2 text-sm font-medium border rounded-md transition-colors duration-200 ${
        i === currentPage 
          ? 'text-white bg-blue-600 border-transparent' 
          : 'text-gray-500 bg-white border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
      }`;
      pageBtn.textContent = i.toString();
      pageBtn.dataset.page = i.toString();
      
      pageBtn.addEventListener('click', () => {
        currentPage = i;
        renderDocuments(filteredDocuments, currentPage);
        updatePagination();
      });
      
      pageNumbersContainer.appendChild(pageBtn);
    }
  }

  // Actualizar botones Previous/Next
  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');
  
  if (prevBtn) prevBtn.disabled = currentPage === 1;
  if (nextBtn) nextBtn.disabled = currentPage === totalPages;
}

/**
 * Filtra documentos
 */
function filterDocuments() {
  const searchTerm = searchInput?.value.toLowerCase() || '';
  const selectedType = typeFilter?.value || '';

  filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.name.toLowerCase().includes(searchTerm) || 
                        doc.category.toLowerCase().includes(searchTerm);
    const matchesType = !selectedType || doc.type === selectedType;
    return matchesSearch && matchesType;
  });

  currentPage = 1;
  renderDocuments(filteredDocuments, currentPage);
  updatePagination();
  updateStatistics();
}

// =============================================================================
// FUNCIONES DE ACCIONES DE DOCUMENTOS
// =============================================================================

function downloadDocument(docId) {
  const originalDoc = documents.find(d => d.id === docId);
  if (originalDoc) {
    console.log(`📥 Downloading ${originalDoc.name}`);
    showNotification(`Downloading ${originalDoc.name}`);
    
    // Marcar como visto si no lo está
    if (originalDoc.status === 'Unread') {
      originalDoc.status = 'Viewed';
      
      const filteredDoc = filteredDocuments.find(d => d.id === docId);
      if (filteredDoc) {
        filteredDoc.status = 'Viewed';
      }
      
      renderDocuments(filteredDocuments, currentPage);
      updateStatistics();
    }
  }
}

function viewDocument(docId) {
  const originalDoc = documents.find(d => d.id === docId);
  if (originalDoc) {
    console.log(`👁️ Viewing ${originalDoc.name}`);
    showNotification(`Opening ${originalDoc.name} for viewing`);
    
    // Marcar como visto si no lo está
    if (originalDoc.status === 'Unread') {
      originalDoc.status = 'Viewed';
      
      const filteredDoc = filteredDocuments.find(d => d.id === docId);
      if (filteredDoc) {
        filteredDoc.status = 'Viewed';
      }
      
      renderDocuments(filteredDocuments, currentPage);
      updateStatistics();
    }
  }
}

function markAsReviewed(docId) {
  console.log('🔍 markAsReviewed called with docId:', docId);
  const originalDoc = documents.find(d => d.id === docId);
  
  if (originalDoc && originalDoc.status !== 'Reviewed') {
    console.log('✅ Document found, marking as reviewed:', originalDoc.name);
    originalDoc.status = 'Reviewed';
    
    const filteredDoc = filteredDocuments.find(d => d.id === docId);
    if (filteredDoc) {
      filteredDoc.status = 'Reviewed';
    }
    
    renderDocuments(filteredDocuments, currentPage);
    updateStatistics();
    console.log('📢 Showing notification for:', originalDoc.name);
    
    // Test directo de notificación
    showNotification(`${originalDoc.name} marked as reviewed`, 'success');
  } else {
    console.log('❌ Document not found or already reviewed');
  }
}

function markAsNotReviewed(docId) {
  const originalDoc = documents.find(d => d.id === docId);
  
  if (originalDoc && originalDoc.status === 'Reviewed') {
    originalDoc.status = 'Viewed';
    
    const filteredDoc = filteredDocuments.find(d => d.id === docId);
    if (filteredDoc) {
      filteredDoc.status = 'Viewed';
    }
    
    renderDocuments(filteredDocuments, currentPage);
    updateStatistics();
    showNotification(`${originalDoc.name} marked as not reviewed`, 'success');
  }
}

function sendDocumentByEmail(docId) {
  const originalDoc = documents.find(d => d.id === docId);
  if (originalDoc) {
    console.log(`📧 Opening email modal for ${originalDoc.name}`);
    // Aquí se abriría el modal de email
    showNotification(`Email modal opened for ${originalDoc.name}`);
  }
}

// =============================================================================
// FUNCIONES UTILITARIAS
// =============================================================================

function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
  
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  if (diffInHours < 24) {
    return date.toLocaleString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: userTimezone
    }) + ` today`;
  } else if (diffInHours < 48) {
    return date.toLocaleString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: userTimezone
    }) + ` yesterday`;
  } else if (diffInHours < 168) {
    return date.toLocaleString('en-US', {
      weekday: 'long',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: userTimezone
    });
  } else {
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: userTimezone
    });
  }
}

// Importar showNotification desde utils.js
import { showNotification as globalShowNotification } from './utils.js';

function showNotification(message, type = 'success') {
  // Verificar si el modal está abierto
  const modal = document.getElementById('email-modal');
  const isModalOpen = modal && !modal.classList.contains('hidden');
  
  if (isModalOpen) {
    // Si el modal está abierto, mostrar la notificación dentro del modal
    showModalNotification(message, type);
  } else {
    // Si el modal está cerrado, mostrar la notificación global
    globalShowNotification(message, type);
  }
}

function showModalNotification(message, type = 'success') {
  const modal = document.getElementById('email-modal');
  if (!modal) return;
  
  const bgColor = type === 'success' ? 'bg-green-500' : 'bg-red-500';
  const icon = type === 'success' ? 
    '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>' :
    '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>';
  
  const notification = document.createElement('div');
  notification.className = `absolute top-12 right-4 ${bgColor} text-white px-6 py-4 rounded-xl shadow-2xl transform transition-all duration-300 translate-x-full z-[99999999]`;
  notification.innerHTML = `
    <div class="flex items-center space-x-3">
      <div class="flex-shrink-0">
        ${icon}
      </div>
      <div class="flex-1">
        <p class="text-sm font-medium">${message}</p>
      </div>
      <button class="flex-shrink-0 text-white/80 hover:text-white transition-colors duration-200">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>
  `;
  
  // Agregar la notificación al modal
  modal.appendChild(notification);
  
  // Animar entrada
  setTimeout(() => {
    notification.classList.remove('translate-x-full');
  }, 100);
  
  // Event listener para cerrar manualmente
  const closeBtn = notification.querySelector('button');
  closeBtn?.addEventListener('click', () => {
    notification.classList.add('translate-x-full');
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  });
  
  // Remover después de 4 segundos
  setTimeout(() => {
    if (notification.parentNode) {
      notification.classList.add('translate-x-full');
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }
  }, 4000);
}



function setupEventListeners() {
  // Event listeners para filtros
  if (searchInput) {
    searchInput.addEventListener('input', filterDocuments);
  }
  
  if (typeFilter) {
    typeFilter.addEventListener('change', filterDocuments);
  }

  // Event listeners para paginación
  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');
  
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        renderDocuments(filteredDocuments, currentPage);
        updatePagination();
      }
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      const totalPages = Math.ceil(filteredDocuments.length / itemsPerPage);
      if (currentPage < totalPages) {
        currentPage++;
        renderDocuments(filteredDocuments, currentPage);
        updatePagination();
      }
    });
  }
}

// =============================================================================
// FUNCIONES DEL MODAL DE EMAIL
// =============================================================================

/**
 * Abre el modal de email
 */
function openEmailModal(docId) {
  console.log('📧 Opening email modal for document:', docId);
  
  const modal = document.getElementById('email-modal');
  const modalContent = modal?.querySelector('.relative.mx-auto');
  
  if (!modal || !modalContent) {
    console.error('Modal elements not found');
    return;
  }
  
  // Guardar el ID del documento en el modal
  modal.dataset.docId = docId.toString();
  
  // Obtener el documento
  const doc = documents.find(d => d.id === docId);
  if (!doc) {
    console.error('Document not found:', docId);
    return;
  }
  
  // Actualizar los detalles del documento en el modal
  const documentDetails = document.getElementById('document-details');
  if (documentDetails) {
    documentDetails.innerHTML = `
      <div class="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
        <div class="flex items-center space-x-3 mb-3">
          <div class="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            <svg class="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
          </div>
          <div>
            <h5 class="font-semibold text-gray-900 dark:text-white">${doc.name}</h5>
            <p class="text-sm text-gray-500 dark:text-gray-400">${doc.category}</p>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3 mb-3">
          <div class="bg-gray-50 dark:bg-gray-700 p-2 rounded text-center">
            <div class="text-xs text-gray-500 dark:text-gray-400">Size</div>
            <div class="font-medium text-gray-900 dark:text-white">${doc.size}</div>
          </div>
          <div class="bg-gray-50 dark:bg-gray-700 p-2 rounded text-center">
            <div class="text-xs text-gray-500 dark:text-gray-400">Type</div>
            <div class="font-medium text-gray-900 dark:text-white">${doc.type.toUpperCase()}</div>
          </div>
        </div>
        <div class="text-xs text-gray-500 dark:text-gray-400">
          Last Updated: ${formatDate(doc.updated)}
        </div>
        <div class="mt-2">
          <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusColors[doc.status]}">
            ${doc.status}
          </span>
        </div>
      </div>
    `;
  }
  
  // Pre-llenar campos de contacto si están disponibles
  const contactName = document.getElementById('contact-name');
  const contactEmail = document.getElementById('contact-email');
  const issueDescription = document.getElementById('issue-description');
  
  // Intentar obtener datos del usuario actual (simulado)
  if (contactName && contactEmail) {
    // En un caso real, estos datos vendrían del backend
    contactName.value = localStorage.getItem('userName') || '';
    contactEmail.value = localStorage.getItem('userEmail') || '';
  }
  
  // Configurar event listeners de validación
  setupValidationEventListeners();
  
  // Pre-llenar descripción con template
  if (issueDescription) {
    const templateText = `I have reviewed the document "${doc.name}" and found the following issue:

PROBLEM DESCRIPTION:
[Please describe the specific problem you encountered]

LOCATION IN DOCUMENT:
[If applicable, mention page numbers, sections, or specific areas]

IMPACT:
[How does this issue affect the document or its users?]

SUGGESTED SOLUTION:
[If you have any suggestions for fixing this issue]

ADDITIONAL CONTEXT:
[Any other relevant information that might help resolve this issue]`;

    issueDescription.value = templateText;
  }
  
  // Mostrar modal con animación suave
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  
  // Animar entrada con delay mínimo para evitar parpadeo
  requestAnimationFrame(() => {
    modalContent.classList.remove('scale-95', 'opacity-0', 'translate-y-4');
    modalContent.classList.add('scale-100', 'opacity-100', 'translate-y-0');
  });
}

/**
 * Cierra el modal de email
 */
function closeEmailModal() {
  console.log('📧 Closing email modal');
  
  const modal = document.getElementById('email-modal');
  const modalContent = modal?.querySelector('.relative.mx-auto');
  
  if (!modal || !modalContent) return;
  
  // Limpiar archivos seleccionados
  selectedFiles = [];
  selectedExistingFiles = [];
  const selectedFilesDiv = document.getElementById('selected-files');
  if (selectedFilesDiv) {
    selectedFilesDiv.classList.add('hidden');
  }
  
  // Limpiar input de archivos
  const fileInput = document.getElementById('file-upload');
  if (fileInput) {
    fileInput.value = '';
  }
  
  // Animar salida suave
  modalContent.classList.remove('scale-100', 'opacity-100', 'translate-y-0');
  modalContent.classList.add('scale-95', 'opacity-0', 'translate-y-4');
  
  // Ocultar después de la animación
  setTimeout(() => {
    modal.classList.add('hidden');
  }, 200);
}

/**
 * Envía el email desde el modal
 */
function sendEmailFromModal() {
  console.log('📧 Sending email from modal');
  
  const modal = document.getElementById('email-modal');
  const docId = parseInt(modal?.dataset.docId || '0');
  const contactName = document.getElementById('contact-name');
  const contactEmail = document.getElementById('contact-email');
  const contactPhone = document.getElementById('contact-phone');
  const issueDescription = document.getElementById('issue-description');
  const issueType = document.querySelector('input[name="issue-type"]:checked');
  const priority = document.querySelector('input[name="priority"]:checked');
  
  // Limpiar errores previos
  clearValidationErrors();
  
  // Array para almacenar errores
  const errors = [];
  
  // Validar campos requeridos
  if (!contactName?.value.trim()) {
    errors.push('contact-name');
    showFieldError(contactName, 'Name is required');
  }
  
  if (!contactEmail?.value.trim()) {
    errors.push('contact-email');
    showFieldError(contactEmail, 'Email is required');
  } else if (!isValidEmail(contactEmail.value.trim())) {
    errors.push('contact-email');
    showFieldError(contactEmail, 'Please enter a valid email address');
  }
  
  if (!issueDescription?.value.trim()) {
    errors.push('issue-description');
    showFieldError(issueDescription, 'Description is required');
  } else if (issueDescription.value.trim().length < 20) {
    errors.push('issue-description');
    showFieldError(issueDescription, 'Description must be at least 20 characters');
  }
  
  if (!issueType) {
    errors.push('issue-type');
    showSectionError('issue-type-section', 'Please select an issue type');
  }
  
  if (!priority) {
    errors.push('priority');
    showSectionError('priority-section', 'Please select a priority level');
  }
  
  // Si hay errores, mostrar notificación y detener
  if (errors.length > 0) {
    showNotification('Please fill in all required fields correctly', 'error');
    return;
  }
  
  // Obtener tipo de problema y prioridad seleccionados
  const issueTypeValue = issueType?.value || 'other';
  const priorityValue = priority?.value || 'medium';
  
  const originalDoc = documents.find(d => d.id === docId);
  if (originalDoc) {
    // Crear mensaje profesional
    const subject = `[ISSUE REPORT] ${originalDoc.name} - ${issueTypeValue.toUpperCase()}`;
    
    let body = `Hello,

I'm reporting an issue with the document "${originalDoc.name}".

REPORT DETAILS:
- Issue Type: ${issueTypeValue}
- Priority: ${priorityValue}
- Reporter: ${contactName.value}
- Contact Email: ${contactEmail.value}
${contactPhone?.value ? `- Contact Phone: ${contactPhone.value}` : ''}

DOCUMENT INFORMATION:
- Name: ${originalDoc.name}
- Category: ${originalDoc.category}
- Size: ${originalDoc.size}
- Type: ${originalDoc.type.toUpperCase()}
- Status: ${originalDoc.status}
- Last Updated: ${formatDate(originalDoc.updated)}

DESCRIPTION:
${issueDescription.value}`;

    // Agregar información sobre archivos adjuntos si los hay
    const totalAttachments = selectedFiles.length + selectedExistingFiles.length;
    if (totalAttachments > 0) {
      body += `\n\nADDITIONAL FILES ATTACHED:`;
      
      if (selectedFiles.length > 0) {
        body += `\n\nNew Uploads:`;
        selectedFiles.forEach(file => {
          body += `\n- ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;
        });
      }
      
      if (selectedExistingFiles.length > 0) {
        body += `\n\nExisting Files:`;
        selectedExistingFiles.forEach(doc => {
          body += `\n- ${doc.name} (${doc.size}) - ${doc.category}`;
        });
      }
      
      body += `\n\nNote: Please check the attached files for additional context or examples related to this issue.`;
    }

    body += `\n\nPlease review this document and address the reported issue.

Best regards,
${contactName.value}`;

    // Crear URL de mailto
    const mailtoUrl = `mailto:admin@gelymar.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
    // Abrir cliente de email del usuario
    window.open(mailtoUrl, '_blank');
    
    // Guardar datos de contacto para futuras sesiones
    localStorage.setItem('userName', contactName.value);
    localStorage.setItem('userEmail', contactEmail.value);
    
    // Cerrar el modal con animación
    closeEmailModal();
    
    // Mostrar notificación
    showNotification(`Issue report submitted for ${originalDoc.name}`);
    
    console.log('Issue report sent for:', originalDoc.name);
  }
}

// Variables para archivos adjuntos
let selectedFiles = [];
let selectedExistingFiles = [];

/**
 * Valida si un email es válido
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Muestra error en un campo específico
 */
function showFieldError(field, message) {
  if (!field) return;
  
  // Agregar clases de error
  field.classList.add('border-red-500', 'ring-red-500', 'ring-2');
  
  // Crear o actualizar mensaje de error
  let errorMessage = field.parentNode.querySelector('.field-error');
  if (!errorMessage) {
    errorMessage = document.createElement('div');
    errorMessage.className = 'field-error text-red-500 text-xs mt-1';
    field.parentNode.appendChild(errorMessage);
  }
  errorMessage.textContent = message;
  
  // Remover error después de 5 segundos
  setTimeout(() => {
    field.classList.remove('border-red-500', 'ring-red-500', 'ring-2');
    if (errorMessage) {
      errorMessage.remove();
    }
  }, 5000);
}

/**
 * Muestra error en una sección específica
 */
function showSectionError(sectionId, message) {
  const section = document.getElementById(sectionId);
  if (!section) return;
  
  // Crear o actualizar mensaje de error
  let errorMessage = section.querySelector('.section-error');
  if (!errorMessage) {
    errorMessage = document.createElement('div');
    errorMessage.className = 'section-error text-red-500 text-xs mt-2';
    section.appendChild(errorMessage);
  }
  errorMessage.textContent = message;
  
  // Remover error después de 5 segundos
  setTimeout(() => {
    if (errorMessage) {
      errorMessage.remove();
    }
  }, 5000);
}

/**
 * Limpia todos los errores de validación
 */
function clearValidationErrors() {
  // Limpiar errores de campos
  document.querySelectorAll('.field-error').forEach(error => error.remove());
  document.querySelectorAll('.section-error').forEach(error => error.remove());
  
  // Limpiar clases de error de campos
  document.querySelectorAll('.border-red-500.ring-red-500').forEach(field => {
    field.classList.remove('border-red-500', 'ring-red-500', 'ring-2');
  });
}

/**
 * Configura event listeners para limpiar errores al escribir
 */
function setupValidationEventListeners() {
  // Limpiar errores cuando el usuario escriba en campos de texto
  const textFields = ['contact-name', 'contact-email', 'contact-phone', 'issue-description'];
  textFields.forEach(fieldId => {
    const field = document.getElementById(fieldId);
    if (field) {
      field.addEventListener('input', () => {
        const errorMessage = field.parentNode.querySelector('.field-error');
        if (errorMessage) {
          errorMessage.remove();
        }
        field.classList.remove('border-red-500', 'ring-red-500', 'ring-2');
      });
    }
  });
  
  // Limpiar errores cuando el usuario seleccione radio buttons
  const radioGroups = ['issue-type', 'priority'];
  radioGroups.forEach(groupName => {
    document.querySelectorAll(`input[name="${groupName}"]`).forEach(radio => {
      radio.addEventListener('change', () => {
        const sectionId = groupName === 'issue-type' ? 'issue-type-section' : 'priority-section';
        const section = document.getElementById(sectionId);
        if (section) {
          const errorMessage = section.querySelector('.section-error');
          if (errorMessage) {
            errorMessage.remove();
          }
        }
      });
    });
  });
}

/**
 * Maneja la carga de archivos
 */
function handleFileUpload() {
  const fileInput = document.getElementById('file-upload');
  const uploadBtn = document.getElementById('upload-btn');
  
  // Tabs functionality
  const uploadTab = document.getElementById('upload-tab');
  const selectTab = document.getElementById('select-tab');
  const uploadPanel = document.getElementById('upload-panel');
  const selectPanel = document.getElementById('select-panel');
  
  // Tab switching
  uploadTab?.addEventListener('click', () => {
    uploadTab.classList.add('bg-white', 'dark:bg-gray-800', 'text-gray-900', 'dark:text-white', 'shadow-sm');
    uploadTab.classList.remove('text-gray-600', 'dark:text-gray-400');
    selectTab?.classList.remove('bg-white', 'dark:bg-gray-800', 'text-gray-900', 'dark:text-white', 'shadow-sm');
    selectTab?.classList.add('text-gray-600', 'dark:text-gray-400');
    uploadPanel?.classList.remove('hidden');
    selectPanel?.classList.add('hidden');
  });
  
  selectTab?.addEventListener('click', () => {
    selectTab.classList.add('bg-white', 'dark:bg-gray-800', 'text-gray-900', 'dark:text-white', 'shadow-sm');
    selectTab.classList.remove('text-gray-600', 'dark:text-gray-400');
    uploadTab?.classList.remove('bg-white', 'dark:bg-gray-800', 'text-gray-900', 'dark:text-white', 'shadow-sm');
    uploadTab?.classList.add('text-gray-600', 'dark:text-gray-400');
    selectPanel?.classList.remove('hidden');
    uploadPanel?.classList.add('hidden');
    loadAvailableFiles();
  });
  
  // Trigger file input
  uploadBtn?.addEventListener('click', () => {
    fileInput?.click();
  });
  
  // Handle file selection
  fileInput?.addEventListener('change', (e) => {
    const files = e.target.files;
    if (files) {
      selectedFiles = Array.from(files);
      displaySelectedFiles();
    }
  });
  
  // Handle drag and drop
  const dropZone = document.querySelector('.border-dashed');
  
  dropZone?.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('border-blue-400', 'bg-blue-50');
    dropZone.classList.remove('border-gray-300');
  });
  
  dropZone?.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropZone.classList.remove('border-blue-400', 'bg-blue-50');
    dropZone.classList.add('border-gray-300');
  });
  
  dropZone?.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('border-blue-400', 'bg-blue-50');
    dropZone.classList.add('border-gray-300');
    
    const files = Array.from(e.dataTransfer?.files || []);
    selectedFiles = [...selectedFiles, ...files];
    displaySelectedFiles();
  });
}

/**
 * Muestra los archivos seleccionados
 */
function displaySelectedFiles() {
  const selectedFilesDiv = document.getElementById('selected-files');
  const filesList = document.getElementById('files-list');
  
  const totalFiles = selectedFiles.length + selectedExistingFiles.length;
  
  if (totalFiles === 0) {
    selectedFilesDiv?.classList.add('hidden');
    return;
  }
  
  selectedFilesDiv?.classList.remove('hidden');
  if (filesList) filesList.innerHTML = '';
  
  // Mostrar archivos subidos
  selectedFiles.forEach((file, index) => {
    const fileItem = document.createElement('div');
    fileItem.className = 'flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600';
    
    const fileSize = (file.size / 1024 / 1024).toFixed(2);
    
    fileItem.innerHTML = `
      <div class="flex items-center space-x-3">
        <div class="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
          <svg class="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
          </svg>
        </div>
        <div>
          <p class="text-sm font-medium text-gray-900 dark:text-white">${file.name}</p>
          <p class="text-xs text-gray-500 dark:text-gray-400">${fileSize} MB • New Upload</p>
        </div>
      </div>
      <button type="button" class="text-red-500 hover:text-red-700 transition-colors duration-200" onclick="removeFile(${index})">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    `;
    
    filesList?.appendChild(fileItem);
  });
  
  // Mostrar archivos existentes seleccionados
  selectedExistingFiles.forEach((doc, index) => {
    const fileItem = document.createElement('div');
    fileItem.className = 'flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/30 rounded-lg border border-green-200 dark:border-green-600';
    
    fileItem.innerHTML = `
      <div class="flex items-center space-x-3">
        <div class="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
          <svg class="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
        </div>
        <div>
          <p class="text-sm font-medium text-gray-900 dark:text-white">${doc.name}</p>
          <p class="text-xs text-gray-500 dark:text-gray-400">${doc.size} • ${doc.category} • Existing File</p>
        </div>
      </div>
      <div class="flex items-center space-x-2">
        <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusColors[doc.status]}">
          ${doc.status}
        </span>
        <button type="button" class="text-red-500 hover:text-red-700 transition-colors duration-200" onclick="removeExistingFile(${index})">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>
    `;
    
    filesList?.appendChild(fileItem);
  });
}

/**
 * Remueve un archivo subido
 */
function removeFile(index) {
  selectedFiles.splice(index, 1);
  displaySelectedFiles();
}

/**
 * Remueve un archivo existente
 */
function removeExistingFile(index) {
  selectedExistingFiles.splice(index, 1);
  displaySelectedFiles();
}

/**
 * Carga archivos disponibles
 */
function loadAvailableFiles() {
  const availableFilesList = document.getElementById('available-files-list');
  const fileSearch = document.getElementById('file-search');
  const fileCategoryFilter = document.getElementById('file-category-filter');
  
  // Filtrar documentos (excluir el documento actual)
  const currentDocId = parseInt(document.getElementById('email-modal')?.dataset.docId || '0');
  let availableDocs = documents.filter(doc => doc.id !== currentDocId);
  
  // Aplicar filtros
  const searchTerm = fileSearch?.value.toLowerCase() || '';
  const selectedCategory = fileCategoryFilter?.value || '';
  
  if (searchTerm) {
    availableDocs = availableDocs.filter(doc => 
      doc.name.toLowerCase().includes(searchTerm) || 
      doc.category.toLowerCase().includes(searchTerm)
    );
  }
  
  if (selectedCategory) {
    availableDocs = availableDocs.filter(doc => doc.category === selectedCategory);
  }
  
  // Renderizar archivos disponibles
  if (availableFilesList) availableFilesList.innerHTML = '';
  
  if (availableDocs.length === 0) {
    if (availableFilesList) {
      availableFilesList.innerHTML = `
        <div class="p-4 text-center text-gray-500 dark:text-gray-400">
          <svg class="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
          <p class="text-sm">No files found</p>
        </div>
      `;
    }
    return;
  }
  
  availableDocs.forEach(doc => {
    const isSelected = selectedExistingFiles.some(selected => selected.id === doc.id);
    const fileItem = document.createElement('div');
    fileItem.className = `p-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors duration-200 ${isSelected ? 'bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-500' : ''}`;
    
    fileItem.innerHTML = `
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-3">
          <div class="p-2 bg-gray-100 dark:bg-gray-600 rounded-lg">
            <svg class="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
          </div>
          <div class="flex-1">
            <p class="text-sm font-medium text-gray-900 dark:text-white">${doc.name}</p>
            <p class="text-xs text-gray-500 dark:text-gray-400">${doc.category} • ${doc.size}</p>
          </div>
        </div>
        <div class="flex items-center space-x-2">
          <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusColors[doc.status]}">
            ${doc.status}
          </span>
          <button type="button" class="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors duration-200" onclick="toggleExistingFile(${doc.id})">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${isSelected ? 'M5 13l4 4L19 7' : 'M12 6v6m0 0v6m0-6h6m-6 0H6'}"/>
            </svg>
          </button>
        </div>
      </div>
    `;
    
    availableFilesList?.appendChild(fileItem);
  });
}

/**
 * Alterna la selección de un archivo existente
 */
function toggleExistingFile(docId) {
  const doc = documents.find(d => d.id === docId);
  if (!doc) return;
  
  const existingIndex = selectedExistingFiles.findIndex(selected => selected.id === docId);
  
  if (existingIndex > -1) {
    // Remover archivo
    selectedExistingFiles.splice(existingIndex, 1);
  } else {
    // Agregar archivo
    selectedExistingFiles.push(doc);
  }
  
  displaySelectedFiles();
  loadAvailableFiles(); // Recargar para actualizar UI
}

// Hacer las funciones globales para onclick
window.removeFile = removeFile;
window.toggleExistingFile = toggleExistingFile;
window.removeExistingFile = removeExistingFile;

/**
 * Configura los event listeners del modal
 */
function setupModalEventListeners() {
  // Event listeners para el modal
  document.getElementById('close-email-modal')?.addEventListener('click', closeEmailModal);
  document.getElementById('cancel-email')?.addEventListener('click', closeEmailModal);
  document.getElementById('send-email')?.addEventListener('click', sendEmailFromModal);
  
  // Event listeners para filtros de archivos
  document.getElementById('file-search')?.addEventListener('input', loadAvailableFiles);
  document.getElementById('file-category-filter')?.addEventListener('change', loadAvailableFiles);

  // Cerrar modal al hacer click fuera de él
  document.getElementById('email-modal')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
      closeEmailModal();
    }
  });
  
  // Configurar manejo de archivos
  handleFileUpload();
}

// =============================================================================
// INICIALIZACIÓN
// =============================================================================

// Esperar a que el DOM esté listo
document.addEventListener('DOMContentLoaded', async () => {
  await init();
  setupModalEventListeners();
});