import type { MiddlewareHandler } from 'astro';
import { jwtVerify } from 'jose';

const appContext = (import.meta.env.PUBLIC_APP_CONTEXT || 'both').toLowerCase();

// Helper function to extract JWT token from cookies
const extractTokenFromCookies = (cookies: string | null): string | null => {
  if (!cookies) return null;
  
  const tokenMatch = cookies.match(/(?:^|;\s*)token=([^;]+)/);
  return tokenMatch?.[1] ?? null;
};

// Helper function to verify JWT token
const verifyJWT = async (token: string, secret: string): Promise<any | null> => {
  try {
    const encoder = new TextEncoder();
    const secretKey = encoder.encode(secret);
    const { payload } = await jwtVerify(token, secretKey);
    return payload;
  } catch (error) {
    return null;
  }
};

// Helper function to check if role matches route context
const roleMatchesRouteContext = (role: string, pathname: string, appContext: string): boolean => {
  // In 'both' mode, allow all roles
  if (appContext === 'both') return true;
  
  // Extract route context from pathname
  if (pathname.startsWith('/admin')) {
    return role === 'admin';
  } else if (pathname.startsWith('/seller')) {
    return role === 'seller';
  } else if (pathname.startsWith('/client')) {
    return role === 'client';
  }
  
  // For other routes, allow access
  return true;
};

const shouldBypass = (pathname: string) => {
  // Allow asset routes, Astro internals, authentication routes, and info routes
  return pathname.startsWith('/_astro') ||
    pathname.startsWith('/_image') ||
    pathname.startsWith('/assets') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/robots.txt') ||
    pathname.startsWith('/sitemap') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/authentication') ||
    pathname.startsWith('/info');
};

export const onRequest: MiddlewareHandler = async (context, next) => {
  // Middleware deshabilitado - Las validaciones se hacen en cada página con AuthGuard del cliente
  // El problema es que las cookies HttpOnly no están disponibles inmediatamente después del login
  // cuando se hace navegación del lado del cliente (window.location)
  return next();
};
