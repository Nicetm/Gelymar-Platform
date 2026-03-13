import {
  qs,
  showError,
  formatDateShort,
  showNotification,
  confirmAction,
  showModal,
  hideModal,
  setupModalClose
} from './utils.js';

export async function initSellersScript() {
  const apiBase = window.apiBase;
  const translations = window.translations || {};
  const vendedores = translations.vendedores || {};
  const lang = window.lang || 'es';
  const isEnglish = String(lang).toLowerCase().startsWith('en');

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
  let selectedSeller = null;

  const changePasswordModalId = '#changePasswordModal';
  const sellerUpdateModalId = '#sellerUpdateModal';
  const changePasswordNameEl = document.getElementById('changePasswordCustomerName');
  const newPasswordInput = document.getElementById('newPassword');
  const confirmPasswordInput = document.getElementById('confirmPassword');
  const savePasswordBtn = document.getElementById('savePasswordBtn');
  const cancelChangePasswordBtn = document.getElementById('cancelChangePasswordBtn');

  const sellerUpdateName = document.getElementById('sellerUpdateName');
  const sellerUpdatePhone = document.getElementById('sellerUpdatePhone');
  const sellerUpdateEmail = document.getElementById('sellerUpdateEmail');
  const sellerUpdateRut = document.getElementById('sellerUpdateRut');
  const sellerUpdateActive = document.getElementById('sellerUpdateActive');
  const sellerUpdateBlocked = document.getElementById('sellerUpdateBlocked');
  const saveSellerUpdateBtn = document.getElementById('saveSellerUpdateBtn');
  const cancelSellerUpdateBtn = document.getElementById('cancelSellerUpdateBtn');
  const closeSellerUpdateModalBtn = document.getElementById('closeSellerUpdateModalBtn');

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

  const getMessage = (value) => (typeof value === 'string' ? value : '');
  const t = {
    noResults: getMessage(vendedores.noResults),
    loading: getMessage(vendedores.loading),
    error: getMessage(vendedores.error),
    validationRequired: getMessage(vendedores.validation_required),
    validationPhoneRequired: getMessage(vendedores.validation_phone_required),
    validationEmail: getMessage(vendedores.validation_email),
    validationPhone: getMessage(vendedores.validation_phone),
    validationRut: getMessage(vendedores.validation_rut),
    validationRutExists: getMessage(vendedores.validation_rut_exists),
    validationPasswordMatch: getMessage(vendedores.validation_password_match),
    validationPasswordStrength: getMessage(vendedores.validation_password_strength),
    confirmUpdateTitle: getMessage(vendedores.confirm_update_title),
    confirmUpdateMessage: getMessage(vendedores.confirm_update_message),
    confirmPasswordTitle: getMessage(vendedores.confirm_password_title),
    confirmPasswordMessage: getMessage(vendedores.confirm_password_message),
    updateSuccess: getMessage(vendedores.update_success),
    updateError: getMessage(vendedores.update_error),
    passwordSuccess: getMessage(vendedores.password_success),
    passwordError: getMessage(vendedores.password_error)
  };

  const resolveBackendMessage = (message) => {
    const raw = String(message || '').trim();
    if (!raw) return '';
    if (/column 'phone' cannot be null/i.test(raw)) {
      return t.validationPhoneRequired || raw;
    }
    if (/rut ya existe/i.test(raw)) {
      return t.validationRutExists || raw;
    }
    if (/rut requerido/i.test(raw)) {
      return t.validationRequired || raw;
    }
    if (isEnglish) {
      if (/error al actualizar vendedor/i.test(raw)) {
        return t.updateError || raw;
      }
      if (/tel[eé]fono debe tener/i.test(raw)) {
        return t.validationPhone || raw;
      }
      if (/email inv[aá]lido/i.test(raw)) {
        return t.validationEmail || raw;
      }
      if (/vendedor no encontrado/i.test(raw)) {
        return t.updateError || raw;
      }
    }
    return raw;
  };

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

  const getColSpan = (fallback = 1) => {
    const table = tableBody?.closest('table');
    const headerCount = table?.querySelectorAll('thead th')?.length || 0;
    return headerCount || fallback;
  };

  const getScrollBodyWidth = () => {
    const scrollBody = tableBody?.closest('[data-scroll-body]') || tableBody?.closest('.overflow-x-auto');
    return scrollBody?.clientWidth || 0;
  };

  const buildCenteredCell = (messageHtml, textClass = 'text-gray-500 dark:text-gray-400', colSpanOverride = null) => {
    const width = getScrollBodyWidth();
    const widthStyle = width ? `width: ${width}px;` : 'width: 100%;';
    const colSpan = colSpanOverride || getColSpan(1);
    return `
      <td colspan="${colSpan}" class="px-6 py-6 ${textClass}" style="position: sticky; left: 0;">
        <div class="flex justify-center text-center" style="${widthStyle}">
          ${messageHtml}
        </div>
      </td>
    `;
  };

  function buildLoadingRow(colspan, message) {
    const safeMessage = message || t.loading;
    return `
      <tr class="bg-white dark:bg-gray-900">
        ${buildCenteredCell(
          `
            <div class="flex items-center justify-center">
              <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              ${safeMessage}
            </div>
          `,
          'text-gray-500 dark:text-gray-400',
          colspan
        )}
      </tr>
    `;
  }

  function renderSellerRow(seller) {
    const createdAt = formatDateShort(seller.created_at) || '-';
    const email = seller.email || '-';
    const name = seller.full_name || seller.rut || '-';
    const online = seller.online === 1;
    const isActive = Number(seller.activo) === 1;
    const activeCheckbox = `
      <input type="checkbox" disabled ${isActive ? 'checked' : ''} class="h-4 w-4 accent-green-500 cursor-not-allowed">
    `;

    const statusBadge = `
      <span class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
        online
          ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
          : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
      }">
        <span class="w-2 h-2 rounded-full ${online ? 'bg-green-500' : 'bg-gray-400'}"></span>
        ${online ? getMessage(vendedores.status_online) : getMessage(vendedores.status_offline)}
      </span>
    `;

    return `
      <tr class="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
        <td class="px-6 py-4 whitespace-nowrap text-xs font-medium text-gray-900 dark:text-gray-100">${name}</td>
        <td class="px-6 py-4 whitespace-nowrap text-xs text-gray-500 dark:text-gray-300">${seller.rut || '-'}</td>
        <td class="px-6 py-4 whitespace-nowrap text-xs text-gray-500 dark:text-gray-300">${email}</td>
        <td class="px-6 py-4 whitespace-nowrap text-xs text-gray-500 dark:text-gray-300">${activeCheckbox}</td>
        <td class="px-6 py-4 whitespace-nowrap text-xs">${statusBadge}</td>
        <td class="px-6 py-4 whitespace-nowrap text-xs text-gray-500 dark:text-gray-300">${createdAt}</td>
        <td class="sticky right-0 bg-gray-50 dark:bg-gray-700 z-10 px-6 py-4 min-w-[120px] overflow-visible">
          <div class="flex items-center justify-center gap-3 relative">
            <div class="relative">
              <button class="text-gray-900 dark:text-white hover:text-green-500 dark:hover:text-green-400 transition"
                data-action="change-password"
                data-rut="${seller.rut || ''}"
                data-name="${name}"
                data-tooltip="${getMessage(vendedores.action_change_password)}"
                aria-label="${getMessage(vendedores.action_change_password)}"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </button>
            </div>
            <div class="relative">
              <button class="text-gray-900 dark:text-white hover:text-green-500 dark:hover:text-green-400 transition"
                data-action="update"
                data-rut="${seller.rut || ''}"
                data-name="${name}"
                data-email="${seller.email || ''}"
                data-phone="${seller.phone || ''}"
                data-activo="${seller.activo ?? 0}"
                data-bloqueado="${seller.bloqueado ?? 0}"
                data-tooltip="${getMessage(vendedores.action_update)}"
                aria-label="${getMessage(vendedores.action_update)}"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11 16l-4 1 1-4 8.586-8.586z" />
                </svg>
              </button>
            </div>
          </div>
        </td>
      </tr>
    `;
  }

  setupStickyHeaderScroll();

  if (closeSellerUpdateModalBtn) {
    closeSellerUpdateModalBtn.addEventListener('click', () => hideModal(sellerUpdateModalId));
  }
  if (cancelSellerUpdateBtn) {
    cancelSellerUpdateBtn.addEventListener('click', () => hideModal(sellerUpdateModalId));
  }
  setupModalClose(changePasswordModalId, '#closeChangePasswordModalBtn');
  setupModalClose(sellerUpdateModalId, '#closeSellerUpdateModalBtn, #cancelSellerUpdateBtn');
  if (cancelChangePasswordBtn) {
    cancelChangePasswordBtn.addEventListener('click', () => hideModal(changePasswordModalId));
  }

  const updateChangePasswordRules = (value) => {
    const rulesList = document.getElementById('changePasswordRules');
    if (!rulesList) return;
    const rules = {
      length: value.length >= 8,
      upper: /[A-Z]/.test(value),
      lower: /[a-z]/.test(value),
      number: /[0-9]/.test(value)
    };
    rulesList.querySelectorAll('li[data-rule]').forEach((item) => {
      const ruleKey = item.getAttribute('data-rule');
      const passed = !!rules[ruleKey];
      const icon = item.querySelector('.rule-icon');
      if (icon) {
        icon.textContent = passed ? '✓' : '✗';
        icon.classList.toggle('text-green-500', passed);
        icon.classList.toggle('dark:text-green-400', passed);
        icon.classList.toggle('text-rose-500', !passed);
        icon.classList.toggle('dark:text-rose-400', !passed);
      }
      item.classList.toggle('text-green-600', passed);
      item.classList.toggle('dark:text-green-400', passed);
      item.classList.toggle('text-rose-500', !passed);
      item.classList.toggle('dark:text-rose-400', !passed);
    });
  };

  if (newPasswordInput) {
    newPasswordInput.addEventListener('input', (e) => {
      updateChangePasswordRules(e.target.value || '');
    });
  }

  const openChangePasswordModal = (seller) => {
    selectedSeller = seller;
    if (changePasswordNameEl) {
      changePasswordNameEl.textContent = seller.full_name || seller.rut || '-';
    }
    if (newPasswordInput) newPasswordInput.value = '';
    if (confirmPasswordInput) confirmPasswordInput.value = '';
    updateChangePasswordRules('');
    showModal(changePasswordModalId);
  };

  const openUpdateModal = (seller) => {
    selectedSeller = seller;
    if (sellerUpdateName) sellerUpdateName.value = seller.full_name || seller.rut || '';
    if (sellerUpdatePhone) sellerUpdatePhone.value = seller.phone || '';
    if (sellerUpdateEmail) sellerUpdateEmail.value = seller.email || '';
    if (sellerUpdateRut) sellerUpdateRut.value = seller.rut || '';
    if (sellerUpdateActive) sellerUpdateActive.checked = Number(seller.activo) === 1;
    if (sellerUpdateBlocked) sellerUpdateBlocked.checked = Number(seller.bloqueado) === 1;
    showModal(sellerUpdateModalId);
  };

  const isValidRut = (value) => {
    const rut = String(value || '').trim();
    return rut.length >= 6;
  };

  const isValidEmail = (value) => {
    const email = String(value || '').trim();
    return email === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const isValidPhone = (value) => {
    const phone = String(value || '').trim();
    if (!phone) return true;
    return phone.length >= 8 && phone.length <= 20;
  };

  const handleSaveSeller = async () => {
    if (!selectedSeller) return;
    const rut = String(selectedSeller.rut || '').trim();
    const nextRut = sellerUpdateRut?.value?.trim() || '';
    const email = sellerUpdateEmail?.value?.trim() || '';
    const phone = sellerUpdatePhone?.value?.trim() || '';
    const activo = sellerUpdateActive?.checked ? 1 : 0;
    const bloqueado = sellerUpdateBlocked?.checked ? 1 : 0;

    if (!nextRut) {
      showNotification(t.validationRequired, 'warning');
      return;
    }
    if (!phone) {
      showNotification(t.validationPhoneRequired || t.validationRequired, 'warning');
      return;
    }
    if (!isValidRut(nextRut)) {
      showNotification(t.validationRut, 'warning');
      return;
    }
    if (!isValidEmail(email)) {
      showNotification(t.validationEmail, 'warning');
      return;
    }
    if (!isValidPhone(phone)) {
      showNotification(t.validationPhone, 'warning');
      return;
    }

    const confirmed = await confirmAction(t.confirmUpdateTitle, t.confirmUpdateMessage, 'warning');
    if (!confirmed) return;

    try {
      const token = getToken();
      const response = await fetch(`${apiBase}/api/vendedores/${encodeURIComponent(rut)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          rut: nextRut,
          email,
          phone,
          activo,
          bloqueado
        })
      });
      if (!response.ok) {
        throw await buildErrorFromResponse(response, t.updateError);
      }
      showNotification(t.updateSuccess, 'success');
      hideModal(sellerUpdateModalId);
      await loadSellers();
    } catch (error) {
      console.error('Error updating seller:', error);
      const message = resolveBackendMessage(error?.message) || t.updateError;
      showNotification(message, 'error');
    }
  };

  const handleSavePassword = async () => {
    if (!selectedSeller) return;
    const rut = String(selectedSeller.rut || '').trim();
    const newPassword = newPasswordInput?.value?.trim() || '';
    const confirmPassword = confirmPasswordInput?.value?.trim() || '';
    if (!newPassword || !confirmPassword) {
      showNotification(t.validationRequired, 'warning');
      return;
    }
    if (newPassword !== confirmPassword) {
      showNotification(t.validationPasswordMatch, 'warning');
      return;
    }
    const strongRules = {
      length: newPassword.length >= 8,
      upper: /[A-Z]/.test(newPassword),
      lower: /[a-z]/.test(newPassword),
      number: /[0-9]/.test(newPassword)
    };
    const strong = Object.values(strongRules).every(Boolean);
    if (!strong) {
      updateChangePasswordRules(newPassword);
      showNotification(t.validationPasswordStrength, 'warning');
      return;
    }

    const confirmed = await confirmAction(t.confirmPasswordTitle, t.confirmPasswordMessage, 'warning');
    if (!confirmed) return;

    try {
      const token = getToken();
      const response = await fetch(`${apiBase}/api/vendedores/change-password/${encodeURIComponent(rut)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ password: newPassword })
      });
      if (!response.ok) {
        throw await buildErrorFromResponse(response, t.passwordError);
      }
      showNotification(t.passwordSuccess, 'success');
      hideModal(changePasswordModalId);
    } catch (error) {
      console.error('Error changing seller password:', error);
      const message = resolveBackendMessage(error?.message) || t.passwordError;
      showNotification(message, 'error');
    }
  };

  function renderEmptyState() {
    tableBody.innerHTML = `
      <tr class="bg-white dark:bg-gray-900">
        ${buildCenteredCell(t.noResults)}
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
    if (column === 'activo' || column === 'bloqueado') {
      const aNum = Number(aVal) || 0;
      const bNum = Number(bVal) || 0;
      return (aNum - bNum) * multiplier;
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
        seller.rut,
        seller.activo,
        seller.bloqueado
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
      tableBody.innerHTML = buildLoadingRow(7, t.loading);
      const scrollBody = tableBody?.closest('[data-scroll-body]') || tableBody?.closest('.overflow-x-auto');
      if (scrollBody) {
        scrollBody.classList.add('scrollbar-hidden');
      }
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
      const scrollBodyAfter = tableBody?.closest('[data-scroll-body]') || tableBody?.closest('.overflow-x-auto');
      if (scrollBodyAfter) {
        scrollBodyAfter.classList.remove('scrollbar-hidden');
      }
    } catch (error) {
      console.error('Error loading sellers:', error);
      showError(t.error);
      allSellers = [];
      filteredSellers = [];
      currentPage = 1;
      renderTable();
      const scrollBodyAfter = tableBody?.closest('[data-scroll-body]') || tableBody?.closest('.overflow-x-auto');
      if (scrollBodyAfter) {
        scrollBodyAfter.classList.remove('scrollbar-hidden');
      }
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

  tableBody.addEventListener('click', (e) => {
    const actionBtn = e.target.closest('button[data-action]');
    if (!actionBtn) return;
    const action = actionBtn.dataset.action;
    const seller = {
      rut: actionBtn.dataset.rut,
      full_name: actionBtn.dataset.name,
      email: actionBtn.dataset.email,
      phone: actionBtn.dataset.phone,
      activo: actionBtn.dataset.activo,
      bloqueado: actionBtn.dataset.bloqueado
    };
    if (action === 'change-password') {
      openChangePasswordModal(seller);
    }
    if (action === 'update') {
      openUpdateModal(seller);
    }
  });

  if (saveSellerUpdateBtn) {
    saveSellerUpdateBtn.addEventListener('click', handleSaveSeller);
  }
  if (savePasswordBtn) {
    savePasswordBtn.addEventListener('click', handleSavePassword);
  }

  await loadSellers();

  const canAutoRefresh = () => {
    const changePasswordModal = document.querySelector(changePasswordModalId);
    const updateModal = document.querySelector(sellerUpdateModalId);
    const isChangeOpen = changePasswordModal && !changePasswordModal.classList.contains('hidden');
    const isUpdateOpen = updateModal && !updateModal.classList.contains('hidden');
    return !isChangeOpen && !isUpdateOpen;
  };

  const initializePresenceSocket = () => {
    const token = getToken();
    if (!token) return;

    const tryConnect = (attempt = 0) => {
      if (typeof io === 'undefined') {
        if (attempt >= 10) {
          console.error('Socket.io no está disponible');
          return;
        }
        window.setTimeout(() => tryConnect(attempt + 1), 300);
        return;
      }

      const socket = io(apiBase, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 5
      });

      let refreshTimer = null;
      const requestRefresh = () => {
        if (refreshTimer) return;
        refreshTimer = window.setTimeout(async () => {
          refreshTimer = null;
          if (document.hidden || !canAutoRefresh()) return;
          await loadSellers();
        }, 250);
      };

      socket.on('userPresenceUpdated', () => {
        requestRefresh();
      });

      socket.on('connect_error', (error) => {
        console.error('Error de conexión Socket.io:', error);
      });
    };

    tryConnect();
  };

  initializePresenceSocket();
}

function getToken() {
  return (
    localStorage.getItem('token') ||
    localStorage.getItem('accessToken') ||
    localStorage.getItem('jwt') ||
    null
  );
}
