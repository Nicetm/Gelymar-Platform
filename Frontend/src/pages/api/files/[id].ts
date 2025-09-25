import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ params, url }) => {
  const { id } = params;
  const token = url.searchParams.get('token');

  console.log(`🔍 [Frontend Proxy] Llamada recibida - id: ${id}, token: ${token ? 'presente' : 'ausente'}`);
  console.log(`🔍 [Frontend Proxy] URL completa: ${url.toString()}`);

  if (!id || !token) {
    console.log(`🔍 [Frontend Proxy] Parámetros faltantes`);
    return new Response('Missing parameters', { status: 400 });
  }

  try {
    // Usar la variable de entorno correcta
    const backendHost = import.meta.env.SERVER_API_URL || 'http://localhost:3000';
    const backendUrl = `${backendHost}/api/file-view/view-with-token/${id}?token=${token}`;
    
    console.log(`🔍 [Frontend Proxy] Llamando al backend: ${backendUrl}`);
    
    const response = await fetch(backendUrl, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log(`🔍 [Frontend Proxy] Respuesta del backend: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      return new Response('File not found', { status: response.status });
    }

    const fileBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'application/pdf';
    const contentDisposition = response.headers.get('content-disposition');

    const headers = new Headers();
    headers.set('Content-Type', contentType);
    if (contentDisposition) {
      headers.set('Content-Disposition', contentDisposition);
    }

    return new Response(fileBuffer, { headers });
  } catch (error) {
    console.error('Proxy error:', error);
    return new Response('Internal server error', { status: 500 });
  }
};
