const axios = require('axios');
const fs = require('fs');
const dotenv = require('dotenv');
const os = require('os');

// Logger fallback
function createLogger(tag) {
  return {
    info: (...args) => console.log(`[${tag}]`, ...args),
    warn: (...args) => console.warn(`[${tag}]`, ...args),
    error: (...args) => console.error(`[${tag}]`, ...args)
  };
}

// Detectar y configurar BACKEND_API_URL
function getBackendUrl() {
  const networkInterfaces = os.networkInterfaces();
  const isServer = Object.values(networkInterfaces)
    .flat()
    .some(iface => iface && iface.address === '172.20.10.151');

  if (!isServer) {
    const envFile = '../env.local';
    if (fs.existsSync(envFile)) {
      dotenv.config({ path: envFile });
    }
  }

  if (process.env.DOCKER_ENV === 'true' || fs.existsSync('/.dockerenv')) {
    return 'http://backend:3000';
  }

  return process.env.BACKEND_API_URL || 'http://localhost:3000';
}

/**
 * Obtiene la config de tareas cron con reintentos.
 * Espera a que el backend esté listo antes de devolver la config.
 */
async function getTaskConfigWithRetry(logger, { maxRetries = 20, delayMs = 5000 } = {}) {
  const url = `${getBackendUrl()}/api/cron/tasks-config`;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.get(url, { timeout: 10000, family: 4 });
      if (response.data.success) {
        return response.data.config;
      }
      throw new Error('Respuesta no exitosa');
    } catch (error) {
      if (attempt < maxRetries) {
        logger.warn(`Esperando backend (intento ${attempt}/${maxRetries})...`);
        await new Promise(r => setTimeout(r, delayMs));
      } else {
        logger.error(`Backend no disponible después de ${maxRetries} intentos: ${error.message}`);
        return null;
      }
    }
  }
  return null;
}

function convertTimeToCron(time) {
  if (!time || typeof time !== 'string') return null;
  const match = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const [, hours, minutes] = match;
  return `${minutes} ${hours} * * *`;
}

module.exports = { createLogger, getBackendUrl, getTaskConfigWithRetry, convertTimeToCron };
