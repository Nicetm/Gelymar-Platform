import { qs, showNotification, createPagination, formatDate, setupScrollShadow } from './utils.js';

// Detectar idioma
let lang = localStorage.getItem('lang') || 'es';
// Eliminar toda la lógica de importación dinámica de traducciones
let t = {
  editOrder: "Editar {order}",
  noResults: "Sin resultados",
  searchError: "Error al buscar"
};

export async function initOrdersScript() {
  const buscarBtn = qs('buscarBtn');
  const limpiarBtn = qs('limpiarBtn');
  const tablaBody = qs('resultadosTabla');
  const itemsPerPageSelect = qs('itemsPerPageSelect');
  const pageIndicator = qs('pageIndicator');
  const prevPageBtn = qs('prevPageBtn');
  const nextPageBtn = qs('nextPageBtn');
  const head = document.getElementById('ordersHead');

  let itemsPerPage = parseInt(itemsPerPageSelect.value, 10);
  let currentPage = 1;
  let currentData = [];

  function updatePagination() {
    const totalPages = Math.max(1, Math.ceil(currentData.length / itemsPerPage));
    createPagination(totalPages, currentPage, (page) => {
      currentPage = page;
      renderPage();
    });
    pageIndicator.textContent = ` ${currentPage}  -- ${totalPages}`;
  }

  function renderPage() {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageData = currentData.slice(start, end);

    if (pageData.length === 0) {
      tablaBody.innerHTML = `<tr><td colspan="7" class="px-4 py-4 text-center text-gray-400 dark:text-gray-500">${t.noResults}</td></tr>`;
      updatePagination();
      return;
    }

    tablaBody.innerHTML = pageData.map(order => `
      <tr data-id="${order.id}" class="transition-colors duration-150 hover:bg-gray-100 dark:hover:bg-gray-800 hover:shadow-[0_1px_3px_rgba(0,0,0,0.12)]">
        <td class="px-6 py-4 items-center gap-3">${order.pc || '-'}</td>
        <td class="px-4 py-3 break-all text-blue-600 dark:text-blue-400">${order.customer_name || '-'}</td>
        <td class="px-6 py-4 items-center gap-3">${formatDate(order.created_at)}</td>
        <td class="px-6 py-4 items-center gap-3">${formatDate(order.updated_at)}</td>
        <td class="px-6 py-4">
          <div class="flex justify-center items-center gap-3 text-gray-900 dark:text-white">
            <a href="/admin/clients/documents/view/${order.customer_uuid}?f=${order.id}&pc=${order.pc}&c=${order.customer_name}" class="go-to-order-btn" title="Ir a la orden">
              <svg class="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M14 3h7m0 0v7m0-7L10 14m-4 0h.01M5 14a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h5a1 1 0 0 0 1-1v-.01" />
              </svg>
            </a>
            <a href="#" title="${t.editOrder.replace('{order}', order.name)}" class="edit-btn hover:text-green-500 transition" data-file-id="${order.id}">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536M9 11l6.586-6.586a2 2 0 112.828 2.828L11.828 13.83a2 2 0 01-.586.414L9 15l.756-2.243a2 2 0 01.414-.586z" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 20H5" />
              </svg>
            </a>
          </div>
        </td>
      </tr>
    `).join('');
    updatePagination();
  }

  function showSkeleton(count = 8) {
    const skeletonRow = `
      <tr class="animate-pulse">
        <td colspan="7" class="px-6 py-4">
          <div class="space-y-2">
            <div class="h-4 w-3/4 bg-gray-300 dark:bg-gray-700 rounded"></div>
            <div class="h-4 w-1/2 bg-gray-300 dark:bg-gray-700 rounded"></div>
          </div>
        </td>
      </tr>`;
    tablaBody.innerHTML = skeletonRow.repeat(count);
  }

  async function performSearch() {
    const cliente = qs('cliente')?.value.trim() ?? '';
    const orden = qs('orden')?.value.trim() ?? '';
    const estado = qs('estado')?.value ?? '';
    const fechaIngreso = qs('fechaIngreso')?.value ?? '';
    const fechaETD = qs('fechaETD')?.value ?? '';
    const fechaETA = qs('fechaETA')?.value ?? '';

    const apiBase = buscarBtn?.dataset.apiBase;
    const token = localStorage.getItem('token');

    const filtros = {
      orderName: orden,
      customerName: cliente,
      estado: estado !== 'Todos' && estado !== '' ? estado : undefined,
      fechaIngreso: fechaIngreso || undefined,
      fechaETD: fechaETD || undefined,
      fechaETA: fechaETA || undefined 
    };
    Object.keys(filtros).forEach(key => {
      if (filtros[key] === undefined || filtros[key] === '') {
        delete filtros[key];
      }
    });

    showSkeleton();

    try {
      const response = await fetch(`${apiBase}/api/orders/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(filtros)
      });
      const data = await response.json();
      currentData = Array.isArray(data) ? data : [];
      itemsPerPage = parseInt(itemsPerPageSelect.value, 10);
      currentPage = 1;
      renderPage();
    } catch (error) {
      console.error(error);
      tablaBody.innerHTML = `<tr><td colspan="6" class="px-4 py-4 text-center text-red-500">${t.searchError}</td></tr>`;
    }
  }

  function clearFilters() {
    qs('cliente').value = '';
    qs('orden').value = '';
    qs('estado').value = '';
    qs('fechaIngreso').value = '';
    qs('fechaETD').value = '';
    qs('fechaETA').value = '';
    performSearch(); // Recargar todos los registros
  }

  // Event Listeners
  itemsPerPageSelect.addEventListener('change', () => {
    itemsPerPage = parseInt(itemsPerPageSelect.value, 10);
    currentPage = 1;
    renderPage();
  });

  prevPageBtn.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      renderPage();
    }
  });

  nextPageBtn.addEventListener('click', () => {
    const totalPages = Math.ceil(currentData.length / itemsPerPage);
    if (currentPage < totalPages) {
      currentPage++;
      renderPage();
    }
  });

  buscarBtn.addEventListener('click', performSearch);

  limpiarBtn.addEventListener('click', clearFilters);

  // Sombra en scroll
  if (head) setupScrollShadow(window, head);

  // Inicializar paginador
  renderPage();

  // Llamar a la búsqueda inicial al cargar la página
  performSearch();
}

// Función para abrir modal de edición (exportada para uso global)
export async function openEditOrderModal(orderId, currentName) {
  // Implementar lógica del modal de edición aquí
  console.log('Abriendo modal de edición para orden:', orderId, currentName);
  
  try {
    // Por ahora solo muestra una notificación
    showNotification('Función de edición en desarrollo', 'info');
    console.log('Notificación mostrada correctamente');
    
    // También mostrar una notificación de éxito después de 1 segundo
    setTimeout(() => {
      showNotification('Orden cargada correctamente', 'success');
      console.log('Segunda notificación mostrada');
    }, 1000);
  } catch (error) {
    console.error('Error al mostrar notificación:', error);
  }
} 