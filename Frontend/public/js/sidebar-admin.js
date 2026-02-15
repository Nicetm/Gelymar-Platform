// Sidebar Admin JavaScript
import { confirmAction, showNotification, showModal, hideModal, setupModalClose } from './utils.js';

export function initSidebarAdmin(config) {
  const { apiBase, clientApiBase, fileServer, t, token, lang } = config;
  
  // Hacer las variables disponibles globalmente
  window.apiBase = clientApiBase;
  window.fileServer = fileServer;
  window.lang = lang;

  const API_BASE = window.apiBase || apiBase;
  const FILE_SERVER = window.fileServer || fileServer;

  const translations = t || {};
  const adminSettingsTexts = translations.admin_settings || {};
  let currentAdminId = null;
  let currentAdminRut = null;

  function getAdminSetting(key, fallback) {
    const value = adminSettingsTexts[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
    return fallback;
  }

  // Función para obtener el token del cliente
  function getClientToken() {
    let clientToken =
      localStorage.getItem("token")        ||
      localStorage.getItem("accessToken")  ||
      localStorage.getItem("jwt")          ||
      null;

    if (!clientToken) {
      const match = document.cookie.match(/(?:^|; )(?:token|accessToken|jwt)=([^;]+)/);
      clientToken = match ? decodeURIComponent(match[1]) : null;
    }
    
    return clientToken;
  }

  async function fetchAdminSettingsVisibility() {
    try {
      const authToken = token || getClientToken();
      if (!authToken) {
        return null;
      }

      const response = await fetch(`${API_BASE}/api/config/admin-settings/visibility`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      if (!response.ok) {
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error('Error obteniendo visibilidad de los ajustes:', error);
      return null;
    }
  }

  async function applyAdminSettingsVisibility(settingsBtn, settingsDropdown) {
    if (!settingsDropdown) {
      return false;
    }

    const pdfOption = settingsDropdown.querySelector('[data-setting="pdf-mail-list"]');
    const notificationOption = settingsDropdown.querySelector('[data-setting="notification-email-list"]');
    const profileOption = settingsDropdown.querySelector('[data-setting="profile"]');
    const changePasswordOption = settingsDropdown.querySelector('[data-setting="change-password"]');

    const visibility = await fetchAdminSettingsVisibility();

    const pdfEnabled = visibility && Object.prototype.hasOwnProperty.call(visibility, 'pdfMailList')
      ? Boolean(visibility.pdfMailList)
      : true;
    const notificationEnabled = visibility && Object.prototype.hasOwnProperty.call(visibility, 'notificationEmailList')
      ? Boolean(visibility.notificationEmailList)
      : true;
    const profileEnabled = visibility && Object.prototype.hasOwnProperty.call(visibility, 'profile')
      ? Boolean(visibility.profile)
      : true;

    if (pdfOption) {
      if (pdfEnabled) {
        pdfOption.classList.remove('hidden');
        pdfOption.style.display = '';
      } else {
        pdfOption.classList.add('hidden');
        pdfOption.style.display = 'none';
      }
    }

    if (notificationOption) {
      if (notificationEnabled) {
        notificationOption.classList.remove('hidden');
        notificationOption.style.display = '';
      } else {
        notificationOption.classList.add('hidden');
        notificationOption.style.display = 'none';
      }
    }

    if (profileOption) {
      if (profileEnabled) {
        profileOption.classList.remove('hidden');
        profileOption.style.display = '';
      } else {
        profileOption.classList.add('hidden');
        profileOption.style.display = 'none';
      }
    }

    if (changePasswordOption) {
      changePasswordOption.classList.remove('hidden');
      changePasswordOption.style.display = '';
    }

    const hasVisibleSettings =
      (!!pdfOption && pdfEnabled) ||
      (!!notificationOption && notificationEnabled) ||
      (!!profileOption && profileEnabled) ||
      !!changePasswordOption;

    if (settingsBtn) {
      if (hasVisibleSettings) {
        settingsBtn.classList.remove('hidden');
        settingsBtn.style.display = '';
      } else {
        settingsBtn.classList.add('hidden');
        settingsBtn.style.display = 'none';
      }
    }

    settingsDropdown.classList.add('hidden');
    settingsDropdown.style.display = 'none';

    return hasVisibleSettings;
  }

  async function loadAdminData() {
    try {
      const res = await fetch(`${API_BASE}/api/users/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const u = await res.json();
      currentAdminId = Number(u?.id ?? u?.user_id ?? u?.userId ?? null);
      currentAdminRut = u?.rut ?? u?.RUT ?? null;

      if (u.full_name)  document.getElementById("adminNameInput").value  = u.full_name;
      if (u.email)      document.getElementById("adminEmailInput").value = u.email;
      if (u.phone)      document.getElementById("adminPhoneInput").value = u.phone;
      if (u.address)    document.getElementById("adminAddressInput").value = u.address;
      if (u.city)       document.getElementById("adminCityInput").value = u.city;
      if (u.country)    document.getElementById("adminCountryInput").value = u.country;

      if (u.avatar_path) {
        const avatarUrl = `${FILE_SERVER}/${u.avatar_path}`;
        document.getElementById("adminAvatarLight").src = avatarUrl;
        document.getElementById("adminAvatarDark").src  = avatarUrl;
      } else if (u.full_name) {
        const seed = encodeURIComponent(u.full_name);
        document.getElementById("adminAvatarLight").src =
          `https://api.dicebear.com/7.x/initials/svg?seed=${seed}&backgroundColor=4b5563&fontColor=ffffff`;
        document.getElementById("adminAvatarDark").src  =
          `https://api.dicebear.com/7.x/initials/svg?seed=${seed}&backgroundColor=1e293b&fontColor=ffffff`;
      }
    } catch (err) {
      console.error("No se pudo cargar el perfil del admin:", err);
    }
  }

    function validateForm() {
      const name  = document.getElementById("adminNameInput").value.trim();
      const phone = document.getElementById("adminPhoneInput").value.trim();
      if (!name || !phone) {
        showNotification(getAdminSetting('name_and_phone_required', 'Nombre y teléfono son obligatorios'), 'error');
        return false;
      }
      return true;
    }

  // Inicialización cuando el DOM está listo
  document.addEventListener("DOMContentLoaded", async () => {
    await loadAdminData();

    // Sidebar collapse
    const sidebar = document.getElementById('sidebar');
    const rootEl = document.documentElement;
    const collapseBtn = document.getElementById('toggleSidebarCollapse');
    const sidebarUser = document.querySelector('[data-sidebar-user]');
    const footerRow = document.querySelector('[data-sidebar-footer-row]');
    const sidebarTexts = sidebar ? sidebar.querySelectorAll('[data-sidebar-text]') : [];
    const sidebarLinks = sidebar ? sidebar.querySelectorAll('.sidebar-link') : [];

    const applySidebarCollapsed = (collapsed) => {
      if (!sidebar) return;
      if (rootEl) {
        rootEl.classList.toggle('sidebar-collapsed', collapsed);
      }
      sidebar.classList.toggle('w-20', collapsed);
      sidebar.classList.toggle('w-56', !collapsed);
      sidebar.classList.toggle('sidebar-collapsed', collapsed);

      if (sidebarUser) {
        sidebarUser.classList.toggle('hidden', collapsed);
      }

      sidebarTexts.forEach((node) => {
        node.classList.toggle('hidden', collapsed);
      });

      sidebarLinks.forEach((link) => {
        link.classList.toggle('justify-center', collapsed);
        link.classList.toggle('gap-3', !collapsed);
        link.classList.toggle('px-4', !collapsed);
        link.classList.toggle('px-3', collapsed);
      });

      if (footerRow) {
        footerRow.classList.toggle('flex-col', collapsed);
        footerRow.classList.toggle('gap-3', collapsed);
        footerRow.classList.toggle('gap-2', !collapsed);
      }
    };

    if (collapseBtn) {
      const stored = localStorage.getItem('sidebarCollapsed');
      const initialCollapsed = rootEl?.classList.contains('sidebar-collapsed') || stored === '1';
      applySidebarCollapsed(initialCollapsed);

      collapseBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const isCollapsed = sidebar?.classList.contains('sidebar-collapsed');
        const next = !isCollapsed;
        applySidebarCollapsed(next);
        localStorage.setItem('sidebarCollapsed', next ? '1' : '0');
        document.cookie = `sidebarCollapsed=${next ? '1' : '0'}; path=/; max-age=31536000`;
      });
    }

    // Highlight active page in sidebar
    const path = window.location.pathname;
    document.querySelectorAll("#sidebar a[href]").forEach(link => {
      const href = link.getAttribute("href");
      if (href && (path === href || path.startsWith(href + "/"))) {
        link.classList.add("active");
      }
    });

    // DOM references
    const settingsBtn = document.getElementById("currentSettingsBtn");
    const settingsDropdown = document.getElementById("settings-dropdown");
    let hasVisibleSettings = false;

    if (settingsBtn && settingsDropdown) {
      hasVisibleSettings = await applyAdminSettingsVisibility(settingsBtn, settingsDropdown);
    }

    if (settingsBtn && settingsDropdown && hasVisibleSettings) {
      settingsBtn.onclick = function(e) {
        e.preventDefault();
        
        const isVisible = settingsDropdown.style.display === 'block';
        
        if (!isVisible) {
          settingsDropdown.style.display = 'block';
          settingsDropdown.classList.remove('hidden');
          
          const chevron = settingsBtn.querySelector('i[data-lucide="chevron-up"]');
          if (chevron) {
            chevron.style.transform = 'rotate(180deg)';
          }
        } else {
          settingsDropdown.classList.add('hidden');
          settingsDropdown.style.display = 'none';
          
          const chevron = settingsBtn.querySelector('i[data-lucide="chevron-up"]');
          if (chevron) {
            chevron.style.transform = 'rotate(0deg)';
          }
        }
      };
      
      document.addEventListener('click', function(e) {
        if (!settingsBtn.contains(e.target) && (!settingsDropdown || !settingsDropdown.contains(e.target))) {
          settingsDropdown.classList.add('hidden');
          settingsDropdown.style.display = 'none';
          
          const chevron = settingsBtn.querySelector('i[data-lucide="chevron-up"]');
          if (chevron) {
            chevron.style.transform = 'rotate(0deg)';
          }
        }
      });
    }

    document.addEventListener('click', function(e) {
      if (!hasVisibleSettings) {
        return;
      }

      const option = e.target.closest('.settings-option');
      if (!option || option.classList.contains('hidden') || option.style.display === 'none') {
        return;
      }

      e.preventDefault();
      const setting = option.dataset.setting;
      
      if (settingsDropdown) {
        settingsDropdown.classList.add('hidden');
        settingsDropdown.style.display = 'none';
      }
      
      if (settingsBtn) {
        const chevron = settingsBtn.querySelector('i[data-lucide="chevron-up"]');
        if (chevron) {
          chevron.style.transform = 'rotate(0deg)';
        }
      }
      
      switch(setting) {
        case 'pdf-mail-list':
          openPdfMailModal();
          break;
        case 'notification-email-list':
          openNotificationEmailModal();
          break;
        case 'profile':
          openAdminSettingsModal();
          break;
        case 'admin-users':
          openAdminUsersModal();
          break;
        case 'change-password':
          openAdminChangePasswordModal();
          break;
      }
    });

    const adminSettingsModal = document.getElementById('adminSettingsModal');
    const closeAdminSettingsBtn = document.getElementById('closeAdminSettings');
    const cancelAdminEditBtn = document.getElementById('cancelAdminEdit');
    const adminSettingsForm = document.getElementById('adminSettingsForm');
    const adminAvatarInput = document.getElementById('adminAvatarInput');
    const adminAvatarLight = document.getElementById('adminAvatarLight');
    const adminAvatarDark = document.getElementById('adminAvatarDark');
    const adminAvatarDrop = document.getElementById('adminAvatarDrop');
    const adminAvatarPresets = document.querySelectorAll('[data-avatar-preset]');
    let pendingAvatarFile = null;
    let pendingAvatarUrl = null;

    setupModalClose('#adminSettingsModal', '#closeAdminSettings, #cancelAdminEdit');

    async function openAdminSettingsModal() {
      await loadAdminData();
      showModal('#adminSettingsModal');
    }

    async function uploadAdminAvatar(file, authToken) {
      if (!file) return { ok: true };
      const formData = new FormData();
      formData.append('avatar', file);
      const response = await fetch(`${API_BASE}/api/users/avatar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
        body: formData
      });

      if (!response.ok) {
        let message = getAdminSetting('avatar_error_generic', 'Error al subir avatar');
        try {
          const errorBody = await response.json();
          const code = errorBody?.code;
          if (code === 'AVATAR_TOO_LARGE') {
            message = getAdminSetting('avatar_error_too_large', 'La imagen es muy pesada. Tamaño máximo 5MB');
          } else if (code === 'AVATAR_INVALID_TYPE') {
            message = getAdminSetting('avatar_error_type', 'Solo se permiten archivos JPG o PNG');
          } else if (code === 'AVATAR_MISSING') {
            message = getAdminSetting('avatar_error_missing', 'Debe seleccionar una imagen');
          } else if (errorBody?.message) {
            message = errorBody.message;
          }
        } catch (e) {
          // ignore parse errors
        }
        return { ok: false, message };
      }

      const data = await response.json().catch(() => ({}));
      return { ok: true, avatarPath: data?.avatar_path || null };
    }

    async function fetchPresetAsFile(url) {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch preset avatar');
      const blob = await res.blob();
      return new File([blob], 'avatar.png', { type: blob.type || 'image/png' });
    }

    function setAvatarPreview(url) {
      if (adminAvatarLight) adminAvatarLight.src = url;
      if (adminAvatarDark) adminAvatarDark.src = url;
    }

    async function saveAdminSettings() {
      const authToken = token || getClientToken();
      if (!authToken) {
        showNotification(getAdminSetting('error_saving_changes', 'Error al guardar los cambios'), 'error');
        return;
      }

      if (!validateForm()) return;
      clearAdminFieldErrors();

      const payload = {
        full_name: document.getElementById("adminNameInput").value.trim(),
        phone: document.getElementById("adminPhoneInput").value.trim(),
        address: document.getElementById("adminAddressInput")?.value?.trim() || null,
        city: document.getElementById("adminCityInput")?.value?.trim() || null,
        country: document.getElementById("adminCountryInput")?.value?.trim() || null
      };

      const inputFile = adminAvatarInput?.files?.[0] || null;
      let avatarFile = pendingAvatarFile || inputFile || null;
      let avatarPath = null;

      try {
        if (!avatarFile && pendingAvatarUrl) {
          avatarFile = await fetchPresetAsFile(pendingAvatarUrl);
        }

        if (avatarFile) {
          const uploadResult = await uploadAdminAvatar(avatarFile, authToken);
          if (!uploadResult?.ok) {
            showNotification(uploadResult?.message || getAdminSetting('error_saving_changes', 'Error al guardar los cambios'), 'error');
            return;
          }
          if (uploadResult.avatarPath) {
            avatarPath = uploadResult.avatarPath;
          }
        }

        const response = await fetch(`${API_BASE}/api/users/profile`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          let errorMessage = getAdminSetting('error_saving_changes', 'Error al guardar los cambios');
          try {
            const errorBody = await response.json();
            if (errorBody?.message) {
              errorMessage =
                errorBody.message === 'Datos de entrada inválidos'
                  ? getAdminSetting('validation_error', 'Datos de entrada inválidos')
                  : errorBody.message;
            }
            let firstFieldMessage = null;
            if (errorBody?.errors && Array.isArray(errorBody.errors)) {
              errorBody.errors.forEach((err) => {
                if (err?.field) applyAdminFieldError(err.field, err.message);
                if (!firstFieldMessage && err?.message) {
                  firstFieldMessage = mapAdminValidationMessage(err.message);
                }
              });
            }
            if (firstFieldMessage) {
              errorMessage = `${errorMessage}: ${firstFieldMessage}`;
            }
          } catch (e) {
            // ignore parse errors
          }
          showNotification(errorMessage, 'error');
          return;
        }

        showNotification(getAdminSetting('data_updated_successfully', 'Datos actualizados correctamente'), 'success');
        if (avatarPath) {
          const headerAvatar = document.getElementById('userAvatar');
          if (headerAvatar) {
            headerAvatar.src = `${FILE_SERVER}/${avatarPath}`;
          }
          try {
            const storedProfileRaw = localStorage.getItem('userProfile');
            const storedProfile = storedProfileRaw ? JSON.parse(storedProfileRaw) : {};
            localStorage.setItem('userProfile', JSON.stringify({
              ...storedProfile,
              fullName: payload.full_name || storedProfile.fullName,
              avatarPath
            }));
          } catch (e) {
            // ignore localStorage errors
          }
        }
        pendingAvatarFile = null;
        pendingAvatarUrl = null;
        await loadAdminData();
        hideModal('#adminSettingsModal');
      } catch (error) {
        console.error('Error guardando perfil del admin:', error);
        showNotification(getAdminSetting('error_saving_changes', 'Error al guardar los cambios'), 'error');
      }
    }

    if (adminSettingsForm) {
      adminSettingsForm.addEventListener('submit', (e) => {
        e.preventDefault();
        saveAdminSettings();
      });
    }

    if (adminAvatarInput) {
      adminAvatarInput.addEventListener('change', () => {
        const file = adminAvatarInput.files?.[0];
        if (!file) return;
        const previewUrl = URL.createObjectURL(file);
        pendingAvatarFile = file;
        pendingAvatarUrl = null;
        setAvatarPreview(previewUrl);
      });
    }

    if (adminAvatarDrop) {
      adminAvatarDrop.addEventListener('click', () => {
        adminAvatarInput?.click();
      });
      adminAvatarDrop.addEventListener('dragover', (e) => {
        e.preventDefault();
        adminAvatarDrop.classList.add('border-blue-400');
      });
      adminAvatarDrop.addEventListener('dragleave', () => {
        adminAvatarDrop.classList.remove('border-blue-400');
      });
      adminAvatarDrop.addEventListener('drop', (e) => {
        e.preventDefault();
        adminAvatarDrop.classList.remove('border-blue-400');
        const file = e.dataTransfer?.files?.[0];
        if (!file) return;
        pendingAvatarFile = file;
        pendingAvatarUrl = null;
        if (adminAvatarInput) adminAvatarInput.value = '';
        const previewUrl = URL.createObjectURL(file);
        setAvatarPreview(previewUrl);
      });
    }

    adminAvatarPresets.forEach((btn) => {
      btn.addEventListener('click', () => {
        const url = btn.getAttribute('data-avatar-preset');
        if (!url) return;
        pendingAvatarUrl = url;
        pendingAvatarFile = null;
        if (adminAvatarInput) adminAvatarInput.value = '';
        setAvatarPreview(url);
      });
    });

    function clearAdminFieldErrors() {
      const fields = [
        { input: 'adminNameInput', error: 'adminNameError' },
        { input: 'adminPhoneInput', error: null },
        { input: 'adminAddressInput', error: 'adminAddressError' },
        { input: 'adminCityInput', error: 'adminCityError' },
        { input: 'adminCountryInput', error: 'adminCountryError' }
      ];
      fields.forEach(({ input, error }) => {
        const inputEl = document.getElementById(input);
        const errorEl = error ? document.getElementById(error) : null;
        if (inputEl) {
          inputEl.classList.remove('border-rose-500', 'ring-1', 'ring-rose-500');
        }
        if (errorEl) {
          errorEl.textContent = '';
          errorEl.classList.add('hidden');
        }
      });
    }

    function applyAdminFieldError(field, message) {
      const map = {
        full_name: { input: 'adminNameInput', error: 'adminNameError' },
        phone: { input: 'adminPhoneInput', error: null },
        address: { input: 'adminAddressInput', error: 'adminAddressError' },
        city: { input: 'adminCityInput', error: 'adminCityError' },
        country: { input: 'adminCountryInput', error: 'adminCountryError' }
      };
      const entry = map[field];
      if (!entry) return;
      const inputEl = document.getElementById(entry.input);
      const errorEl = entry.error ? document.getElementById(entry.error) : null;
      if (inputEl) {
        inputEl.classList.add('border-rose-500', 'ring-1', 'ring-rose-500');
      }
      if (errorEl) {
        errorEl.textContent = mapAdminValidationMessage(message) || getAdminSetting('validation_error', 'Datos de entrada inválidos');
        errorEl.classList.remove('hidden');
      }
    }

    function mapAdminValidationMessage(message) {
      if (!message) return message;
      if (message === 'Teléfono debe tener entre 8 y 20 caracteres') {
        return getAdminSetting('phone_invalid', message);
      }
      if (message === 'Nombre debe tener entre 2 y 100 caracteres') {
        return getAdminSetting('name_invalid', message);
      }
      return message;
    }

    if (cancelAdminEditBtn) {
      cancelAdminEditBtn.addEventListener('click', (e) => {
        e.preventDefault();
        hideModal('#adminSettingsModal');
      });
    }

    // PDF Mail List Modal
    const pdfMailModal = document.getElementById('pdfMailListModal');
    const closePdfMailModalBtn = document.getElementById('closePdfMailModal');
    const cancelPdfMailBtn = document.getElementById('cancelPdfMailBtn');
    const addEmailBtn = document.getElementById('addEmailBtn');
    const savePdfMailBtn = document.getElementById('savePdfMailBtn');
    const emailFormContainer = document.getElementById('emailFormContainer');
    const existingEmailsTable = document.getElementById('existingEmailsTable');
    const changePasswordModal = document.getElementById('adminChangePasswordModal');
    const saveAdminPasswordBtn = document.getElementById('saveAdminPasswordBtn');
    const currentPasswordInput = document.getElementById('adminCurrentPassword');
    const newPasswordInput = document.getElementById('adminNewPassword');
    const confirmPasswordInput = document.getElementById('adminConfirmPassword');
    const adminPasswordRules = document.getElementById('adminPasswordRules');

    let pdfEmails = [];

    // Abrir modal PDF Mail List
    async function openPdfMailModal() {
      try {
        const response = await fetch(`${API_BASE}/api/config/pdf-mail-list`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await response.json();
        pdfEmails = data.emails || [];
        renderPdfExistingEmailsTable();
        renderPdfEmailForm();
        showModal('#pdfMailListModal');
      } catch (error) {
        console.error('Error cargando emails:', error);
        pdfEmails = [];
        renderPdfExistingEmailsTable();
        renderPdfEmailForm();
        showModal('#pdfMailListModal');
      }
    }

    // Cerrar modal
    function closePdfMailModal() {
      hideModal('#pdfMailListModal');
    }

    function updatePdfAddButtonState() {
      const addBtn = document.getElementById('savePdfMailBtn');
      const tableBody = document.getElementById('pdfMailFormTableBody');
      const hasRows = tableBody ? tableBody.querySelector('tr') : null;
      if (!addBtn) return;
      addBtn.disabled = !hasRows;
      addBtn.classList.toggle('opacity-50', !hasRows);
      addBtn.classList.toggle('cursor-not-allowed', !hasRows);
    }

    function ensurePdfFormTable() {
      const container = document.getElementById('emailFormContainer');
      if (!container) return null;
      let tableBody = document.getElementById('pdfMailFormTableBody');
      if (!tableBody) {
        const template = document.getElementById('pdfMailFormTableTemplate');
        if (!template) return null;
        const fragment = document.importNode(template.content, true);
        container.appendChild(fragment);
        tableBody = document.getElementById('pdfMailFormTableBody');
      }
      return tableBody;
    }

    // Renderizar lista de pdfEmails existentes en tabla
    function renderPdfExistingEmailsTable() {
      const template = document.getElementById('pdfMailExistingTableTemplate');
      if (!template) return;

      if (pdfEmails.length === 0) {
        existingEmailsTable.innerHTML = '<p class="text-gray-500 dark:text-gray-400 text-center py-4">No hay emails configurados</p>';
        return;
      }

      const fragment = document.importNode(template.content, true);
      const tableBody = fragment.querySelector('#pdfMailExistingTableBody');

      pdfEmails.forEach((email, index) => {
        const row = document.createElement('tr');
        row.className = 'border-t border-gray-200 dark:border-gray-600';
        row.innerHTML = `
          <td class="p-2 font-medium text-gray-900 dark:text-white">${email.name}</td>
          <td class="p-2 text-sm text-gray-500 dark:text-gray-400">${email.email}</td>
          <td class="p-2 text-center">
            <button class="remove-existing-email text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300 transition" data-index="${index}">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </td>
        `;
        tableBody?.appendChild(row);
      });

      existingEmailsTable.innerHTML = '';
      existingEmailsTable.appendChild(fragment);
    }

    function renderPdfEmailForm() {
      emailFormContainer.innerHTML = '';
      updatePdfAddButtonState();
    }

    function addPdfEmail() {
      const tableBody = ensurePdfFormTable();
      if (!tableBody) return;

      const row = document.createElement('tr');
      row.className = 'border-t border-gray-200 dark:border-gray-600';
      row.innerHTML = `
        <td class="p-2">
          <input type="text" placeholder="Nombre" class="text-xs new-email-name w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
        </td>
        <td class="p-2">
          <input type="email" placeholder="Email" class="text-xs new-email-email w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
        </td>
        <td class="p-2 text-center">
          <button class="remove-new-email text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300 transition">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </td>
      `;

      tableBody.appendChild(row);
      updatePdfAddButtonState();
    }

    // Remover email existente
    async function removePdfExistingEmail(index) {
      const email = pdfEmails[index];
      const confirmed = await confirmAction(
        getAdminSetting('confirmDeleteTitle', 'Delete email?'),
        `${getAdminSetting('confirmDeleteMessage', 'The email will be removed')}: ${email.name} (${email.email})`,
        'warning'
      );
      if (confirmed) {
        pdfEmails.splice(index, 1);
        renderPdfExistingEmailsTable();
        // Guardar cambios en BD
        await savePdfEmailsToDB();
      }
    }

    // Guardar pdfEmails en BD sin confirmación
    async function savePdfEmailsToDB() {
      try {
        const response = await fetch(`${API_BASE}/api/config/pdf-mail-list`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getClientToken()}`
          },
          body: JSON.stringify({ emails: pdfEmails })
        });

        if (response.ok) {
          showNotification(getAdminSetting('saveSuccess', 'Email list updated successfully'), 'success');
        } else {
          throw new Error('Error al guardar');
        }
      } catch (error) {
        console.error('Error guardando emails:', error);
        showNotification(getAdminSetting('saveError', 'Error saving email list'), 'error');
      }
    }

    // Guardar pdfEmails
    async function savePdfEmails() {
      const confirmed = await confirmAction(
        getAdminSetting('confirmSaveTitle', 'Save changes?'),
        getAdminSetting('confirmSaveMessage', 'Email list will be updated.'),
        'success'
      );
      
      if (!confirmed) return;
      
      try {
        // Recopilar datos del formulario de nuevos pdfEmails
        const newEmailInputs = emailFormContainer.querySelectorAll('.new-email-name, .new-email-email');
        const newEmails = [];
        
        for (let i = 0; i < newEmailInputs.length; i += 2) {
          const nameInput = newEmailInputs[i];
          const emailInput = newEmailInputs[i + 1];
          
          if (nameInput.value.trim() && emailInput.value.trim()) {
            newEmails.push({
              name: nameInput.value.trim(),
              email: emailInput.value.trim()
            });
          }
        }

        // Combinar pdfEmails existentes con nuevos
        const updatedEmails = [...pdfEmails, ...newEmails];

        const response = await fetch(`${API_BASE}/api/config/pdf-mail-list`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getClientToken()}`
          },
          body: JSON.stringify({ emails: updatedEmails })
        });

        if (response.ok) {
          showNotification(getAdminSetting('saveSuccess', 'Email list updated successfully'), 'success');
          pdfEmails = updatedEmails;
          renderPdfExistingEmailsTable();
          renderPdfEmailForm();
        } else {
          throw new Error('Error al guardar');
        }
      } catch (error) {
        console.error('Error guardando emails:', error);
        showNotification(getAdminSetting('saveError', 'Error saving email list'), 'error');
      }
    }

    // Notification Email List Modal
    const notificationEmailModal = document.getElementById('notificationEmailListModal');
    const closeNotificationEmailModalBtn = document.getElementById('closeNotificationEmailModal');
    const cancelNotificationEmailBtn = document.getElementById('cancelNotificationEmailBtn');
    const addNotificationEmailBtn = document.getElementById('addNotificationEmailBtn');
    const saveNotificationEmailBtn = document.getElementById('saveNotificationEmailBtn');
    const notificationEmailFormContainer = document.getElementById('notificationEmailFormContainer');
    const notificationExistingEmailsTable = document.getElementById('notificationExistingEmailsTable');

    let notificationEmails = [];

    async function openNotificationEmailModal() {
      try {
        const response = await fetch(`${API_BASE}/api/config/notification-email-list`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await response.json();
        notificationEmails = data.emails || [];
        renderNotificationExistingEmailsTable();
        renderNotificationEmailForm();
        showModal('#notificationEmailListModal');
      } catch (error) {
        console.error('Error cargando emails de notificación:', error);
        notificationEmails = [];
        renderNotificationExistingEmailsTable();
        renderNotificationEmailForm();
        showModal('#notificationEmailListModal');
      }
    }

    function closeNotificationEmailModal() {
      hideModal('#notificationEmailListModal');
    }

    setupModalClose('#pdfMailListModal', '#closePdfMailModal, #cancelPdfMailBtn');
    setupModalClose('#notificationEmailListModal', '#closeNotificationEmailModal, #cancelNotificationEmailBtn');

    function renderNotificationExistingEmailsTable() {
      const template = document.getElementById('notificationEmailExistingTableTemplate');
      if (!template) return;

      if (notificationEmails.length === 0) {
        notificationExistingEmailsTable.innerHTML = '<p class="text-gray-500 dark:text-gray-400 text-center py-4">No hay emails configurados</p>';
        return;
      }

      const fragment = document.importNode(template.content, true);
      const tableBody = fragment.querySelector('#notificationEmailExistingTableBody');

      notificationEmails.forEach((email, index) => {
        const row = document.createElement('tr');
        row.className = 'border-t border-gray-200 dark:border-gray-600';
        row.innerHTML = `
          <td class="p-2 font-medium text-gray-900 dark:text-white">${email.email}</td>
          <td class="p-2 text-sm text-gray-500 dark:text-gray-400">${email.name}</td>
          <td class="p-2 text-center">
            <button class="remove-existing-notification-email text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300 transition" data-index="${index}">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </td>
        `;
        tableBody?.appendChild(row);
      });

      notificationExistingEmailsTable.innerHTML = '';
      notificationExistingEmailsTable.appendChild(fragment);
    }

    function updateNotificationAddButtonState() {
      const addBtn = document.getElementById('saveNotificationEmailBtn');
      const tableBody = document.getElementById('notificationEmailFormTableBody');
      const hasRows = tableBody ? tableBody.querySelector('tr') : null;
      if (!addBtn) return;
      addBtn.disabled = !hasRows;
      addBtn.classList.toggle('opacity-50', !hasRows);
      addBtn.classList.toggle('cursor-not-allowed', !hasRows);
    }

    function ensureNotificationFormTable() {
      const container = document.getElementById('notificationEmailFormContainer');
      if (!container) return null;
      let tableBody = document.getElementById('notificationEmailFormTableBody');
      if (!tableBody) {
        const template = document.getElementById('notificationEmailFormTableTemplate');
        if (!template) return null;
        const fragment = document.importNode(template.content, true);
        container.appendChild(fragment);
        tableBody = document.getElementById('notificationEmailFormTableBody');
      }
      return tableBody;
    }

    function renderNotificationEmailForm() {
      notificationEmailFormContainer.innerHTML = '';
      updateNotificationAddButtonState();
    }

    function addNotificationEmail() {
      const tableBody = ensureNotificationFormTable();
      if (!tableBody) return;

      const row = document.createElement('tr');
      row.className = 'border-t border-gray-200 dark:border-gray-600';
      row.innerHTML = `
        <td class="p-2">
          <input type="email" placeholder="Email" class="text-xs new-email-email w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
        </td>
        <td class="p-2">
          <input type="text" placeholder="Nombre" class="text-xs new-email-name w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
        </td>
        <td class="p-2 text-center">
          <button class="remove-new-email text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300 transition">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </td>
      `;

      tableBody.appendChild(row);
      updateNotificationAddButtonState();
    }

    async function removeNotificationExistingEmail(index) {
      const email = notificationEmails[index];
      const confirmed = await confirmAction(
        getAdminSetting('confirmDeleteTitle', 'Delete email?'),
        `${getAdminSetting('confirmDeleteMessage', 'The email will be removed')}: ${email.name} (${email.email})`,
        'warning'
      );
      if (confirmed) {
        notificationEmails.splice(index, 1);
        renderNotificationExistingEmailsTable();
        await saveNotificationEmailsToDB();
      }
    }

    async function saveNotificationEmailsToDB() {
      try {
        const response = await fetch(`${API_BASE}/api/config/notification-email-list`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getClientToken()}`
          },
          body: JSON.stringify({ emails: notificationEmails })
        });

        if (response.ok) {
          showNotification(getAdminSetting('saveSuccess', 'Email list updated successfully'), 'success');
        } else {
          throw new Error('Error al guardar');
        }
      } catch (error) {
        console.error('Error guardando emails:', error);
        showNotification(getAdminSetting('saveError', 'Error saving email list'), 'error');
      }
    }

    async function saveNotificationEmails() {
      const confirmed = await confirmAction(
        getAdminSetting('confirmSaveTitle', 'Save changes?'),
        getAdminSetting('confirmSaveMessageNotification', 'Notification email list will be updated.'),
        'success'
      );

      if (!confirmed) return;

      try {
        const newEmailInputs = notificationEmailFormContainer.querySelectorAll('.new-email-name, .new-email-email');
        const newEmails = [];

        for (let i = 0; i < newEmailInputs.length; i += 2) {
          const nameInput = newEmailInputs[i];
          const emailInput = newEmailInputs[i + 1];

          if (nameInput.value.trim() && emailInput.value.trim()) {
            newEmails.push({
              name: nameInput.value.trim(),
              email: emailInput.value.trim()
            });
          }
        }

        const updatedEmails = [...notificationEmails, ...newEmails];

        const response = await fetch(`${API_BASE}/api/config/notification-email-list`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getClientToken()}`
          },
          body: JSON.stringify({ emails: updatedEmails })
        });

        if (response.ok) {
          showNotification(getAdminSetting('saveSuccess', 'Email list updated successfully'), 'success');
          notificationEmails = updatedEmails;
          renderNotificationExistingEmailsTable();
          renderNotificationEmailForm();
        } else {
          throw new Error('Error al guardar');
        }
      } catch (error) {
        console.error('Error guardando emails:', error);
        showNotification(getAdminSetting('saveError', 'Error saving email list'), 'error');
      }
    }

    // Event listeners
    if (closePdfMailModalBtn) {
      closePdfMailModalBtn.addEventListener('click', closePdfMailModal);
    }
    if (cancelPdfMailBtn) {
      cancelPdfMailBtn.addEventListener('click', closePdfMailModal);
    }

    if (closeNotificationEmailModalBtn) {
      closeNotificationEmailModalBtn.addEventListener('click', closeNotificationEmailModal);
    }

    if (cancelNotificationEmailBtn) {
      cancelNotificationEmailBtn.addEventListener('click', closeNotificationEmailModal);
    }
    
    if (addEmailBtn) {
      addEmailBtn.addEventListener('click', (e) => {
        e.preventDefault();
        addPdfEmail();
      });
    }

    if (savePdfMailBtn) {
      savePdfMailBtn.addEventListener('click', (e) => {
        e.preventDefault();
        savePdfEmails();
      });
    }

    if (addNotificationEmailBtn) {
      addNotificationEmailBtn.addEventListener('click', (e) => {
        e.preventDefault();
        addNotificationEmail();
      });
    }

    if (saveNotificationEmailBtn) {
      saveNotificationEmailBtn.addEventListener('click', (e) => {
        e.preventDefault();
        saveNotificationEmails();
      });
    }

    // Cerrar modal al hacer click fuera
    pdfMailModal.addEventListener('click', (e) => {
      if (e.target === pdfMailModal) {
        closePdfMailModal();
      }
    });

    if (notificationEmailModal) {
      notificationEmailModal.addEventListener('click', (e) => {
        if (e.target === notificationEmailModal) {
          closeNotificationEmailModal();
        }
      });
    }

    // Event delegation para eliminar filas dinámicas
    document.addEventListener('click', (e) => {
      const removeNewBtn = e.target.closest('.remove-new-email');
      if (removeNewBtn) {
        e.preventDefault();
        e.stopPropagation();
        const row = removeNewBtn.closest('tr') || removeNewBtn.closest('div');
        if (row) {
          const tableBody = row.parentElement;
          row.remove();
          if (tableBody && !tableBody.querySelector('tr')) {
            const table = tableBody.closest('table');
            if (table) {
              table.remove();
            }
          }
        }
        updatePdfAddButtonState();
        updateNotificationAddButtonState();
        return;
      }

      const removePdfBtn = e.target.closest('.remove-existing-email');
      if (removePdfBtn) {
        e.preventDefault();
        e.stopPropagation();
        const index = parseInt(removePdfBtn.dataset.index, 10);
        if (!Number.isNaN(index)) {
          removePdfExistingEmail(index);
        }
        return;
      }

      const removeNotificationBtn = e.target.closest('.remove-existing-notification-email');
      if (removeNotificationBtn) {
        e.preventDefault();
        e.stopPropagation();
        const index = parseInt(removeNotificationBtn.dataset.index, 10);
        if (!Number.isNaN(index)) {
          removeNotificationExistingEmail(index);
        }
      }
    });

    // Submenu toggles
    document.querySelectorAll("[data-collapse-toggle]").forEach(btn => {
      const targetId = btn.getAttribute("data-collapse-toggle");
      const target   = targetId ? document.getElementById(targetId) : null;
      if (!target) return;

      btn.addEventListener("click", () => {
        target.classList.toggle("hidden");
        btn.querySelector("[data-lucide='chevron-down']")?.classList.toggle("rotate-180");
      });
    });

    // Language dropdown toggle
    const langBtn = document.getElementById('currentLangBtn');
    const langDropdown = document.getElementById('language-dropdown');
    
    if (langBtn && langDropdown) {
      // Forzar estado inicial
      langDropdown.classList.add('hidden');
      langDropdown.style.display = 'none';
      
      langBtn.onclick = function(e) {
        e.preventDefault();
        
        const isHidden = langDropdown.style.display === 'none';
        
        if (isHidden) {
          // Mostrar dropdown
          langDropdown.style.display = 'block';
          langDropdown.classList.remove('hidden');
        } else {
          // Ocultar dropdown
          langDropdown.style.display = 'none';
          langDropdown.classList.add('hidden');
        }
      };
      
      // Close when clicking outside
      document.onclick = function(e) {
        if (!langBtn.contains(e.target) && !langDropdown.contains(e.target)) {
          langDropdown.classList.add('hidden');
          langDropdown.style.display = 'none';
        }
      };
    }

    // Language change
    function updateCurrentLangFlag() {
      const currentLang = localStorage.getItem('lang') || lang;
      const flagElement = document.getElementById('currentLangFlag');
      const textElement = document.getElementById('currentLangText');
      const chevronElement = document.querySelector('#currentLangBtn i[data-lucide=\"chevron-up\"]');
      
      if (flagElement) {
        flagElement.src = currentLang === 'es' ? 'https://flagcdn.com/w20/cl.png' : 'https://flagcdn.com/w20/us.png';
        flagElement.alt = currentLang === 'es' ? 'Chile Flag' : 'US Flag';
      }
      if (textElement) {
        textElement.textContent = currentLang === 'es' ? 'ES' : 'EN';
      }
      
      if (chevronElement) {
        chevronElement.style.transform = 'rotate(180deg)';
        setTimeout(() => {
          chevronElement.style.transform = 'rotate(0deg)';
        }, 200);
      }
    }

    updateCurrentLangFlag();

    document.querySelectorAll(".language-option").forEach(option => {
      option.addEventListener("click", (e) => {
        e.preventDefault();
        const lang = option.getAttribute("data-lang");
        if (lang) {
          import('/src/lib/i18n.js').then(({ setLang }) => {
            setLang(lang);
          }).catch(err => {
            console.error('Error al cambiar idioma:', err);
            localStorage.setItem('lang', lang);
            document.cookie = `user-lang=${lang}; path=/; max-age=31536000`;
            window.location.reload();
          });
        }
      });
    });

    // ===== Admin Users Modal (completo) =====
    const adminUsersModal = document.getElementById('adminUsersModal');
    const closeAdminUsersModalBtn = document.getElementById('closeAdminUsersModal');
    const cancelAdminUsersBtn = document.getElementById('cancelAdminUsersBtn');
    const adminTableContainer = document.getElementById('adminUsersTableContainer');
    const addAdminUserBtn = document.getElementById('addAdminUserBtn');
    const saveAdminUsersBtn = document.getElementById('saveAdminUsersBtn');
    const adminFormContainer = document.getElementById('adminUsersFormContainer');
    const adminUsersHelpBtn = document.getElementById('adminUsersHelpBtn');
    let adminUsers = [];
    let editingAdminId = null;

    const authHeaders = () => ({
      Authorization: `Bearer ${token || getClientToken()}`,
      'Content-Type': 'application/json'
    });

    function ensureAdminFormTableBody() {
      if (!adminFormContainer) return null;
      let body = document.getElementById('adminUsersFormTableBody');
      if (body) return body;

      const tpl = document.getElementById('adminUsersFormTableTemplate');
      if (!tpl) return null;
      const frag = document.importNode(tpl.content, true);
      adminFormContainer.innerHTML = '';
      adminFormContainer.appendChild(frag);
      body = document.getElementById('adminUsersFormTableBody');
      return body;
    }

    function updateAdminFormActions() {
      const tableBody = document.getElementById('adminUsersFormTableBody');
      const hasRows = !!tableBody && !!tableBody.querySelector('tr');
      if (saveAdminUsersBtn) {
        saveAdminUsersBtn.disabled = !hasRows;
        saveAdminUsersBtn.classList.toggle('hidden', !hasRows);
      }
    }

    function resetAdminPasswordForm() {
      if (currentPasswordInput) currentPasswordInput.value = '';
      if (newPasswordInput) newPasswordInput.value = '';
      if (confirmPasswordInput) confirmPasswordInput.value = '';
      updateAdminPasswordRules('');
    }

    function openAdminChangePasswordModal() {
      resetAdminPasswordForm();
      showModal('#adminChangePasswordModal');
    }

    setupModalClose('#adminChangePasswordModal', '#closeAdminChangePasswordModalBtn, #cancelAdminChangePasswordBtn');

    const isStrongPassword = (value) =>
      typeof value === 'string' &&
      value.length >= 8 &&
      /[A-Z]/.test(value) &&
      /[a-z]/.test(value) &&
      /[0-9]/.test(value);

    function updateAdminPasswordRules(value) {
      if (!adminPasswordRules) return;
      const rules = {
        length: value.length >= 8,
        upper: /[A-Z]/.test(value),
        lower: /[a-z]/.test(value),
        number: /[0-9]/.test(value)
      };

      adminPasswordRules.querySelectorAll('li[data-rule]').forEach((item) => {
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
    }

    async function submitAdminPasswordChange() {
      const authToken = token || getClientToken();
      if (!authToken) {
        showNotification(getAdminSetting('passwordChangeError', 'Error updating password'), 'error');
        return;
      }

      const currentPassword = currentPasswordInput?.value?.trim() || '';
      const newPassword = newPasswordInput?.value?.trim() || '';
      const confirmPassword = confirmPasswordInput?.value?.trim() || '';

      if (!currentPassword || !newPassword || !confirmPassword) {
        showNotification(getAdminSetting('passwordRequired', 'All fields are required'), 'error');
        return;
      }

      if (newPassword !== confirmPassword) {
        showNotification(getAdminSetting('passwordMismatch', 'Passwords do not match'), 'error');
        return;
      }

      if (!isStrongPassword(newPassword)) {
        showNotification(getAdminSetting('password_strength_error', 'Password must be at least 8 characters and include uppercase, lowercase, and a number'), 'error');
        return;
      }

      const confirmed = await confirmAction(
        getAdminSetting('confirmChangePasswordTitle', 'Change password?'),
        getAdminSetting('confirmChangePasswordMessage', 'Your password will be updated.'),
        'warning',
        {
          confirmButtonText: getAdminSetting('change_password_button', 'Change'),
          cancelButtonText: getAdminSetting('cancel', 'Cancel')
        }
      );

      if (!confirmed) {
        return;
      }

      if (saveAdminPasswordBtn) {
        saveAdminPasswordBtn.disabled = true;
        saveAdminPasswordBtn.classList.add('opacity-70', 'cursor-not-allowed');
      }

      try {
        const response = await fetch(`${API_BASE}/api/auth/change-password`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`
          },
          body: JSON.stringify({
            currentPassword,
            newPassword
          })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const message = errorData.message || getAdminSetting('passwordChangeError', 'Error updating password');
          showNotification(message, 'error');
          return;
        }

        showNotification(getAdminSetting('passwordChangeSuccess', 'Password updated successfully'), 'success');
        hideModal('#adminChangePasswordModal');
        resetAdminPasswordForm();
      } catch (error) {
        showNotification(getAdminSetting('passwordChangeError', 'Error updating password'), 'error');
        console.error('Error cambiando contraseña del admin:', error);
      } finally {
        if (saveAdminPasswordBtn) {
          saveAdminPasswordBtn.disabled = false;
          saveAdminPasswordBtn.classList.remove('opacity-70', 'cursor-not-allowed');
        }
      }
    }

    if (saveAdminPasswordBtn) {
      saveAdminPasswordBtn.addEventListener('click', submitAdminPasswordChange);
    }

    newPasswordInput?.addEventListener('input', (e) => {
      updateAdminPasswordRules(e.target.value || '');
    });

    function addAdminFormRow() {
      const tbody = ensureAdminFormTableBody();
      if (!tbody) return;
      adminFormContainer?.classList.remove('hidden');

      const row = document.createElement('tr');
      row.className = 'border-t border-gray-200 dark:border-gray-600';
      row.innerHTML = `
        <td class="p-2"><input class="admin-rut w-full text-xs px-2 py-1 border rounded-md bg-white dark:bg-gray-800 dark:border-gray-700 text-gray-900 dark:text-white" type="text" placeholder="RUT"></td>
        <td class="p-2"><input class="admin-email w-full text-xs px-2 py-1 border rounded-md bg-white dark:bg-gray-800 dark:border-gray-700 text-gray-900 dark:text-white" type="email" placeholder="Email"></td>
        <td class="p-2"><input class="admin-full-name w-full text-xs px-2 py-1 border rounded-md bg-white dark:bg-gray-800 dark:border-gray-700 text-gray-900 dark:text-white" type="text" placeholder="Nombre completo"></td>
        <td class="p-2"><input class="admin-phone w-full text-xs px-2 py-1 border rounded-md bg-white dark:bg-gray-800 dark:border-gray-700 text-gray-900 dark:text-white" type="text" placeholder="Teléfono"></td>
        <td class="p-2 text-center">
          <input class="admin-agent h-4 w-4 text-indigo-600 rounded border-gray-300 dark:border-gray-600" type="checkbox">
        </td>
        <td class="p-2 text-center">
          <button class="remove-admin-form-row text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300 transition" title="Eliminar fila">
            <svg class="w-4 h-4 inline" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </td>
      `;
      tbody.appendChild(row);
      updateAdminFormActions();
    }

    function resetAdminFormRows() {
      if (adminFormContainer) {
        adminFormContainer.innerHTML = '';
        adminFormContainer.classList.remove('hidden');
      }
      addAdminFormRow();
      updateAdminFormActions();
    }

    function hideAdminForm() {
      if (adminFormContainer) {
        adminFormContainer.innerHTML = '';
        adminFormContainer.classList.add('hidden');
      }
      updateAdminFormActions();
    }

    async function loadAdminUsers() {
      try {
        const res = await fetch(`${API_BASE}/api/users/admins`, { headers: authHeaders() });
        adminUsers = res.ok ? await res.json() : [];
      } catch (err) {
        console.error('Error cargando admins', err);
        adminUsers = [];
      }
      renderAdminUsersTable();
    }

    function renderAdminUsersTable() {
      if (!adminTableContainer) return;
      adminTableContainer.innerHTML = '';
      const tpl = document.getElementById('adminUsersExistingTableTemplate');
      if (!tpl) return;

      const frag = document.importNode(tpl.content, true);
      const tbody = frag.querySelector('#adminUsersExistingTableBody');
      if (!tbody) return;

      if (!adminUsers.length) {
        const row = document.createElement('tr');
        row.innerHTML = `<td colspan="6" class="text-center text-xs text-gray-500 dark:text-gray-400 py-4">No hay administradores</td>`;
        tbody.appendChild(row);
      } else {
        adminUsers.forEach((a) => {
          const isSelf =
            (currentAdminId !== null && Number(a.id) === Number(currentAdminId)) ||
            (currentAdminRut && a.rut && String(a.rut) === String(currentAdminRut));
          const isEditing = editingAdminId === a.id;
          const row = document.createElement('tr');
          row.className = 'border-t border-gray-200 dark:border-gray-600';

          if (isEditing) {
            row.innerHTML = `
              <td class="p-2"><input data-field="rut" value="${a.rut || ''}" class="w-full text-xs px-2 py-1 border rounded-md bg-white dark:bg-gray-800 dark:border-gray-700 text-gray-900 dark:text-white" type="text"></td>
              <td class="p-2"><input data-field="email" value="${a.email || ''}" class="w-full text-xs px-2 py-1 border rounded-md bg-white dark:bg-gray-800 dark:border-gray-700 text-gray-900 dark:text-white" type="email"></td>
              <td class="p-2"><input data-field="full_name" value="${a.full_name || ''}" class="w-full text-xs px-2 py-1 border rounded-md bg-white dark:bg-gray-800 dark:border-gray-700 text-gray-900 dark:text-white" type="text"></td>
              <td class="p-2"><input data-field="phone" value="${a.phone || ''}" class="w-full text-xs px-2 py-1 border rounded-md bg-white dark:bg-gray-800 dark:border-gray-700 text-gray-900 dark:text-white" type="text"></td>
              <td class="p-2 text-center">
                <input data-field="agent" type="checkbox" ${a.agent ? 'checked' : ''} class="h-4 w-4 text-indigo-600 rounded border-gray-300 dark:border-gray-600">
              </td>
              <td class="p-2 text-center flex gap-2 justify-center">
                <button class="save-admin-edit text-green-600 hover:text-green-500 transition" data-id="${a.id}" title="Guardar">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                </button>
                <button class="cancel-admin-edit text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300 transition" title="Cancelar">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </td>
            `;
          } else {
            row.innerHTML = `
              <td class="p-2 text-xs text-gray-900 dark:text-white">${a.rut || '-'}</td>
              <td class="p-2 text-xs text-gray-900 dark:text-white">${a.email || '-'}</td>
              <td class="p-2 text-xs text-gray-900 dark:text-white">${a.full_name || '-'}</td>
              <td class="p-2 text-xs text-gray-900 dark:text-white">${a.phone || '-'}</td>
              <td class="p-2 text-center">
                <input type="checkbox" disabled ${a.agent ? 'checked' : ''} class="h-4 w-4 text-indigo-600 rounded border-gray-300 dark:border-gray-600">
              </td>
              <td class="p-2 text-center flex gap-3 justify-center">
                <button class="edit-admin-user text-green-600 hover:text-green-500 dark:text-green-400 dark:hover:text-green-300 transition" data-id="${a.id}" title="Editar">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L7.5 21H3v-4.5l13.732-13.732z" /></svg>
                </button>
                <button class="reset-admin-user text-amber-600 hover:text-amber-500 transition" data-id="${a.id}" title="Reset password">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 11-6.219-8.56M21 4v5h-5"/></svg>
                </button>
                <button class="delete-admin-user transition ${isSelf ? 'text-gray-300 dark:text-gray-600 opacity-50 cursor-not-allowed pointer-events-none' : 'text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300'}" data-id="${a.id}" title="Eliminar" ${isSelf ? 'disabled aria-disabled="true"' : ''}>
                  <svg class="w-5 h-5 inline-block" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </td>
            `;
          }

          tbody.appendChild(row);
        });
      }

      adminTableContainer.appendChild(frag);
    }

    async function openAdminUsersModal() {
      hideAdminForm();
      editingAdminId = null;
      await loadAdminUsers();
      updateAdminFormActions();
      showModal('#adminUsersModal');
    }
    window.openAdminUsersModal = openAdminUsersModal;

    setupModalClose('#adminUsersModal', '#closeAdminUsersModal, #cancelAdminUsersBtn');

    function closeAdminUsersModal() {
      hideModal('#adminUsersModal');
      hideAdminForm();
      editingAdminId = null;
    }

    async function saveNewAdmins(e) {
      e?.preventDefault();
      const rows = document.querySelectorAll('#adminUsersFormTableBody tr');
      if (!rows.length) {
        showNotification('Agrega al menos un administrador.', 'error');
        return;
      }

      const payloads = [];
      rows.forEach((row) => {
        const rut = row.querySelector('.admin-rut')?.value?.trim();
        const email = row.querySelector('.admin-email')?.value?.trim();
        const full_name = row.querySelector('.admin-full-name')?.value?.trim() || null;
        const phone = row.querySelector('.admin-phone')?.value?.trim() || null;
        const agent = row.querySelector('.admin-agent')?.checked ? 1 : 0;
        if (rut && email) {
          payloads.push({ rut, email, full_name, phone, agent, password: '123456' });
        }
      });

      if (!payloads.length) {
        showNotification('El RUT y el email son obligatorios.', 'error');
        return;
      }

      try {
        for (const p of payloads) {
          const res = await fetch(`${API_BASE}/api/users/admins`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify(p)
          });
          if (!res.ok) throw new Error('Error creando admin');
        }
        showNotification('Administradores creados correctamente.', 'success');
        hideAdminForm();
        await loadAdminUsers();
      } catch (err) {
        console.error(err);
        showNotification('No se pudieron crear los administradores.', 'error');
      }
      updateAdminFormActions();
    }

    function startEditAdmin(id) {
      editingAdminId = id;
      renderAdminUsersTable();
    }

    function cancelEditAdmin() {
      editingAdminId = null;
      renderAdminUsersTable();
    }

    async function saveEditAdmin(id, row) {
      const rut = row.querySelector('input[data-field="rut"]')?.value?.trim();
      const email = row.querySelector('input[data-field="email"]')?.value?.trim();
      const full_name = row.querySelector('input[data-field="full_name"]')?.value?.trim() || null;
      const phone = row.querySelector('input[data-field="phone"]')?.value?.trim() || null;
      const agent = row.querySelector('input[data-field="agent"]')?.checked ? 1 : 0;

      if (!rut || !email) {
        showNotification('El RUT y el email son obligatorios.', 'error');
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/api/users/admins/${id}`, {
          method: 'PATCH',
          headers: authHeaders(),
          body: JSON.stringify({ rut, email, full_name, phone, agent })
        });
        if (!res.ok) throw new Error();
        showNotification('Administrador actualizado.', 'success');
        editingAdminId = null;
        await loadAdminUsers();
      } catch (err) {
        console.error(err);
        showNotification('No se pudo actualizar.', 'error');
      }
    }

    async function resetAdminPassword(id) {
      const confirmed = await confirmAction('Resetear contraseña', 'Se generará una nueva contraseña temporal.', 'warning');
      if (!confirmed) return;

      try {
        const res = await fetch(`${API_BASE}/api/users/admins/${id}/reset-password`, {
          method: 'POST',
          headers: authHeaders()
        });
        if (!res.ok) throw new Error();
        showNotification('Contraseña reseteada.', 'success');
      } catch (err) {
        console.error(err);
        showNotification('No se pudo resetear la contraseña.', 'error');
      }
    }

    async function deleteAdmin(id) {
      if (currentAdminId !== null && Number(id) === Number(currentAdminId)) {
        showNotification(getAdminSetting('admin_self_delete_error', 'No puedes eliminar tu propio usuario.'), 'error');
        return;
      }
      const confirmed = await confirmAction('Eliminar administrador', 'Esta acción no se puede deshacer.', 'warning');
      if (!confirmed) return;

      try {
        const res = await fetch(`${API_BASE}/api/users/admins/${id}`, {
          method: 'DELETE',
          headers: authHeaders()
        });
        if (!res.ok) throw new Error();
        showNotification('Administrador eliminado.', 'success');
        await loadAdminUsers();
      } catch (err) {
        console.error(err);
        showNotification('No se pudo eliminar.', 'error');
      }
    }

    closeAdminUsersModalBtn?.addEventListener('click', closeAdminUsersModal);
    cancelAdminUsersBtn?.addEventListener('click', (e) => { e.preventDefault(); closeAdminUsersModal(); });
    adminUsersModal?.addEventListener('click', (e) => { if (e.target === adminUsersModal) closeAdminUsersModal(); });
    addAdminUserBtn?.addEventListener('click', (e) => { e.preventDefault(); resetAdminFormRows(); });
    saveAdminUsersBtn?.addEventListener('click', saveNewAdmins);
    setupModalClose('#adminUsersHelpModal', '#closeAdminUsersHelpModalBtn, #closeAdminUsersHelpModalFooterBtn');
    adminUsersHelpBtn?.addEventListener('click', () => showModal('#adminUsersHelpModal'));

    // Delegación de eventos para acciones de tabla
    document.addEventListener('click', async (e) => {
      const removeRowBtn = e.target.closest('.remove-admin-form-row');
      if (removeRowBtn) {
        e.preventDefault();
        const row = removeRowBtn.closest('tr');
        row?.remove();
        updateAdminFormActions();
        return;
      }

      if (!adminUsersModal || adminUsersModal.classList.contains('hidden')) return;

      const editBtn = e.target.closest('.edit-admin-user');
      if (editBtn) {
        e.preventDefault();
        startEditAdmin(parseInt(editBtn.dataset.id, 10));
        return;
      }

      const cancelBtn = e.target.closest('.cancel-admin-edit');
      if (cancelBtn) {
        e.preventDefault();
        cancelEditAdmin();
        return;
      }

      const saveEditBtn = e.target.closest('.save-admin-edit');
      if (saveEditBtn) {
        e.preventDefault();
        const id = parseInt(saveEditBtn.dataset.id, 10);
        const row = saveEditBtn.closest('tr');
        if (row) {
          await saveEditAdmin(id, row);
        }
        return;
      }

      const resetBtn = e.target.closest('.reset-admin-user');
      if (resetBtn) {
        e.preventDefault();
        await resetAdminPassword(parseInt(resetBtn.dataset.id, 10));
        return;
      }

      const deleteBtn = e.target.closest('.delete-admin-user');
      if (deleteBtn) {
        e.preventDefault();
        await deleteAdmin(parseInt(deleteBtn.dataset.id, 10));
      }
    });
  });
} 
