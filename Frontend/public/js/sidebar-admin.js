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

    // Renderizar lista de pdfEmails existentes en tabla
    function renderPdfExistingEmailsTable() {
      if (pdfEmails.length === 0) {
        existingEmailsTable.innerHTML = '<p class="text-gray-500 dark:text-gray-400 text-center py-4">No hay emails configurados</p>';
        return;
      }

      const tableHTML = `
        <div class="overflow-x-auto">
          <table class="w-full text-sm text-left text-gray-500 dark:text-gray-400">
            <thead class="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
              <tr>
                <th scope="col" class="px-6 py-3">${t.admin_settings.name}</th>
                <th scope="col" class="px-6 py-3">${t.admin_settings.email}</th>
                <th scope="col" class="px-6 py-3">${t.admin_settings.actions}</th>
              </tr>
            </thead>
            <tbody>
              ${pdfEmails.map((email, index) => `
                <tr class="text-xs bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                  <td class="px-6 py-4 font-medium text-gray-900 dark:text-white">${email.name}</td>
                  <td class="px-6 py-4">${email.email}</td>
                  <td class="px-6 py-4">
                    <button class="remove-existing-email flex items-center justify-center text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 font-medium" data-index="${index}">
                      ${t.admin_settings.delete}
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
      
      existingEmailsTable.innerHTML = tableHTML;
    }

    // Renderizar formulario para nuevos pdfEmails
    function renderPdfEmailForm() {
      emailFormContainer.innerHTML = '';
    }

    // Agregar nuevo email al formulario
    function addPdfEmail() {
      const newEmailDiv = document.createElement('div');
      newEmailDiv.className = 'flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-md mb-2';
      newEmailDiv.innerHTML = `
        <div class="flex-1 grid grid-cols-2 gap-3">
          <input type="text" placeholder="Nombre" class="text-xs new-email-name px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
          <input type="email" placeholder="Email" class="text-xs new-email-email px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
        </div>
        <button class="remove-new-email text-center text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      `;
      emailFormContainer.appendChild(newEmailDiv);
    }

    // Remover email existente
    async function removePdfExistingEmail(index) {
      const email = pdfEmails[index];
      const confirmed = await confirmAction(
        '¿Eliminar email?',
        `Se eliminará el email: ${email.name} (${email.email})`,
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
          showNotification('Lista de emails actualizada correctamente', 'success');
        } else {
          throw new Error('Error al guardar');
        }
      } catch (error) {
        console.error('Error guardando emails:', error);
        showNotification('Error al guardar la lista de emails', 'error');
      }
    }

    // Guardar pdfEmails
    async function savePdfEmails() {
      const confirmed = await confirmAction(
        '¿Guardar cambios?',
        'Se actualizará la lista de correos para PDFs.',
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
          showNotification('Lista de emails actualizada correctamente', 'success');
          pdfEmails = updatedEmails;
          renderPdfExistingEmailsTable();
          renderPdfEmailForm();
        } else {
          throw new Error('Error al guardar');
        }
      } catch (error) {
        console.error('Error guardando emails:', error);
        showNotification('Error al guardar la lista de emails', 'error');
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
      if (notificationEmails.length === 0) {
        notificationExistingEmailsTable.innerHTML = '<p class="text-gray-500 dark:text-gray-400 text-center py-4">No hay emails configurados</p>';
        return;
      }

      const tableHTML = `
        <div class="overflow-x-auto">
          <table class="w-full text-sm text-left text-gray-500 dark:text-gray-400">
            <thead class="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
              <tr>
                <th scope="col" class="px-6 py-3">${t.admin_settings.name}</th>
                <th scope="col" class="px-6 py-3">${t.admin_settings.email}</th>
                <th scope="col" class="px-6 py-3">${t.admin_settings.actions}</th>
              </tr>
            </thead>
            <tbody>
              ${notificationEmails.map((email, index) => `
                <tr class="text-xs bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                  <td class="px-6 py-4 font-medium text-gray-900 dark:text-white">${email.name}</td>
                  <td class="px-6 py-4">${email.email}</td>
                  <td class="px-6 py-4">
                    <button class="remove-existing-notification-email flex items-center justify-center text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 font-medium" data-index="${index}">
                      ${t.admin_settings.delete}
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;

      notificationExistingEmailsTable.innerHTML = tableHTML;
    }

    function renderNotificationEmailForm() {
      notificationEmailFormContainer.innerHTML = '';
    }

    function addNotificationEmail() {
      const newEmailDiv = document.createElement('div');
      newEmailDiv.className = 'flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-md mb-2';
      newEmailDiv.innerHTML = `
        <div class="flex-1 grid grid-cols-2 gap-3">
          <input type="text" placeholder="Nombre" class="text-xs new-email-name px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
          <input type="email" placeholder="Email" class="text-xs new-email-email px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
        </div>
        <button class="remove-new-email text-center text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      `;
      notificationEmailFormContainer.appendChild(newEmailDiv);
    }

    async function removeNotificationExistingEmail(index) {
      const email = notificationEmails[index];
      const confirmed = await confirmAction(
        '¿Eliminar email?',
        `Se eliminará el email: ${email.name} (${email.email})`,
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
          showNotification('Lista de emails actualizada correctamente', 'success');
        } else {
          throw new Error('Error al guardar');
        }
      } catch (error) {
        console.error('Error guardando emails:', error);
        showNotification('Error al guardar la lista de emails', 'error');
      }
    }

    async function saveNotificationEmails() {
      const confirmed = await confirmAction(
        '¿Guardar cambios?',
        'Se actualizará la lista de correos para notificaciones.',
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
          showNotification('Lista de emails actualizada correctamente', 'success');
          notificationEmails = updatedEmails;
          renderNotificationExistingEmailsTable();
          renderNotificationEmailForm();
        } else {
          throw new Error('Error al guardar');
        }
      } catch (error) {
        console.error('Error guardando emails:', error);
        showNotification('Error al guardar la lista de emails', 'error');
      }
    }

    // Event listeners
    closePdfMailModalBtn.addEventListener('click', closePdfMailModal);
    cancelPdfMailBtn.addEventListener('click', closePdfMailModal);

    if (closeNotificationEmailModalBtn) {
      closeNotificationEmailModalBtn.addEventListener('click', closeNotificationEmailModal);
    }

    if (cancelNotificationEmailBtn) {
      cancelNotificationEmailBtn.addEventListener('click', closeNotificationEmailModal);
    }
    
    // Usar event delegation para botones que se recrean
    document.addEventListener('click', (e) => {
      if (e.target.closest('#addEmailBtn')) {
        e.preventDefault();
        addPdfEmail();
      }
      if (e.target.closest('#savePdfMailBtn')) {
        e.preventDefault();
        savePdfEmails();
      }
      if (e.target.closest('#addNotificationEmailBtn')) {
        e.preventDefault();
        addNotificationEmail();
      }
      if (e.target.closest('#saveNotificationEmailBtn')) {
        e.preventDefault();
        saveNotificationEmails();
      }
    });

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

    // Event delegation para botones de eliminar
    document.addEventListener('click', (e) => {
      // Remover email nuevo
      if (e.target.closest('.remove-new-email')) {
        e.preventDefault();
        e.stopPropagation();
        const button = e.target.closest('.remove-new-email');
        const row = button.closest('div');
        row.remove();
      }
      
      // Remover email existente
      if (e.target.closest('.remove-existing-email')) {
        e.preventDefault();
        e.stopPropagation();
        const button = e.target.closest('.remove-existing-email');
        const index = parseInt(button.dataset.index);
        removePdfExistingEmail(index);
      }
      if (e.target.closest('.remove-existing-notification-email')) {
        e.preventDefault();
        e.stopPropagation();
        const button = e.target.closest('.remove-existing-notification-email');
        const index = parseInt(button.dataset.index);
        removeNotificationExistingEmail(index);
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
      const chevronElement = document.querySelector('#currentLangBtn i[data-lucide="chevron-up"]');
      
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
