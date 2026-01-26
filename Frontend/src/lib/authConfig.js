// src/lib/authConfig.js - Configuracion centralizada de autenticacion
import { SERVER_API_URL, PUBLIC_API_URL } from '../app/constants.ts';

const toPath = (rawUrl, fallback) => {
  if (!rawUrl) return fallback;
  try {
    const url = new URL(rawUrl, 'http://localhost');
    return url.pathname || fallback;
  } catch {
    return rawUrl.startsWith('/') ? rawUrl : fallback;
  }
};

const ADMIN_PATH = toPath(import.meta.env.PUBLIC_ADMIN_APP_URL, '/admin');
const CLIENT_PATH = toPath(import.meta.env.PUBLIC_CLIENT_APP_URL, '/client');
const SELLER_PATH = toPath(import.meta.env.PUBLIC_SELLER_APP_URL, '/seller');

/**
 * Configuracion de autenticacion
 */
export const AUTH_CONFIG = {
  // URLs de la API
  API_BASE: SERVER_API_URL || PUBLIC_API_URL,
  
  // Rutas de autenticacion
  LOGIN_URL: '/authentication/sign-in',
  ADMIN_URL: ADMIN_PATH,
  CLIENT_URL: CLIENT_PATH,
  SELLER_URL: SELLER_PATH,
  CHANGE_PASSWORD_URL: '/authentication/change-password',
  
  // Configuracion de tokens
  TOKEN_KEY: 'token',
  USER_ROLE_KEY: 'userRole',
  USER_RUT_KEY: 'userRut',
  USER_EMAIL_KEY: 'userEmail',
  
  // Tiempo de expiracion (en minutos)
  TOKEN_EXPIRY_WARNING: 5, // Advertir 5 minutos antes de expirar
  
  // Headers por defecto
  DEFAULT_HEADERS: {
    'Content-Type': 'application/json',
  },
  
  // Configuracion de cookies
  COOKIE_CONFIG: {
    path: '/',
    SameSite: 'Strict',
    secure: import.meta.env.PROD, // Solo HTTPS en produccion
  }
};

/**
 * Obtener headers de autorizacion
 * @param {string} token - Token JWT
 * @returns {Object} Headers con autorizacion
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
 * Configuracion de fetch con autenticacion
 * @param {string} endpoint - Endpoint de la API
 * @param {Object} options - Opciones de fetch
 * @returns {Object} Opciones de fetch con autenticacion
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
