
import { API_URL, REMOTE_ASSETS_BASE_URL } from '../app/constants.js';
import type { Endpoint, EndpointsToOperations } from '../types/entities.ts';

// Llamada a la API (ya estaba)
export async function fetchData<Selected extends Endpoint>(
	endpoint: Selected,
	token?: string // ⬅ nuevo parámetro opcional
) {
	const apiEndpoint = `${API_URL}${String(endpoint)}`;
	console.info(`📡 Fetching ${apiEndpoint}…`);

	return fetch(apiEndpoint, {
		headers: token
			? { Authorization: `Bearer ${token}` }
			: {} // sin header si no hay token
	})
		.then(
			(r) =>
				r.json() as unknown as Promise<
					ReturnType<EndpointsToOperations[Selected]>
				>
		)
		.catch((e) => {
			console.error('❌ fetchData error:', e);
			throw Error('Invalid API data!');
		});
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
