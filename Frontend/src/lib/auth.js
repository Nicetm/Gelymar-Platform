// src/lib/auth.js - Manejo centralizado de autenticación

import { AUTH_CONFIG, getApiUrl, getAuthHeaders } from './authConfig.js';
import { inferUserRole } from './roles.js';

/**
 * Valida si el token está presente y es válido
 * @returns {boolean}
 */
export function isAuthenticated() {
  const token = localStorage.getItem('token');
  if (!token) return false;
  
  try {
    const [, payloadBase64] = token.split('.');
    const payload = JSON.parse(atob(payloadBase64));
    const exp = payload.exp * 1000;
    const now = Date.now();
    
    // Token expirado si faltan menos de 5 minutos
    return (exp - now) > (5 * 60 * 1000);
  } catch (error) {
    return false;
  }
}

/**
 * Obtiene el token válido o redirige al login
 * @returns {string|null}
 */
export function getValidToken() {
  if (!isAuthenticated()) {
    localStorage.removeItem(AUTH_CONFIG.TOKEN_KEY);
    if (typeof window !== 'undefined') {
      window.location.href = AUTH_CONFIG.LOGIN_URL;
    }
    return null;
  }
  return localStorage.getItem(AUTH_CONFIG.TOKEN_KEY);
}

/**
 * Obtiene el rol del usuario desde el backend
 * @returns {Promise<string|null>}
 */
export async function getUserRole() {
  const token = getValidToken();
  if (!token) return null;

  try {
    const response = await fetch(getApiUrl('/api/auth/me'), {
      headers: getAuthHeaders(token)
    });

    if (!response.ok) {
      return null;
    }

    const user = await response.json();
    return inferUserRole(user);
  } catch (error) {
    console.error('Error obteniendo rol:', error);
    return null;
  }
}

/**
 * Valida el rol del usuario contra el backend
 * @param {string} requiredRole - Rol requerido ('admin', 'client' o 'seller')
 * @returns {Promise<boolean>}
 */
export async function validateUserRole(requiredRole) {
  const userRole = await getUserRole();
  return userRole === requiredRole;
}

/**
 * Redirige al usuario según su rol
 * @param {string} userRole - Rol del usuario
 */
export function redirectByRole(userRole) {
  if (typeof window === 'undefined') return;
  
  if (userRole === 'admin') {
    window.location.href = AUTH_CONFIG.ADMIN_URL;
  } else if (userRole === 'seller') {
    window.location.href = AUTH_CONFIG.SELLER_URL;
  } else if (userRole === 'client') {
    window.location.href = AUTH_CONFIG.CLIENT_URL;
  } else {
    window.location.href = AUTH_CONFIG.LOGIN_URL;
  }
}

/**
 * Cierra la sesión del usuario
 */
export async function logout() {
  try {
    const token = localStorage.getItem(AUTH_CONFIG.TOKEN_KEY);
    
    // Llamar al endpoint de logout del backend si hay token
    if (token && typeof window !== 'undefined') {
      try {
        const apiBase = window.apiBase || window.location.origin.replace(':4321', ':3000');
        await fetch(`${apiBase}/api/auth/logout`, {
          method: 'POST',
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
      } catch (error) {
        console.error('Error calling logout endpoint:', error);
        // Continuar con logout local aunque falle el endpoint
      }
    }
    
    // Limpiar localStorage
    localStorage.removeItem(AUTH_CONFIG.TOKEN_KEY);
    localStorage.removeItem(AUTH_CONFIG.USER_ROLE_KEY);
    localStorage.removeItem(AUTH_CONFIG.USER_EMAIL_KEY);
    
    // Limpiar cookies
    if (typeof document !== 'undefined') {
      document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    }
    
    // Redirigir al login
    if (typeof window !== 'undefined') {
      window.location.href = AUTH_CONFIG.LOGIN_URL;
    }
  } catch (error) {
    console.error('Error en logout:', error);
    // Fallback: redirigir directamente
    if (typeof window !== 'undefined') {
      window.location.href = '/authentication/sign-in';
    }
  }
}

/**
 * Guarda el token de autenticación
 * @param {string} token - Token JWT
 */
export function saveToken(token) {
  localStorage.setItem(AUTH_CONFIG.TOKEN_KEY, token);
  
  // También guardar en cookie para SSR
  if (typeof document !== 'undefined') {
    const cookieConfig = AUTH_CONFIG.COOKIE_CONFIG;
    const cookieString = `token=${token}; path=${cookieConfig.path}; SameSite=${cookieConfig.SameSite}`;
    document.cookie = cookieConfig.secure ? `${cookieString}; secure` : cookieString;
  }
}

/**
 * Obtiene el token desde localStorage o cookies
 * @returns {string|null}
 */
export function getToken() {
  // Prioridad 1: localStorage
  const localToken = localStorage.getItem(AUTH_CONFIG.TOKEN_KEY);
  if (localToken) return localToken;
  
  // Prioridad 2: cookies (para SSR)
  if (typeof document !== 'undefined') {
    const cookies = document.cookie.split(';');
    const tokenCookie = cookies.find(cookie => cookie.trim().startsWith('token='));
    if (tokenCookie) {
      const token = tokenCookie.split('=')[1];
      if (token) {
        localStorage.setItem(AUTH_CONFIG.TOKEN_KEY, token);
        return token;
      }
    }
  }
  
  return null;
}

/**
 * Valida el rol del usuario en el servidor (SSR)
 * @param {Object} Astro - Objeto Astro
 * @param {string} requiredRole - Rol requerido
 * @returns {Promise<Object|null>} Redirección o null
 */
export async function validateRole(Astro, requiredRole) {
  const token = Astro.cookies.get('token')?.value;
  
  if (!token) {
    return Astro.redirect('/authentication/sign-in');
  }

  try {
    const response = await fetch(getApiUrl('/api/auth/me'), {
      headers: getAuthHeaders(token)
    });

    if (!response.ok) {
      return Astro.redirect('/authentication/sign-in');
    }

    const user = await response.json();
    const userRole = inferUserRole(user);
    
    if (userRole !== requiredRole) {
      if (userRole === 'admin') {
        return Astro.redirect(AUTH_CONFIG.ADMIN_URL);
      }
      if (userRole === 'seller') {
        return Astro.redirect(AUTH_CONFIG.SELLER_URL);
      }
      if (userRole === 'client') {
        return Astro.redirect(AUTH_CONFIG.CLIENT_URL);
      }
      return Astro.redirect('/authentication/sign-in');
    }
    
    return null; // No redirección necesaria
  } catch (error) {
    console.error('Error validando rol en servidor:', error);
    return Astro.redirect('/authentication/sign-in');
  }
} 
