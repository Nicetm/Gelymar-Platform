import { defineConfig, envField } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import node from '@astrojs/node';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Detectar entorno y cargar variables automáticamente
const networkInterfaces = os.networkInterfaces();
const isServer = Object.values(networkInterfaces)
  .flat()
  .some(iface => iface && iface.address === '172.20.10.151') || 
  process.env.NODE_ENV === 'production' || 
  process.env.DOCKER_ENV === 'true';

// Cargar archivo de configuración según entorno
const envFile = isServer ? './env.server' : './env.local';
if (fs.existsSync(envFile)) {
  const envContent = fs.readFileSync(envFile, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0 && !key.startsWith('#')) {
      let value = valueParts.join('=').replace(/^['"]|['"]$/g, ''); // Remove quotes
      
      process.env[key.trim()] = value.trim();
    }
  });
}

// Asegurar que CI esté definida y debuggear
if (!process.env.CI) {
  process.env.CI = 'false';
}

// Forzar CI a false para desarrollo local
if (!isServer) {
  delete process.env.CI;
}

const appContext = process.env.APP_CONTEXT || process.env.PUBLIC_APP_CONTEXT || 'both';
if (!process.env.PUBLIC_APP_CONTEXT) {
  process.env.PUBLIC_APP_CONTEXT = appContext;
}

const DEFAULT_DEV_PORT = appContext === 'client'
  ? 2122
  : appContext === 'seller'
  ? 2123
  : 2121;
const DEV_PORT = Number(process.env.PORT || process.env.DEV_PORT || DEFAULT_DEV_PORT);

// Elimina archivos *.astro.tsx físicos antes de iniciar (si existieran)
const pagesPath = './src/pages';

if (fs.existsSync(pagesPath)) {
  fs.readdirSync(pagesPath).forEach(file => {
    const fullPath = path.join(pagesPath, file);
    if (file.endsWith('.astro.tsx') && fs.existsSync(fullPath)) {
      try {
        fs.renameSync(fullPath, path.join(pagesPath, `_${file}`));
      } catch (err) {
        console.error(`Could not rename ${file}:`, err.message);
      }
    }
  });
}

export default defineConfig({
  site: process.env.CI
    ? 'https://themesberg.github.io'
    : process.env.PUBLIC_FRONTEND_BASE_URL || `http://localhost:${DEV_PORT}`,
  base: process.env.CI ? '/flowbite-astro-admin-dashboard' : '/',

  server: {
    port: DEV_PORT,
  },

  output: 'server',
  adapter: node({
    mode: 'standalone'
  }),

  integrations: [
    sitemap(),
    tailwind(),
    react(),
  ],

  // alias para imports tipo @components/...
  vite: {
    resolve: {
      alias: {
        '@components': path.resolve('./src/components'),
        '@layouts': path.resolve('./src/layouts'),
        '@pages': path.resolve('./src/pages'),
        '@lib': path.resolve('./src/lib'),
        '@types': path.resolve('./src/types'),
        '@i18n': path.resolve('./src/i18n'),
        '@app': path.resolve('./src/app'),
      },
    },
  },

  env: {
    schema: {
      // URLs de servicios
      PUBLIC_API_URL: envField.string({ context: 'client', access: 'public' }),
      PUBLIC_FILE_SERVER_URL: envField.string({ context: 'client', access: 'public' }),
      PUBLIC_API_BASE_URL: envField.string({ context: 'client', access: 'public' }),
      PUBLIC_FRONTEND_BASE_URL: envField.string({ context: 'client', access: 'public' }),
      PUBLIC_APP_CONTEXT: envField.string({ context: 'client', access: 'public', optional: true }),
      PUBLIC_ADMIN_APP_URL: envField.string({ context: 'client', access: 'public', optional: true }),
      PUBLIC_CLIENT_APP_URL: envField.string({ context: 'client', access: 'public', optional: true }),
      PUBLIC_SELLER_APP_URL: envField.string({ context: 'client', access: 'public', optional: true }),
      SERVER_API_URL: envField.string({ context: 'server', access: 'public' }),
      
      // Configuración del sitio
      SITE: envField.string({ context: 'client', access: 'public' }),
      BASE_URL: envField.string({ context: 'client', access: 'public' }),
      REMOTE_ASSETS_BASE_URL: envField.string({ context: 'client', access: 'public' }),
      PUBLIC_LANG: envField.string({ context: 'client', access: 'public' }),
      
      // Build y desarrollo
      CI: envField.boolean({ context: 'server', access: 'public', optional: true }),
    }
  }
});
