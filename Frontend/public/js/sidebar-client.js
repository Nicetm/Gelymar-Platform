// Sidebar Client JavaScript
import { setupFloatingTooltips } from './utils.js';
export function initSidebarClient(config) {
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

  // Inicialización cuando el DOM está listo
  document.addEventListener("DOMContentLoaded", async () => {

    // Sidebar collapse
    const sidebar = document.getElementById('sidebar');
    const rootEl = document.documentElement;
    const collapseBtn = document.getElementById('toggleSidebarCollapse');
    const sidebarUser = document.querySelector('[data-sidebar-user]');
    const sidebarTexts = sidebar ? sidebar.querySelectorAll('[data-sidebar-text]') : [];
    const sidebarLinks = sidebar ? sidebar.querySelectorAll('.sidebar-link') : [];

    const applySidebarCollapsed = (collapsed) => {
      if (!sidebar) return;
      
      // Aplicar clase al elemento raíz (html) para que los estilos CSS funcionen
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
    };

    if (collapseBtn) {
      const stored = localStorage.getItem('sidebarCollapsed');
      const storedCollapsed = stored === '1';
      const domCollapsed = sidebar?.classList.contains('sidebar-collapsed');
      
      // Priorizar localStorage sobre el estado del DOM
      const desiredCollapsed = stored !== null ? storedCollapsed : domCollapsed;
      
      // Solo aplicar si el estado actual no coincide con el deseado
      if (domCollapsed !== desiredCollapsed) {
        applySidebarCollapsed(desiredCollapsed);
      }

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

    // Setup tooltips for sidebar links
    setupFloatingTooltips(sidebar);

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
