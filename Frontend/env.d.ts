/// <reference types="astro/client" />

interface ImportMetaEnv {
	// URLs de servicios
	readonly PUBLIC_API_URL: string;
	readonly PUBLIC_FILE_SERVER_URL: string;
	readonly PUBLIC_API_BASE_URL: string;
	readonly PUBLIC_FRONTEND_BASE_URL: string;
	readonly SERVER_API_URL: string;
	
	// Configuración del sitio
	readonly SITE: string;
	readonly BASE_URL: string;
	readonly REMOTE_ASSETS_BASE_URL: string;
	readonly PUBLIC_LANG: string;
	
	// Build y desarrollo
	readonly CI: boolean;
	readonly DEV: boolean;
	readonly PROD: boolean;
	readonly RANDOMIZE: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}

declare namespace App {
  interface Locals {
    user: {
      id: number;
      email: string;
      username: string;
      role: 'admin' | 'user' | 'client';
      cardCode?: string;
    };
  }
}