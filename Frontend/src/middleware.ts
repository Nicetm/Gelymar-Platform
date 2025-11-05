import type { MiddlewareHandler } from 'astro';

const appContext = (import.meta.env.PUBLIC_APP_CONTEXT || 'both').toLowerCase();

const shouldBypass = (pathname: string) => {
  // Allow asset routes and Astro internals
  return pathname.startsWith('/_astro') ||
    pathname.startsWith('/_image') ||
    pathname.startsWith('/assets') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/robots.txt') ||
    pathname.startsWith('/sitemap') ||
    pathname.startsWith('/api');
};

export const onRequest: MiddlewareHandler = async (context, next) => {
  const { request } = context;
  if (appContext === 'both') {
    return next();
  }

  const { pathname } = new URL(request.url);
  if (shouldBypass(pathname)) {
    return next();
  }

  if (appContext === 'client' && (pathname.startsWith('/admin') || pathname.startsWith('/seller'))) {
    return new Response('Not Found', { status: 404 });
  }

  if (appContext === 'admin' && (pathname.startsWith('/client') || pathname.startsWith('/seller'))) {
    return new Response('Not Found', { status: 404 });
  }

  if (appContext === 'seller' && (pathname.startsWith('/admin') || pathname.startsWith('/client'))) {
    return new Response('Not Found', { status: 404 });
  }

  return next();
};
