const MESSAGE_TYPES = {
  MESSAGES: 'messages',
  ORDERS: 'orders_missing_documents',
  CUSTOMERS: 'customers_without_account',
};

const DEFAULT_LIMIT = 10;

function getToken() {
  const storages = ['token', 'accessToken', 'jwt'];
  for (const key of storages) {
    const value = localStorage.getItem(key);
    if (value) return value;
  }

  const match = document.cookie.match(/(?:^|; )(?:token|accessToken|jwt)=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function getHeaders() {
  const token = getToken();
  return token
    ? {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    : { 'Content-Type': 'application/json' };
}

async function fetchJSON(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...getHeaders(),
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch (_) {
      // ignore parse errors
    }
    throw new Error(message);
  }

  return response.json();
}

function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDate(value, lang = 'es') {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString(lang === 'es' ? 'es-CL' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatStatus(item, labels) {
  const status = item.status || 'pending';
  const baseClasses =
    'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold';

  if (status === 'done') {
    return `<span class="${baseClasses} bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
      <i data-lucide="check" class="w-3 h-3"></i>
      ${escapeHtml(labels.done || 'Completado')}
    </span>`;
  }

  return `<span class="${baseClasses} bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200">
    <i data-lucide="clock" class="w-3 h-3"></i>
    ${escapeHtml(labels.pending || 'Pendiente')}
  </span>`;
}

function renderPagination(container, pagination, state, labels) {
  if (!container) return;

  const { page, totalPages, total } = pagination;
  container.innerHTML = '';

  const buildButton = (label, targetPage, disabled = false, iconPath) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.innerHTML = `
      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="${iconPath}" />
      </svg>
      <span class="sr-only">${label}</span>
    `;
    button.setAttribute('aria-label', label);
    button.className =
      'text-xs w-9 h-9 flex items-center justify-center bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-100 rounded-md transition disabled:opacity-50 disabled:pointer-events-none';
    button.disabled = disabled;
    button.dataset.page = targetPage;
    return button;
  };

  const prevButton = buildButton(
    labels.pagination?.prev || 'Anterior',
    Math.max(page - 1, 1),
    page === 1,
    'M15 19l-7-7 7-7'
  );

  const nextButton = buildButton(
    labels.pagination?.next || 'Siguiente',
    Math.min(page + 1, totalPages),
    page === totalPages,
    'M9 5l7 7-7 7'
  );

  const rangeStart = total === 0 ? 0 : (page - 1) * state.limit + 1;
  const rangeEnd = total === 0 ? 0 : Math.min(page * state.limit, total);
  const separator = labels.pagination?.of ? ` ${labels.pagination.of} ` : ' / ';

  const indicator = document.createElement('span');
  indicator.id = 'messagePaginationIndicator';
  indicator.className =
    'min-w-[120px] text-center px-4 py-1 rounded-lg bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100 text-sm font-medium shadow-sm flex items-center justify-center';
  indicator.textContent = `${rangeStart}-${rangeEnd}${separator}${total || 0}`;
  indicator.title = indicator.textContent;

  container.appendChild(prevButton);
  container.appendChild(indicator);
  container.appendChild(nextButton);
}

function buildMessagesRow(item, labels, lang) {
  const relatedName = item.related?.customerName || `ID ${item.related?.customerId || '-'}`;
  const unread = Number(item.unreadCount || 0);
  const subtitle =
    unread > 0
      ? `<span class="text-xs font-semibold text-orange-600 dark:text-orange-300">${unread} ${
          labels.unreadSuffix || 'sin leer'
        }</span>`
      : `<span class="text-xs text-gray-400 dark:text-gray-500">${labels.read || 'Sin pendientes'}</span>`;

  return `
    <tr class="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800">
      <td class="px-6 py-4 align-middle">
        <div class="flex flex-col gap-1">
          <p class="font-semibold text-gray-900 dark:text-white">${escapeHtml(item.description || '-')}</p>
          ${subtitle}
        </div>
      </td>
      <td class="px-6 py-4 align-middle">
        <p class="font-medium text-gray-800 dark:text-gray-200">${escapeHtml(relatedName)}</p>
      </td>
      <td class="px-6 py-4 text-xs text-gray-500 dark:text-gray-400 align-middle">${formatDate(
        item.timestamp,
        lang
      )}</td>
      <td class="px-6 py-4 align-middle">${formatStatus(item, labels)}</td>
      <td class="px-6 py-4 text-center align-middle">
        <a
          href="#"
          class="message-view-button inline-flex items-center justify-center text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-300 transition"
          data-id="${escapeHtml(item.id)}"
          data-type="${escapeHtml(item.type)}"
          title="${escapeHtml(labels.viewAction || 'Ver detalle')}"
          aria-label="${escapeHtml(labels.viewAction || 'Ver detalle')}"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </a>
      </td>
    </tr>
  `;
}

function buildOrdersRow(item, labels, lang) {
  const relatedName = item.related?.customerName || '-';
  const docCount = `${item.documentCount ?? 0}/${item.minDocuments ?? 5}`;
  return `
    <tr class="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800">
      <td class="px-6 py-4 align-middle">
        <div class="flex flex-col gap-1">
          <p class="font-semibold text-gray-900 dark:text-white">${escapeHtml(item.title || '-')}</p>
          <span class="text-xs text-gray-500 dark:text-gray-400">${escapeHtml(
            labels.docsLabel ? labels.docsLabel.replace('{count}', docCount) : `Documentos cargados: ${docCount}`
          )}</span>
        </div>
      </td>
      <td class="px-6 py-4 align-middle">
        <p class="font-medium text-gray-800 dark:text-gray-200">${escapeHtml(relatedName)}</p>
        <p class="text-xs text-gray-400 dark:text-gray-500">${escapeHtml(item.related?.oc || '')}</p>
      </td>
      <td class="px-6 py-4 text-xs text-gray-500 dark:text-gray-400 align-middle">${formatDate(
        item.timestamp,
        lang
      )}</td>
      <td class="px-6 py-4 align-middle">${formatStatus(item, labels)}</td>
      <td class="px-6 py-4 text-center align-middle">
        <a
          href="#"
          class="message-view-button inline-flex items-center justify-center text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-300 transition"
          data-id="${escapeHtml(item.id)}"
          data-type="${escapeHtml(item.type)}"
          title="${escapeHtml(labels.viewAction || 'Ver detalle')}"
          aria-label="${escapeHtml(labels.viewAction || 'Ver detalle')}"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </a>
      </td>
    </tr>
  `;
}

function buildCustomersRow(item, labels, lang) {
  const relatedName = item.title || '-';
  const subtitle = item.description || item.related?.rut || '';
  return `
    <tr class="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800">
      <td class="px-6 py-4 align-middle">
        <div class="flex flex-col gap-1">
          <p class="font-semibold text-gray-900 dark:text-white">${escapeHtml(relatedName)}</p>
          <span class="text-xs text-gray-500 dark:text-gray-400">${escapeHtml(subtitle)}</span>
        </div>
      </td>
      <td class="px-6 py-4 align-middle">
        <p class="font-medium text-gray-800 dark:text-gray-200">${escapeHtml(
          item.related?.rut || '-'
        )}</p>
      </td>
      <td class="px-6 py-4 text-xs text-gray-500 dark:text-gray-400 align-middle">${formatDate(
        item.timestamp,
        lang
      )}</td>
      <td class="px-6 py-4 align-middle">${formatStatus(item, labels)}</td>
      <td class="px-6 py-4 text-center align-middle">
        <a
          href="#"
          class="message-view-button inline-flex items-center justify-center text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-300 transition"
          data-id="${escapeHtml(item.id)}"
          data-type="${escapeHtml(item.type)}"
          title="${escapeHtml(labels.viewAction || 'Ver detalle')}"
          aria-label="${escapeHtml(labels.viewAction || 'Ver detalle')}"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </a>
      </td>
    </tr>
  `;
}

function renderTable(items, state, labels, lang) {
  const tbody = document.getElementById('messageTableBody');
  const emptyState = document.getElementById('messageEmptyState');

  if (!tbody) return;

  if (!items.length) {
    tbody.innerHTML = '';
    if (emptyState) {
      emptyState.classList.remove('hidden');
    }
    return;
  }

  if (emptyState) {
    emptyState.classList.add('hidden');
  }

  const rows = items.map((item) => {
    if (item.type === MESSAGE_TYPES.MESSAGES) {
      return buildMessagesRow(item, labels, lang);
    }
    if (item.type === MESSAGE_TYPES.ORDERS) {
      return buildOrdersRow(item, labels, lang);
    }
    if (item.type === MESSAGE_TYPES.CUSTOMERS) {
      return buildCustomersRow(item, labels, lang);
    }
    return '';
  });

  tbody.innerHTML = rows.join('');
}

function setActiveTab(type) {
  document.querySelectorAll('.message-tab').forEach((tab) => {
    const isActive = tab.dataset.type === type;
    tab.classList.toggle('bg-blue-600', isActive);
    tab.classList.toggle('text-white', isActive);
    tab.classList.toggle('border-transparent', isActive);
    tab.classList.toggle('text-gray-600', !isActive);
    tab.classList.toggle('dark:text-gray-300', !isActive);
  });
}

async function loadSummary({ apiBase, labels }) {
  try {
    const data = await fetchJSON(`${apiBase}/api/messages/summary`);
    const summary = data?.data || {};

    const updateCount = (type, elementId) => {
      const el = document.getElementById(elementId);
      if (!el) return;
      const value = summary[type];
      if (!value) {
        el.textContent = '0';
        return;
      }
      if (type === MESSAGE_TYPES.MESSAGES) {
        el.textContent = value.unread ?? 0;
      } else {
        el.textContent = value.total ?? 0;
      }
    };

    updateCount(MESSAGE_TYPES.MESSAGES, 'summary-messages-count');
    updateCount(MESSAGE_TYPES.ORDERS, 'summary-orders-missing-documents-count');
    updateCount(MESSAGE_TYPES.CUSTOMERS, 'summary-customers-without-account-count');
  } catch (error) {
    console.error('Error cargando resumen de mensajes:', error.message);
  } finally {
    if (typeof window.lucide !== 'undefined') {
      window.lucide.createIcons();
    }
  }
}

async function loadMessages(state, { apiBase, labels, lang }) {
  const params = new URLSearchParams({
    type: state.currentType,
    page: state.page,
    limit: state.limit,
  });

  if (state.status !== 'all') {
    params.set('status', state.status);
  }

  if (state.search) {
    params.set('search', state.search);
  }

  const tbody = document.getElementById('messageTableBody');
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="px-6 py-6 text-center text-gray-400 dark:text-gray-500">
          <i data-lucide="loader-2" class="w-5 h-5 animate-spin inline-flex"></i>
        </td>
      </tr>
    `;
  }

  try {
    const response = await fetchJSON(`${apiBase}/api/messages?${params.toString()}`);
    const result = response?.data || {};
    const items = Array.isArray(result.items) ? result.items : [];
    const pagination = result.pagination || { page: state.page, totalPages: 1, total: items.length };

    renderTable(items, state, labels, lang);
    const paginationContainer = document.getElementById('messagePaginationControls');
    renderPagination(paginationContainer, pagination, state, labels);

    if (typeof window.lucide !== 'undefined') {
      window.lucide.createIcons();
    }
  } catch (error) {
    console.error('Error cargando mensajes:', error.message);
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="px-6 py-8 text-center text-red-500 dark:text-red-300">
            ${escapeHtml(labels.error || 'No fue posible cargar la información')}
          </td>
        </tr>
      `;
    }
  }
}

function handleNavigation(container) {
  container.addEventListener('click', (event) => {
    const button = event.target.closest('.message-view-button');
    if (!button) return;
    const { id, type } = button.dataset;
    if (!id || !type) return;
      event.preventDefault();
      const url = new URL(window.location.origin + `/admin/messaging/message/${id}`);
    url.searchParams.set('type', type);
    window.location.href = url.toString();
  });
}

 export async function initMessagingList(config = {}) {
  const apiBase = config.apiPublic || window.apiBase || config.apiBase || '';
  const lang = config.lang || window.lang || 'es';
  const labels = config.labels || {};

  const state = {
    currentType: MESSAGE_TYPES.MESSAGES,
    status: 'all',
    search: '',
    page: 1,
    limit: DEFAULT_LIMIT,
  };

  if (!window.apiBase) {
    window.apiBase = apiBase;
  }

  const statusToggle = document.getElementById('messageStatusToggle');
  const resolveStatus = () => {
    if (statusToggle && statusToggle.checked) {
      return state.currentType === MESSAGE_TYPES.MESSAGES ? 'unread' : 'pending';
    }
    return 'all';
  };

  setActiveTab(state.currentType);
  await loadSummary({ apiBase, labels });
  state.status = resolveStatus();
  await loadMessages(state, { apiBase, labels, lang });

  const itemsPerPageSelect = document.getElementById('messagingItemsPerPage');
  if (itemsPerPageSelect) {
    itemsPerPageSelect.value = String(state.limit);
    itemsPerPageSelect.addEventListener('change', async () => {
      const value = Number(itemsPerPageSelect.value);
      if (!Number.isNaN(value) && value > 0) {
        state.limit = value;
        state.page = 1;
        await loadMessages(state, { apiBase, labels, lang });
      }
    });
  }

  const tabContainer = document.getElementById('messageTabs');
  if (tabContainer) {
    tabContainer.addEventListener('click', async (event) => {
      const tab = event.target.closest('.message-tab');
      if (!tab) return;

      const type = tab.dataset.type;
      if (!type || type === state.currentType) return;

      state.currentType = type;
      state.page = 1;
      state.status = resolveStatus();
      setActiveTab(type);
      await loadMessages(state, { apiBase, labels, lang });
    });
  }

  const searchInput = document.getElementById('messageSearchInput');
  if (searchInput) {
    let debounceTimer = null;
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        state.search = searchInput.value.trim();
        state.page = 1;
        await loadMessages(state, { apiBase, labels, lang });
      }, 300);
    });
  }

  if (statusToggle) {
    statusToggle.addEventListener('change', async () => {
      state.status = resolveStatus();
      state.page = 1;
      await loadMessages(state, { apiBase, labels, lang });
    });
  }

  const paginationContainer = document.getElementById('messagePaginationControls');
  if (paginationContainer) {
    paginationContainer.addEventListener('click', async (event) => {
      const button = event.target.closest('button[data-page]');
      if (!button) return;
      const targetPage = Number(button.dataset.page);
      if (!targetPage || targetPage === state.page) return;
      state.page = targetPage;
      await loadMessages(state, { apiBase, labels, lang });
    });
  }

  const tableBody = document.getElementById('messageTableBody');
  if (tableBody) {
    handleNavigation(tableBody);
  }
}

