import { defineConfig, envField } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import fs from 'fs';
import path from 'path';

import netlify from '@astrojs/netlify';

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
  base: process.env.CI ? '/flowbite-astro-admin-dashboard' : undefined,

  server: {
    port: DEV_PORT,
  },

  output: 'server',
  adapter: netlify(),

  integrations: [
    sitemap(),
    tailwind(),
		react(),
  ],

  env: {
    schema: {
      PUBLIC_API_URL: envField.string({ context: 'client', access: 'public' }),
      PUBLIC_FILE_SERVER_URL: envField.string({ context: 'client', access: 'public' }),
    }
  }
});
