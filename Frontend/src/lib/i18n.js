const translationsMap = {
  es: {
    comond: () => import('../i18n/es/comond.json'),
    clientes: () => import('../i18n/es/clientes.json'),
    carpetas: () => import('../i18n/es/carpetas.json'),
    documentos: () => import('../i18n/es/documentos.json'),
    support: () => import('../i18n/es/support.json'), 
  },
  en: {
    comond: () => import('../i18n/en/comond.json'),
    clientes: () => import('../i18n/en/clientes.json'),
    carpetas: () => import('../i18n/en/carpetas.json'),
    documentos: () => import('../i18n/en/documentos.json'),
    support: () => import('../i18n/en/support.json'), 
  }
};
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

export function getCurrentLang() {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('lang') || navigator.language.slice(0, 2) || 'es';
  }
  return 'es';
}

export function setLang(lang) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('lang', lang);
  	window.location.reload();
  }
}
