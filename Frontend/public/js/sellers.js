import { qs, showError, formatDateShort } from './utils.js';

export async function initSellersScript() {
  const apiBase = window.apiBase;
  const translations = window.translations || {};
  const vendedores = translations.vendedores || {};

  const searchInput = qs('sellerSearchInput');
  const itemsPerPageSelect = qs('itemsPerPageSelect');
  const prevPageBtn = qs('prevPageBtn');
  const nextPageBtn = qs('nextPageBtn');
  const pageIndicator = qs('pageIndicator');
  const tableBody = document.getElementById('sellersTableBody');

  if (!apiBase || !tableBody || !searchInput || !itemsPerPageSelect || !prevPageBtn || !nextPageBtn || !pageIndicator) {
    console.error('Elementos necesarios no encontrados para la tabla de vendedores');
    return;
  }

  let allSellers = [];
  let filteredSellers = [];
  let currentPage = 1;
  let itemsPerPage = parseInt(itemsPerPageSelect.value, 10) || 10;
  let currentSort = { column: null, direction: 'asc' };

  function setupStickyHeaderScroll() {
    const containers = document.querySelectorAll('[data-scroll-sync]');
    if (!containers.length) return;

    containers.forEach(container => {
      const body = container.querySelector('[data-scroll-body]');
      const header = container.querySelector('[data-scroll-header]');
      const headerTrack = container.querySelector('[data-scroll-header-track]');
      const headerTable = headerTrack?.querySelector('table');

      if (!body || !header || !headerTrack || !headerTable) return;

      const table = body.querySelector('table');
      const thead = table?.querySelector('thead');

      if (thead && headerTable.children.length === 0) {
        headerTable.appendChild(thead.cloneNode(true));
      }

      const syncHeaderColumnWidths = () => {
        const sourceCells = thead?.querySelectorAll('th') || [];
        const cloneCells = headerTable.querySelectorAll('th');
        if (!sourceCells.length || !cloneCells.length) return;
        sourceCells.forEach((cell, index) => {
          const cloneCell = cloneCells[index];
          if (!cloneCell) return;
          const width = cell.getBoundingClientRect().width;
          cloneCell.style.width = `${width}px`;
        });
      };

      const updateSizes = () => {
        const rect = container.getBoundingClientRect();
        const scrollWidth = table ? table.scrollWidth : body.scrollWidth;
        headerTable.style.width = `${scrollWidth}px`;

        const inView = rect.bottom > 0 && rect.top < window.innerHeight;
        if (!inView) {
          header.classList.add('hidden');
          header.classList.remove('sticky-scroll-header-floating');
          header.style.left = '';
          header.style.width = '';
          return;
        }

        const shouldShowHeader = rect.top < 0 && rect.bottom > 0;
        header.classList.toggle('hidden', !shouldShowHeader);

        if (shouldShowHeader) {
          syncHeaderColumnWidths();
          header.classList.add('sticky-scroll-header-floating');
          header.style.left = `${Math.max(rect.left, 0)}px`;
          header.style.width = `${Math.max(rect.width, 0)}px`;
        } else {
          header.classList.remove('sticky-scroll-header-floating');
          header.style.left = '';
          header.style.width = '';
        }
      };

      const syncFromBody = () => {
        headerTrack.scrollLeft = body.scrollLeft;
      };

      const syncFromHeader = () => {
        body.scrollLeft = headerTrack.scrollLeft;
      };

      body.addEventListener('scroll', syncFromBody);
      headerTrack.addEventListener('scroll', syncFromHeader);

      const resizeObserver = new ResizeObserver(updateSizes);
      resizeObserver.observe(body);
      if (table) resizeObserver.observe(table);

      window.addEventListener('resize', updateSizes);
      window.addEventListener('scroll', updateSizes, true);
      updateSizes();
    });
  }

  const t = {
    noResults: vendedores.noResults || 'No se encontraron resultados',
    loading: vendedores.loading || 'Cargando...',
    error: vendedores.error || 'Error al cargar vendedores',
  };

  function renderSellerRow(seller) {
    const createdAt = formatDateShort(seller.created_at) || '-';
    const email = seller.email || '-';
    const phone = seller.phone || '-';
    const country = seller.country || '-';
    const city = seller.city || '-';
    const name = seller.full_name || email;
    const online = seller.online === 1;

    const statusBadge = `
      <span class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
        online
          ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
          : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
      }">
        <span class="w-2 h-2 rounded-full ${online ? 'bg-green-500' : 'bg-gray-400'}"></span>
        ${online ? vendedores.status_online || 'En línea' : vendedores.status_offline || 'Desconectado'}
      </span>
    `;

    return `
      <tr class="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
        <td class="px-6 py-4 whitespace-nowrap text-xs font-medium text-gray-900 dark:text-gray-100">${name}</td>
        <td class="px-6 py-4 whitespace-nowrap text-xs text-gray-500 dark:text-gray-300">${email}</td>
        <td class="px-6 py-4 whitespace-nowrap text-xs text-gray-500 dark:text-gray-300">${phone}</td>
        <td class="px-6 py-4 whitespace-nowrap text-xs text-gray-500 dark:text-gray-300">${country}</td>
        <td class="px-6 py-4 whitespace-nowrap text-xs text-gray-500 dark:text-gray-300">${city}</td>
        <td class="px-6 py-4 whitespace-nowrap text-xs">${statusBadge}</td>
        <td class="px-6 py-4 whitespace-nowrap text-xs text-gray-500 dark:text-gray-300">${createdAt}</td>
      </tr>
    `;
  }

  setupStickyHeaderScroll();

  function renderEmptyState() {
    tableBody.innerHTML = `
      <tr class="bg-white dark:bg-gray-900">
        <td colspan="7" class="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
          ${t.noResults}
        </td>
      </tr>
    `;
  }

  function updatePagination(totalPages) {
    const totalItems = filteredSellers.length;
    const pageLabel =
      (typeof translations !== 'undefined' && translations.pageIndicator) ||
      vendedores.pageIndicator ||
      'Página';

    const separatorLabel =
      (typeof translations !== 'undefined' && translations.pageIndicatorSeparator) ||
      vendedores.pageSeparator ||
      'de';

    const displayCurrent = totalItems === 0 ? 0 : currentPage;
    const displayTotal = totalItems === 0 ? 0 : totalPages;

    pageIndicator.textContent = `${pageLabel} ${displayCurrent} ${separatorLabel} ${displayTotal}`;

    const atFirstPage = displayCurrent <= 1;
    const atLastPage = displayCurrent >= totalPages;
    const noResults = totalItems === 0;

    prevPageBtn.disabled = atFirstPage || noResults;
    nextPageBtn.disabled = atLastPage || noResults;

    prevPageBtn.classList.toggle('opacity-50', prevPageBtn.disabled);
    prevPageBtn.classList.toggle('cursor-not-allowed', prevPageBtn.disabled);
    nextPageBtn.classList.toggle('opacity-50', nextPageBtn.disabled);
    nextPageBtn.classList.toggle('cursor-not-allowed', nextPageBtn.disabled);
  }

  function renderTable() {
    const start = (currentPage - 1) * itemsPerPage;
    const pageData = filteredSellers.slice(start, start + itemsPerPage);

    tableBody.innerHTML = '';

    if (pageData.length === 0) {
      renderEmptyState();
    } else {
      const rows = pageData.map(renderSellerRow).join('');
      tableBody.insertAdjacentHTML('beforeend', rows);
    }

    const totalPages = Math.max(1, Math.ceil(filteredSellers.length / itemsPerPage));
    updatePagination(totalPages);
  }

  function sortSellers(column, direction) {
    if (!column) return;
    const multiplier = direction === 'desc' ? -1 : 1;
    filteredSellers.sort((a, b) => {
      let aVal = a[column];
      let bVal = b[column];

      if (aVal == null) aVal = '';
      if (bVal == null) bVal = '';

      if (column === 'created_at') {
        const aDate = new Date(aVal);
        const bDate = new Date(bVal);
        return ((aDate - bDate) || 0) * multiplier;
      }

      if (typeof aVal === 'number' || typeof bVal === 'number') {
        return (Number(aVal) - Number(bVal)) * multiplier;
      }

      return String(aVal).toLowerCase().localeCompare(String(bVal).toLowerCase()) * multiplier;
    });
  }

  function updateSortIcons(activeColumn, direction) {
    document.querySelectorAll('th[data-sort] .sort-icon').forEach(icon => {
      icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" d="M8 9l4-4 4 4m0 6l-4 4-4-4" />';
    });

    const activeHeader = document.querySelector(`th[data-sort="${activeColumn}"] .sort-icon`);
    if (activeHeader) {
      activeHeader.innerHTML =
        direction === 'asc'
          ? '<path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7" />'
          : '<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />';
    }
  }

  function filterSellers() {
    const query = searchInput.value.toLowerCase().trim();

    if (!query) {
      filteredSellers = [...allSellers];
      currentPage = 1;
      sortSellers(currentSort.column, currentSort.direction);
      renderTable();
      return;
    }

    filteredSellers = allSellers.filter((seller) => {
      const haystack = [
        seller.full_name,
        seller.email,
        seller.phone,
        seller.country,
        seller.city
      ]
        .filter(Boolean)
        .map((value) => value.toString().toLowerCase());

      return haystack.some((value) => value.includes(query));
    });

    currentPage = 1;
    sortSellers(currentSort.column, currentSort.direction);
    renderTable();
  }

  async function loadSellers() {
    const token = getToken();

    try {
      const response = await fetch(`${apiBase}/api/vendedores`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Acceso denegado');
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      allSellers = Array.isArray(data) ? data : [];
      filteredSellers = [...allSellers];
      currentPage = 1;
      sortSellers(currentSort.column, currentSort.direction);
      renderTable();
    } catch (error) {
      console.error('Error loading sellers:', error);
      showError(t.error);
      allSellers = [];
      filteredSellers = [];
      currentPage = 1;
      renderTable();
    }
  }

  itemsPerPageSelect.addEventListener('change', () => {
    const value = parseInt(itemsPerPageSelect.value, 10);
    itemsPerPage = Number.isFinite(value) && value > 0 ? value : 10;
    currentPage = 1;
    renderTable();
  });

  prevPageBtn.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage -= 1;
      renderTable();
    }
  });

  nextPageBtn.addEventListener('click', () => {
    const totalPages = Math.max(1, Math.ceil(filteredSellers.length / itemsPerPage));
    if (currentPage < totalPages) {
      currentPage += 1;
      renderTable();
    }
  });

  searchInput.addEventListener('input', filterSellers);

  document.addEventListener('click', (e) => {
    const header = e.target.closest('th[data-sort]');
    if (!header) return;
    e.preventDefault();
    const column = header.dataset.sort;

    if (currentSort.column === column) {
      currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
      currentSort.column = column;
      currentSort.direction = 'asc';
    }

    sortSellers(currentSort.column, currentSort.direction);
    updateSortIcons(currentSort.column, currentSort.direction);
    currentPage = 1;
    renderTable();
  });

  await loadSellers();
}

function getToken() {
  return (
    localStorage.getItem('token') ||
    localStorage.getItem('accessToken') ||
    localStorage.getItem('jwt') ||
    null
  );
}
