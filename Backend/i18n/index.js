const translations = {
  es: require('./es.json'),
  en: require('./en.json')
};

/**
 * Obtiene una traducción por clave
 * @param {string} key - Clave de traducción (ej: 'errors.user_not_found')
 * @param {string} lang - Idioma ('es' o 'en')
 * @param {Object} params - Parámetros para interpolación
 * @returns {string} Texto traducido
 */
function t(key, lang = 'es', params = {}) {
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
            return key;
          }
        }
      } else {
        return key;
      }
    }
  }
  
  // Interpolación de parámetros
  if (typeof translation === 'string' && params) {
    Object.keys(params).forEach(param => {
      translation = translation.replace(new RegExp(`{{${param}}}`, 'g'), params[param]);
    });
  }
  
  return translation || key;
}

/**
 * Middleware para detectar idioma del request
 */
function languageMiddleware(req, res, next) {
  // Prioridad: query param > header > default
  const queryLang = req.query.lang;
  const headerLang = req.headers['accept-language'];
  const parsedHeaderLang = headerLang?.split(',')[0]?.split('-')[0];
  const lang = queryLang || parsedHeaderLang || 'es';
  req.lang = ['es', 'en'].includes(lang) ? lang : 'es';
  
  // Debug logging para diagnosticar problemas de idioma
  if (process.env.LOG_LANGUAGE_DEBUG === 'true') {
    const { logger } = require('../utils/logger');
    logger.info(`[languageMiddleware] path=${req.path} queryLang=${queryLang || 'N/A'} headerLang=${headerLang || 'N/A'} parsedHeaderLang=${parsedHeaderLang || 'N/A'} resolved=${req.lang}`);
  }
  
  next();
}

module.exports = {
  t,
  languageMiddleware,
  availableLanguages: Object.keys(translations)
};
