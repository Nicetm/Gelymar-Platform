import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ params, url }) => {
  const { id } = params;
  const token = url.searchParams.get('token');

  if (!id || !token) {
    return new Response('Missing parameters', { status: 400 });
  }

  try {
    // Usar la variable de entorno correcta
    const backendHost = import.meta.env.SERVER_API_URL || 'http://localhost:3000';
    const backendUrl = `${backendHost}/api/file-view/view-with-token/${id}?token=${token}`; 
    const response = await fetch(backendUrl, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
        
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
