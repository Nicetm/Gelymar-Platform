// src/lib/auth.ts
import type { AstroGlobal } from 'astro';
import { getApiBase } from '../app/constants.ts';

export async function validateRole(astro: AstroGlobal, requiredRole: 'admin' | 'client') {
  const apiBase = getApiBase();
  const token = astro.cookies.get('token')?.value;

  if (!token) {
    return astro.redirect('/authentication/sign-in');
  }

  try {
    const response = await fetch(`${apiBase}/api/auth/me`, {
      credentials: 'include'
    });
    
    if (!response.ok) {
      return astro.redirect('/authentication/sign-in');
    }

    const user = await response.json();
    const userRole = user.role || (user.role_id === 1 ? 'admin' : 'client');
    
    if (userRole !== requiredRole) {
      console.warn(`Acceso denegado: usuario ${user.email} con rol ${userRole} intentando acceder a ${requiredRole}`);
      
      if (userRole === 'admin') {
        return astro.redirect('/admin');
      } else if (userRole === 'client') {
        return astro.redirect('/client');
      } else {
        return astro.redirect('/authentication/sign-in');
      }
    }

    return null; // Usuario autorizado
  } catch (error) {
    console.error('Error validando rol:', error);
    return astro.redirect('/authentication/sign-in');
  }
} 