// src/lib/auth.ts
import type { AstroGlobal } from 'astro';
import { getApiBase } from '../app/constants.ts';
import { inferUserRole } from './roles.ts';

const sellerPortalPath = (() => {
  const rawUrl = import.meta.env.PUBLIC_SELLER_APP_URL || '/seller';
  try {
    const url = new URL(rawUrl, 'http://localhost');
    return url.pathname || '/seller';
  } catch {
    return rawUrl.startsWith('/') ? rawUrl : '/seller';
  }
})();

export async function validateRole(astro: AstroGlobal, requiredRole: 'admin' | 'client' | 'seller') {
  const apiBase = getApiBase();
  const token = astro.cookies.get('token')?.value;

  if (!token) {
    return astro.redirect('/authentication/sign-in');
  }

  try {
    const response = await fetch(`${apiBase}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (!response.ok) {
      return astro.redirect('/authentication/sign-in');
    }

    const user = await response.json();
    const userRole = inferUserRole(user);
    
    if (userRole !== requiredRole) {
      console.warn(`Acceso denegado: usuario ${user.email} con rol ${userRole} intentando acceder a ${requiredRole}`);
      
      if (userRole === 'admin') {
        return astro.redirect('/admin');
      } else if (userRole === 'seller') {
        return astro.redirect(sellerPortalPath);
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