function renderDetailHeader(detail, labels, lang) {
  const typeLabel = document.getElementById('messageDetailType');
  const titleEl = document.getElementById('messageDetailTitle');
  const subtitleEl = document.getElementById('messageDetailSubtitle');
  const timestampEl = document.getElementById('messageDetailTimestamp');

  if (!detail?.item) {
    if (titleEl) titleEl.textContent = labels.missingData || 'Sin datos disponibles';
    return;
  }

  if (typeLabel) {
    const typeKey = detail?.item?.type;
    const translatedType =
      (typeKey && labels?.tabs?.[typeKey]) ||
      (typeKey && labels?.summary?.[typeKey]) ||
      null;
    const fallbackLabel =
      typeKey && typeof typeKey === 'string'
        ? typeKey.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
        : '-';

    typeLabel.textContent = translatedType || fallbackLabel;
  }

  if (titleEl) {
    titleEl.textContent = detail.item.title || '-';
  }

  if (subtitleEl) {
    subtitleEl.textContent = detail.item.description || '';
  }

  if (timestampEl) {
    timestampEl.textContent = formatDate(detail.item.timestamp, lang);
  }
}

function renderDetailMeta(detail, labels, lang) {
  const container = document.getElementById('messageDetailMeta');
  if (!container) return;

  if (!detail?.item) {
    container.innerHTML = `<p class="text-gray-400 dark:text-gray-500">${escapeHtml(
      labels.missingData || 'Sin información'
    )}</p>`;
    return;
  }

  const rows = [];

  if (detail.item.type === MESSAGE_TYPES.MESSAGES && detail.customer) {
    rows.push(
      `<p><span class="font-semibold">${escapeHtml(labels.customerName || 'Cliente')}:</span> ${escapeHtml(
        detail.customer.name || '-'
      )}</p>`
    );
    rows.push(
      `<p><span class="font-semibold">${escapeHtml(labels.customerRut || 'RUT')}:</span> ${escapeHtml(
        detail.customer.rut || '-'
      )}</p>`
    );
    rows.push(
      `<p><span class="font-semibold">${escapeHtml(labels.unreadCount || 'Pendientes')}:</span> ${
        detail.item.unreadCount ?? 0
      }</p>`
    );
  }

  if (detail.item.type === MESSAGE_TYPES.ORDERS && detail.order) {
    const etdValue =
      detail.order.fecha_etd ||
      detail.item?.raw?.fecha_etd ||
      detail.item?.timestamp ||
      detail.order.etd ||
      null;

    rows.push(
      `<p><span class="font-semibold">${escapeHtml(labels.orderPc || 'PC')}:</span> ${escapeHtml(
        detail.order.pc || '-'
      )}</p>`
    );
    rows.push(
      `<p><span class="font-semibold">${escapeHtml(labels.orderOc || 'OC')}:</span> ${escapeHtml(
        detail.order.oc || '-'
      )}</p>`
    );
    rows.push(
      `<p><span class="font-semibold">${escapeHtml(labels.etd || 'ETD')}:</span> ${formatDate(etdValue, lang)}</p>`
    );
  }

  if (detail.item.type === MESSAGE_TYPES.CUSTOMERS && detail.customer) {
    rows.push(
      `<p><span class="font-semibold">${escapeHtml(labels.customerName || 'Cliente')}:</span> ${escapeHtml(
        detail.customer.name || '-'
      )}</p>`
    );
    rows.push(
      `<p><span class="font-semibold">${escapeHtml(labels.customerRut || 'RUT')}:</span> ${escapeHtml(
        detail.customer.rut || '-'
      )}</p>`
    );
    rows.push(
      `<p><span class="font-semibold">${escapeHtml(labels.createdAt || 'Creado')}:</span> ${formatDate(
        detail.customer.created_at,
        lang
      )}</p>`
    );
  }

  container.innerHTML = rows.join('');
}

