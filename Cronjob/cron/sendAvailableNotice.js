const axios = require('axios');
const cron = require('node-cron');
let logger;
try {
  ({ logger } = require('../../Backend/utils/logger'));
} catch (error) {
  logger = {
    info: console.log,
    warn: console.warn,
    error: console.error
  };
  logger.warn(`[processAvailabilityNotices] Logger backend no disponible, usando consola. error=${error.message}`);
}

const BACKEND_API_URL = process.env.BACKEND_API_URL || 'http://localhost:3000';

const emitReady = () => {
  if (process.send) {
    process.send('ready');
  }
};

async function processAvailabilityNotices() {
  try {
    const url = `${BACKEND_API_URL}/api/cron/process-availability-notices`;
    const response = await axios.post(url, {}, {
      timeout: 300000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    const data = response.data || {};

    if (data.processed === 0) {
      logger.info('[processAvailabilityNotices] No se encontraron Availability Notice para enviar');
    } else {
      logger.info(`[processAvailabilityNotices] Availability Notice enviados: ${data.processed}`);
    }
  } catch (error) {
    logger.error(`[processAvailabilityNotices] Error en procesamiento de Availability Notice: ${error.message}`);
    if (error.response) {
      logger.error(`[processAvailabilityNotices] Respuesta del servidor: ${JSON.stringify(error.response.data)}`);
    }
  }
}

async function executeWithErrorHandling() {
  try {
    await processAvailabilityNotices();
  } catch (error) {
    logger.error(`[processAvailabilityNotices] Error en procesamiento: ${error.message}`);
  } finally {
    emitReady();
  }
}

const arg = process.argv[2];

if (arg === 'execute-now') {
  executeWithErrorHandling();
} else {
  emitReady();
}

// Cron diario - se ejecuta a las 15:55
cron.schedule('55 15 * * *', async () => {
  try {
    await processAvailabilityNotices();
  } catch (error) {
    logger.error(`[processAvailabilityNotices] Error en procesamiento de Availability Notice: ${error.message}`);
  }
});
