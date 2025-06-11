/// <reference types="astro/client" />

interface ImportMetaEnv {
	readonly PUBLIC_API_URL: string;
	readonly PUBLIC_FILE_SERVER_URL: string;
	readonly REMOTE_ASSETS_BASE_URL: string;
	readonly SITE: string;
	readonly BASE_URL: string;
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