function renderDetailConversation(detail, labels, lang) {
  const container = document.getElementById('messageDetailConversation');
  if (!container) return;

  if (detail?.item?.type !== MESSAGE_TYPES.MESSAGES) {
    container.innerHTML = `<div class="text-gray-400 dark:text-gray-500">${escapeHtml(
      labels.conversationNotAvailable || 'No aplica'
    )}</div>`;
    return;
  }

  const messages = detail.conversation || [];
  if (!messages.length) {
    container.innerHTML = `<div class="text-gray-400 dark:text-gray-500">${escapeHtml(
      labels.emptyConversation || 'No hay mensajes registrados.'
    )}</div>`;
    return;
  }

  const rows = messages.map((msg) => {
    const sender =
      msg.sender === 'admin'
        ? labels.senderAdmin || 'Admin'
        : msg.sender === 'client'
        ? labels.senderClient || 'Cliente'
        : msg.sender || 'Sistema';

    const isAdmin = msg.sender === 'admin';
    const alignment = isAdmin ? 'justify-end' : 'justify-start';
    const bubbleClasses = isAdmin
      ? 'bg-blue-600 text-white text-right rounded-br-sm rounded-tl-2xl'
      : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-sm rounded-tr-2xl';

    return `
      <div class="flex ${alignment}">
        <div class="max-w-[75%] px-4 py-2 rounded-2xl shadow-sm ${bubbleClasses}">
          <p class="text-xs opacity-80 mb-1">${escapeHtml(sender)} · ${formatDate(msg.createdAt, lang)}</p>
          <p class="leading-5 whitespace-pre-wrap">${escapeHtml(msg.message || '')}</p>
        </div>
      </div>
    `;
  });

  container.innerHTML = rows.join('');
}

