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
  console.log(`🔧 [Frontend] Entorno detectado: ${isServer ? 'Servidor Ubuntu (172.20.10.151)' : 'Desarrollo local'}`);
}

// Asegurar que CI esté definida y debuggear
if (!process.env.CI) {
  process.env.CI = 'false';
}

console.log(`🔍 [Debug] CI value: "${process.env.CI}" (type: ${typeof process.env.CI})`);
console.log(`🔍 [Debug] CI evaluation: ${!!process.env.CI}`);
console.log(`🔍 [Debug] CI === 'false': ${process.env.CI === 'false'}`);
console.log(`🔍 [Debug] Will use base path: ${process.env.CI ? '/flowbite-astro-admin-dashboard' : '/'}`);

// Forzar CI a false para desarrollo local
if (!isServer) {
  delete process.env.CI;
  console.log(`🔧 [Debug] CI removed for local development`);
}



const DEV_PORT = 2121;

// Elimina archivos *.astro.tsx físicos antes de iniciar (si existieran)
const pagesPath = './src/pages';

if (fs.existsSync(pagesPath)) {
  fs.readdirSync(pagesPath).forEach(file => {
    const fullPath = path.join(pagesPath, file);
    if (file.endsWith('.astro.tsx') && fs.existsSync(fullPath)) {
      try {
        fs.renameSync(fullPath, path.join(pagesPath, `_${file}`));
        console.log(`Renamed unsupported file: ${file}`);
      } catch (err) {
        console.warn(`Could not rename ${file}:`, err.message);
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

  env: {
    schema: {
      // URLs de servicios
      PUBLIC_API_URL: envField.string({ context: 'client', access: 'public' }),
      PUBLIC_FILE_SERVER_URL: envField.string({ context: 'client', access: 'public' }),
      PUBLIC_API_BASE_URL: envField.string({ context: 'client', access: 'public' }),
      PUBLIC_FRONTEND_BASE_URL: envField.string({ context: 'client', access: 'public' }),
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
