
export const SITE_TITLE = 'Gelymar Panel';

// URLs de servicios
export const API_URL = import.meta.env.PUBLIC_API_BASE_URL;
export const PUBLIC_API_URL = import.meta.env.PUBLIC_API_URL;
export const SERVER_API_URL = import.meta.env.SERVER_API_URL;
export const FILE_SERVER_URL = import.meta.env.PUBLIC_FILE_SERVER_URL;

// Configuración del sitio
export const { SITE, BASE_URL } = import.meta.env;
export const REMOTE_ASSETS_BASE_URL = import.meta.env.REMOTE_ASSETS_BASE_URL ?? '/assets';
export const PUBLIC_LANG = import.meta.env.PUBLIC_LANG ?? 'en';

// Build y desarrollo
export const RANDOMIZE = import.meta.env.RANDOMIZE !== 'false';

// Helper functions para URLs de API
export function getApiBase() {
  return SERVER_API_URL || PUBLIC_API_URL;
}

export function getPublicApiUrl() {
  return PUBLIC_API_URL;
}

export function getFileServerUrl() {
  return FILE_SERVER_URL;
}

