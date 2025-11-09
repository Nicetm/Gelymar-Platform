// Sidebar Admin JavaScript
import { confirmAction, showNotification } from './utils.js';

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

    const hasVisibleSettings =
      (!!pdfOption && pdfEnabled) ||
      (!!notificationOption && notificationEnabled) ||
      (!!profileOption && profileEnabled);

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

      if (u.full_name)  document.getElementById("adminNameInput").value  = u.full_name;
      if (u.email)      document.getElementById("adminEmailInput").value = u.email;
      if (u.phone)      document.getElementById("adminPhoneInput").value = u.phone;

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
      alert(t.admin_settings.name_and_phone_required);
      return false;
    }
    return true;
  }

  // Inicialización cuando el DOM está listo
  document.addEventListener("DOMContentLoaded", async () => {
    await loadAdminData();

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
          break;
      }
    });

    // Modal utilities eliminadas

    // Modal events eliminados

    // Form submission eliminado

    // PDF Mail List Modal
    const pdfMailModal = document.getElementById('pdfMailListModal');
    const closePdfMailModalBtn = document.getElementById('closePdfMailModal');
    const cancelPdfMailBtn = document.getElementById('cancelPdfMailBtn');
    const addEmailBtn = document.getElementById('addEmailBtn');
    const savePdfMailBtn = document.getElementById('savePdfMailBtn');
    const emailFormContainer = document.getElementById('emailFormContainer');
    const existingEmailsTable = document.getElementById('existingEmailsTable');

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
        pdfMailModal.classList.remove('hidden');
      } catch (error) {
        console.error('Error cargando emails:', error);
        pdfEmails = [];
        renderPdfExistingEmailsTable();
        renderPdfEmailForm();
        pdfMailModal.classList.remove('hidden');
      }
    }

    // Cerrar modal
    function closePdfMailModal() {
      pdfMailModal.classList.add('hidden');
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
            <button class="remove-existing-email text-red-600 hover:text-red-500 transition" data-index="${index}">
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
          <button class="remove-new-email text-red-600 hover:text-red-500 transition">
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
        notificationEmailModal.classList.remove('hidden');
      } catch (error) {
        console.error('Error cargando emails de notificación:', error);
        notificationEmails = [];
        renderNotificationExistingEmailsTable();
        renderNotificationEmailForm();
        notificationEmailModal.classList.remove('hidden');
      }
    }

    function closeNotificationEmailModal() {
      notificationEmailModal.classList.add('hidden');
    }

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
            <button class="remove-existing-notification-email text-red-600 hover:text-red-500 transition" data-index="${index}">
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
          <button class="remove-new-email text-red-600 hover:text-red-500 transition">
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
  });
} 