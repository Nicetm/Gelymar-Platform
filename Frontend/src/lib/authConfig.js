// src/lib/authConfig.js - Configuración centralizada de autenticación

/**
 * Configuración de autenticación
 */
export const AUTH_CONFIG = {
  // URLs de la API
  API_BASE: import.meta.env.SERVER_API_URL || import.meta.env.PUBLIC_API_URL,
  
  // Rutas de autenticación
  LOGIN_URL: '/authentication/sign-in',
  ADMIN_URL: '/admin',
  CLIENT_URL: '/client',
  CHANGE_PASSWORD_URL: '/authentication/change-password',
  
  // Configuración de tokens
  TOKEN_KEY: 'token',
  USER_ROLE_KEY: 'userRole',
  USER_EMAIL_KEY: 'userEmail',
  
  // Tiempo de expiración (en minutos)
  TOKEN_EXPIRY_WARNING: 5, // Advertir 5 minutos antes de expirar
  
  // Headers por defecto
  DEFAULT_HEADERS: {
    'Content-Type': 'application/json',
  },
  
  // Configuración de cookies
  COOKIE_CONFIG: {
    path: '/',
    SameSite: 'Strict',
    secure: import.meta.env.PROD, // Solo HTTPS en producción
  }
};

/**
 * Obtener headers de autorización
 * @param {string} token - Token JWT
 * @returns {Object} Headers con autorización
 */
export function getAuthHeaders(token = null) {
  const authToken = token || localStorage.getItem(AUTH_CONFIG.TOKEN_KEY);
  
  return {
    ...AUTH_CONFIG.DEFAULT_HEADERS,
    'Authorization': authToken ? `Bearer ${authToken}` : '',
  };
}

/**
 * Obtener URL completa de la API
 * @param {string} endpoint - Endpoint de la API
 * @returns {string} URL completa
 */
export function getApiUrl(endpoint) {
  return `${AUTH_CONFIG.API_BASE}${endpoint}`;
}

/**
 * Configuración de fetch con autenticación
 * @param {string} endpoint - Endpoint de la API
 * @param {Object} options - Opciones de fetch
 * @returns {Object} Opciones de fetch con autenticación
 */
export function getFetchConfig(endpoint, options = {}) {
  return {
    url: getApiUrl(endpoint),
    options: {
      ...options,
      headers: {
        ...getAuthHeaders(),
        ...options.headers,
      },
    },
  };
} 