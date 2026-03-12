
import { API_URL, REMOTE_ASSETS_BASE_URL } from '../app/constants.js';
import type { Endpoint, EndpointsToOperations } from '../types/entities.ts';

// Llamada a la API (ya estaba)
export async function fetchData<Selected extends Endpoint>(
  endpoint: Selected,
  token?: string
): Promise<ReturnType<EndpointsToOperations[Selected]>> {
  const apiEndpoint = `${API_URL}${String(endpoint)}`;
  console.info(`📡 Fetching ${apiEndpoint}…`);

  const res = await fetch(apiEndpoint, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });

  if (!res.ok) {
    console.warn(`⚠️ Fetch failed with status ${res.status}`);
    throw new Error(`API Error ${res.status}`);
  }

  const data = await res.json() as ReturnType<EndpointsToOperations[Selected]>;
  return data;
}

// URL del sitio
export function url(path = '') {
	return `${import.meta.env.SITE}${import.meta.env.BASE_URL}${path}`;
}

// URL API back
export function apiUrl() {
	return `${API_URL}`;
}

// Actuales assets remotos
export function asset(path: string) {
  return `${REMOTE_ASSETS_BASE_URL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}

// ✅ NUEVO: assets locales
export function localAsset(path: string) {
	return new URL(`../assets/${path}`, import.meta.url).pathname;
}
