const fs = require('fs');
const path = require('path');

// Cargar traducciones
const translations = {
  es: require('./es.json'),
  en: require('./en.json')
};

/**
 * Obtiene una traducción por clave
 * @param {string} key - Clave de traducción (ej: 'aviso_recepcion.title')
 * @param {string} lang - Idioma ('es' o 'en')
 * @param {string} fallback - Texto de respaldo si no se encuentra la traducción
 * @returns {string} Texto traducido
 */
function t(key, lang = 'es', fallback = '') {
  const keys = key.split('.');
  let translation = translations[lang];
  
  for (const k of keys) {
    if (translation && translation[k]) {
      translation = translation[k];
    } else {
      // Fallback al español si no existe en el idioma solicitado
      if (lang !== 'es') {
        translation = translations.es;
        for (const fallbackKey of keys) {
          if (translation && translation[fallbackKey]) {
            translation = translation[fallbackKey];
          } else {
            return fallback || key;
          }
        }
        return translation;
      }
      return fallback || key;
    }
  }
  
  return translation || fallback || key;
}

/**
 * Obtiene todas las traducciones para un documento específico
 * @param {string} documentType - Tipo de documento (ej: 'aviso_recepcion')
 * @param {string} lang - Idioma ('es' o 'en')
 * @returns {Object} Objeto con todas las traducciones del documento
 */
function getDocumentTranslations(documentType, lang = 'es') {
  return translations[lang]?.[documentType] || translations.es[documentType] || {};
}

module.exports = {
  t,
  getDocumentTranslations,
  availableLanguages: Object.keys(translations)
};
