
import { API_URL, REMOTE_ASSETS_BASE_URL } from '../app/constants.js';
import type { Endpoint, EndpointsToOperations } from '../types/entities.js';

// Llamada a la API (ya estaba)
export async function fetchData<Selected extends Endpoint>(endpoint: Selected) {
	const apiEndpoint = `${API_URL}${String(endpoint)}`;

	console.info(`Fetching ${apiEndpoint}…`);
	return fetch(apiEndpoint)
		.then(
			(r) =>
				r.json() as unknown as Promise<
					ReturnType<EndpointsToOperations[Selected]>
				>,
		)
		.catch((e) => {
			console.error(e);
			throw Error('Invalid API data!');
		});
}

// URL del sitio
export function url(path = '') {
	return `${import.meta.env.SITE}${import.meta.env.BASE_URL}${path}`;
}

// Actuales assets remotos
export function asset(path: string) {
  return `${REMOTE_ASSETS_BASE_URL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}

// ✅ NUEVO: assets locales
export function localAsset(path: string) {
	return new URL(`../assets/${path}`, import.meta.url).pathname;
}