function renderDetailSidebar(detail, labels, lang) {
  const docsContainer = document.getElementById('messageDetailDocuments');
  const customerContainer = document.getElementById('messageDetailCustomer');

  if (docsContainer) {
    if (detail?.item?.type === MESSAGE_TYPES.ORDERS && detail.order) {
      const etdValue =
        detail.order.fecha_etd ||
        detail.item?.raw?.fecha_etd ||
        detail.item?.timestamp ||
        detail.order.etd ||
        null;

      docsContainer.innerHTML = `
        <ul class="list-disc list-inside space-y-2">
          <li><strong>${escapeHtml(labels.docsCurrent || 'Documentos cargados')}:</strong> ${
            detail.item.documentCount ?? 0
          }</li>
          <li><strong>${escapeHtml(labels.docsRequired || 'Documentos requeridos')}:</strong> ${
            detail.item.minDocuments ?? 5
          }</li>
          <li><strong>${escapeHtml(labels.etd || 'ETD')}:</strong> ${formatDate(etdValue, lang)}</li>
        </ul>
      `;
    } else {
      docsContainer.innerHTML = `<p class="text-gray-400 dark:text-gray-500">${escapeHtml(
        labels.missingData || 'No disponible'
      )}</p>`;
    }
  }

  if (customerContainer) {
    const customer = detail.customer;
    if (customer) {
      customerContainer.innerHTML = `
        <div class="space-y-2">
          <p><strong>${escapeHtml(labels.customerName || 'Cliente')}:</strong> ${escapeHtml(
            customer.name || '-'
          )}</p>
          <p><strong>${escapeHtml(labels.customerRut || 'RUT')}:</strong> ${escapeHtml(
            customer.rut || '-'
          )}</p>
          <p><strong>${escapeHtml(labels.customerEmail || 'Email')}:</strong> ${escapeHtml(
            customer.email || '-'
          )}</p>
          <p><strong>${escapeHtml(labels.createdAt || 'Creado')}:</strong> ${formatDate(
            customer.created_at,
            lang
          )}</p>
        </div>
      `;
    } else {
      customerContainer.innerHTML = `<p class="text-gray-400 dark:text-gray-500">${escapeHtml(
        labels.missingData || 'No disponible'
      )}</p>`;
    }
  }
}

export async function initMessagingDetail(config = {}) {
  const apiBase = config.apiPublic || window.apiBase || config.apiBase || '';
  const lang = config.lang || window.lang || 'es';
  const labels = config.labels || {};
  const { id, type } = config;

  if (!id) {
    console.warn('Messaging detail: ID no proporcionado');
    return;
  }

  try {
    const data = await fetchJSON(`${apiBase}/api/messages/${type || MESSAGE_TYPES.MESSAGES}/${id}`);
    const detail = data?.data;

    renderDetailHeader(detail, labels, lang);
    renderDetailMeta(detail, labels, lang);
    renderDetailConversation(detail, labels, lang);
    renderDetailSidebar(detail, labels, lang);

    if (typeof window.lucide !== 'undefined') {
      window.lucide.createIcons();
    }
  } catch (error) {
    console.error('Error cargando detalle de mensaje:', error.message);
  }
}
