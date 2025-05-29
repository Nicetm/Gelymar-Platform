/// <reference types="astro/client" />

// https://docs.astro.build/en/guides/environment-variables/#intellisense-for-typescript
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
