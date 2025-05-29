/// <reference types="astro/client" />

interface ImportMetaEnv {
	readonly API_URL: string;
	readonly REMOTE_ASSETS_BASE_URL: string;
	readonly SITE: string;
	readonly BASE_URL: string;
	readonly RANDOMIZE?: strin
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
