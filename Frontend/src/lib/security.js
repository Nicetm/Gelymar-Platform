// src/lib/security.js
const apiBase = import.meta.env.SERVER_API_URL || import.meta.env.PUBLIC_API_URL;

/**
 * Valida el rol del usuario contra el backend
 * @param {string} requiredRole - Rol requerido ('admin' o 'client')
 * @returns {Promise<boolean>} - true si tiene permisos, false si no
 */
export async function validateUserRole(requiredRole) {
  const token = localStorage.getItem('token');
  
  if (!token) {
    return false;
  }

  try {
    const response = await fetch(`${apiBase}/api/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      return false;
    }

    const user = await response.json();
    const userRole = user.role || (user.role_id === 1 ? 'admin' : 'client');
    
    return userRole === requiredRole;
  } catch (error) {
    console.error('Error validando rol:', error);
    return false;
  }
}

/**
 * Redirige al usuario según su rol
 * @param {string} userRole - Rol del usuario
 */
export function redirectByRole(userRole) {
  if (userRole === 'admin') {
    window.location.href = '/admin';
  } else if (userRole === 'client') {
    window.location.href = '/client';
  } else {
    window.location.href = '/authentication/sign-in';
  }
}

/**
 * Obtiene el rol del usuario desde el backend
 * @returns {Promise<string|null>} - Rol del usuario o null si hay error
 */
export async function getUserRole() {
  const token = localStorage.getItem('token');
  
  if (!token) {
    return null;
  }

  try {
    const response = await fetch(`${apiBase}/api/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      return null;
    }

    const user = await response.json();
    return user.role || (user.role_id === 1 ? 'admin' : 'client');
  } catch (error) {
    console.error('Error obteniendo rol:', error);
    return null;
  }
} 