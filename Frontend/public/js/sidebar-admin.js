// Sidebar Admin JavaScript
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
    const openBtn   = document.getElementById("openAdminSettings");
    const closeBtn  = document.getElementById("closeAdminSettings");
    const cancelBtn = document.getElementById("cancelAdminEdit");
    const form      = document.getElementById("adminSettingsForm");
    const modal     = document.getElementById("adminSettingsModal");
    const avatarInput = document.getElementById("adminAvatarInput");
    const avatarLight = document.getElementById("adminAvatarLight");
    const avatarDark  = document.getElementById("adminAvatarDark");
    const modalContent = modal?.querySelector(".modal-card");

    // Modal utilities
    const showModal = () => {
      modal.classList.remove("hidden");
      modal.classList.add("flex");
      modal.classList.remove("opacity-0");
      requestAnimationFrame(() => {
        modalContent.classList.remove("opacity-0", "scale-90", "translate-y-6");
      });
    };

    const hideModal = () => {
      modal.classList.add("opacity-0");
      modalContent.classList.add("opacity-0", "scale-90", "translate-y-6");
      modal.addEventListener(
        "transitionend",
        function handler() {
          modal.removeEventListener("transitionend", handler);
          modal.classList.remove("flex");
          modal.classList.add("hidden");
        },
        { once: true },
      );
    };

    // Avatar preview
    avatarInput?.addEventListener("change", () => {
      const file = avatarInput.files?.[0];
      if (!file) return;
      
      const allowedTypes = ['image/png', 'image/jpg', 'image/jpeg'];
      if (!allowedTypes.includes(file.type)) {
        alert('Solo se permiten archivos PNG, JPG o JPEG');
        avatarInput.value = '';
        return;
      }
      
      const maxSize = 5 * 1024 * 1024;
      if (file.size > maxSize) {
        alert('El archivo no puede ser mayor a 5MB');
        avatarInput.value = '';
        return;
      }
      
      const url = URL.createObjectURL(file);
      avatarLight.src = url;
      avatarDark.src  = url;
    });

    // Modal events
    openBtn?.addEventListener("click",  e => { e.preventDefault(); showModal(); });
    closeBtn?.addEventListener("click", hideModal);
    cancelBtn?.addEventListener("click", hideModal);
    modal?.addEventListener("click",    e => { if (e.target === modal) hideModal(); });

    // Form submission
    form?.addEventListener("submit", async e => {
      e.preventDefault();
      if (!validateForm()) return;

      try {
        let avatarPath = null;
        if (avatarInput?.files?.[0]) {
          const avatarFormData = new FormData();
          avatarFormData.append('avatar', avatarInput.files[0]);

          const avatarRes = await fetch(`${API_BASE}/api/users/avatar`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: avatarFormData
          });
          
          if (!avatarRes.ok) {
            const error = await avatarRes.json();
            throw new Error(error.message || 'Error al subir avatar');
          }
          
          const avatarData = await avatarRes.json();
          avatarPath = avatarData.avatar_path;
        }

        const profileData = {
          full_name: document.getElementById("adminNameInput").value.trim(),
          phone: document.getElementById("adminPhoneInput").value.trim(),
          country: 'Chile',
          city: 'Puerto Montt'
        };

        const profileRes = await fetch(`${API_BASE}/api/users/profile`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(profileData)
        });

        if (!profileRes.ok) {
          const error = await profileRes.json();
          throw new Error(error.message || 'Error al actualizar perfil');
        }

        alert(t.admin_settings.data_updated_successfully);
        hideModal();
        await loadAdminData();
      } catch (err) {
        console.error(err);
        alert(err.message || t.admin_settings.error_saving_changes);
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