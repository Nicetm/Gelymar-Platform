const translationsMap = {
  es: {
    comond: () => import('../i18n/es/comond.json'),
    clientes: () => import('../i18n/es/clientes.json'),
    carpetas: () => import('../i18n/es/carpetas.json'),
    documentos: () => import('../i18n/es/documentos.json'),
    support: () => import('../i18n/es/support.json'), 
    sidebar: () => import('../i18n/es/sidebar.json'),
    admin_settings: () => import('../i18n/es/admin_settings.json'),
    usermenu: () => import('../i18n/es/usermenu.json'),
  },
  en: {
    comond: () => import('../i18n/en/comond.json'),
    clientes: () => import('../i18n/en/clientes.json'),
    carpetas: () => import('../i18n/en/carpetas.json'),
    documentos: () => import('../i18n/en/documentos.json'),
    support: () => import('../i18n/en/support.json'), 
    sidebar: () => import('../i18n/en/sidebar.json'),
    admin_settings: () => import('../i18n/en/admin_settings.json'),
    usermenu: () => import('../i18n/en/usermenu.json'),
  }
};

/**
 * Determina el idioma para el servidor (Astro)
 * @param {any} cookies - Objeto de cookies de Astro (opcional)
 * @returns {string} 'es' o 'en'
 */
export function getServerLang(cookies = null) {
  // Prioridad 1: Cookie de preferencia del usuario (si está disponible)
  if (cookies) {
    const userLang = cookies.get('user-lang')?.value;
    if (userLang && (userLang === 'es' || userLang === 'en')) {
      return userLang;
    }
  }
  
  // Prioridad 2: Variable de entorno (configuración del servidor)
  if (typeof import.meta !== 'undefined' && import.meta.env?.PUBLIC_LANG) {
    return import.meta.env.PUBLIC_LANG;
  }
  
  // Prioridad 3: Fallback por defecto
  return 'es';
}

/**
 * Determina el idioma para el cliente (browser)
 * @returns {string} 'es' o 'en'
 */
export function getCurrentLang() {
  // Prioridad 1: localStorage (preferencia explícita del usuario)
  if (typeof window !== 'undefined') {
    const storedLang = localStorage.getItem('lang');
    if (storedLang) {
      return storedLang;
    }
  }
  
  // Prioridad 2: Variable de entorno (configuración del servidor)
  if (typeof import.meta !== 'undefined' && import.meta.env?.PUBLIC_LANG) {
    return import.meta.env.PUBLIC_LANG;
  }
  
  // Prioridad 3: Idioma del navegador
  if (typeof window !== 'undefined' && navigator.language) {
    return navigator.language.slice(0, 2);
  }
  
  // Prioridad 4: Fallback por defecto
  return 'es';
}

/**
 * Función universal que determina el idioma (funciona en servidor y cliente)
 * @returns {string} 'es' o 'en'
 */
export function getLang() {
  // Si estamos en el servidor (Astro)
  if (typeof window === 'undefined') {
    return getServerLang();
  }
  
  // Si estamos en el cliente
  return getCurrentLang();
}

/**
 * Carga las traducciones por idioma y sección (ej: 'clientes')
 * @param {string} lang 'es' o 'en'
 * @param {string} section 'clientes' o 'pedidos'
 * @returns {Promise<Object>}
 */
export async function loadTranslations(lang = 'es', section = 'clientes') {
  try {
    return (await translationsMap[lang]?.[section]())?.default || {};
  } catch (err) {
    console.warn('Fallo carga traducción:', err);
    return {};
  }
}

export function setLang(lang) {
  if (typeof window !== 'undefined') {
    // Guardar en localStorage
    localStorage.setItem('lang', lang);
    
    // Guardar en cookie para que el servidor lo sepa
    document.cookie = `user-lang=${lang}; path=/; max-age=31536000`; // 1 año
    
    // Recargar la página para que el servidor renderice con el nuevo idioma
    window.location.reload();
  }
}


