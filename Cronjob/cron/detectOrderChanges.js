const axios = require('axios');
const cron = require('node-cron');
const dotenv = require('dotenv');
const os = require('os');
const fs = require('fs');
let logger;
try {
  ({ logger } = require('../../Backend/utils/logger'));
} catch (error) {
  logger = { info: console.log, warn: console.warn, error: console.error };
  logger.warn(`[detectOrderChanges] Logger backend no disponible, usando consola. error=${error.message}`);
}

const networkInterfaces = os.networkInterfaces();
const isServer = Object.values(networkInterfaces)
  .flat()
  .some(iface => iface && iface.address === '172.20.10.151');

const envFile = isServer ? '../env.server' : '../env.local';
if (fs.existsSync(envFile)) {
  dotenv.config({ path: envFile });
} else {
  dotenv.config();
}

let BACKEND_API_URL = process.env.BACKEND_API_URL || 'http://localhost:3000';
if (isServer && BACKEND_API_URL === 'http://localhost:3000') {
  BACKEND_API_URL = 'http://backend:3000';
}
if (process.env.DOCKER_ENV === 'true' || fs.existsSync('/.dockerenv')) {
  BACKEND_API_URL = 'http://backend:3000';
}

logger.info(`[detectOrderChanges] BACKEND_API_URL=${BACKEND_API_URL}`);

async function getTaskConfig() {
  try {
    const response = await axios.get(`${BACKEND_API_URL}/api/cron/tasks-config`, {
      timeout: 10000,
      family: 4
    });
    if (response.data.success) {
      return response.data.config;
    }
    throw new Error('Respuesta no exitosa');
  } catch (error) {
    logger.error(`[detectOrderChanges] Error cargando config: ${error.message}`);
    return {};
  }
}

async function executeTask() {
  const startTime = new Date();
  logger.info(`[detectOrderChanges] Iniciando tarea - timestamp=${startTime.toISOString()}`);

  const taskConfig = await getTaskConfig();
  if (!taskConfig.orderChangeDetection || !taskConfig.orderChangeDetection.enabled) {
    logger.info('[detectOrderChanges] Tarea deshabilitada - saltando ejecución');
    return;
  }

  try {
    const url = `${BACKEND_API_URL}/api/cron/detect-order-changes`;
    const response = await axios.post(url, {}, {
      timeout: 300000,
      family: 4,
      headers: { 'Content-Type': 'application/json' }
    });

    const data = response.data || {};
    const duration = new Date() - startTime;
    if (data.skipped) {
      logger.info(`[detectOrderChanges] Tarea omitida (deshabilitada) - ${duration}ms`);
    } else {
      logger.info(`[detectOrderChanges] Completado - ordenes=${data.ordersProcessed} cambios=${data.changesDetected} errores=${data.errorsCount} - ${duration}ms`);
    }
  } catch (error) {
    logger.error(`[detectOrderChanges] Error: ${error.message}`);
  }
}

function convertTimeToCron(time) {
  if (!time || typeof time !== 'string') return null;
  // Si ya es una expresión cron (contiene espacios y */), usarla directamente
  if (time.includes(' ') || time.includes('*') || time.includes('/')) return time;
  const match = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const [, hours, minutes] = match;
  return `${minutes} ${hours} * * *`;
}

const emitReady = () => { if (process.send) process.send('ready'); };
const arg = process.argv[2];

if (arg === 'execute-now') {
  (async () => {
    try {
      await executeTask();
      process.exit(0);
    } catch (error) {
      logger.error(`[detectOrderChanges] Error en ejecución inmediata: ${error.message}`);
      process.exit(1);
    }
  })();
} else {
  (async () => {
    const { getTaskConfigWithRetry, convertTimeToCron: toCron } = require('./shared/cronHelper');
    const taskConfig = await getTaskConfigWithRetry(logger);
    const schedule = taskConfig?.orderChangeDetection?.schedule;
    const cronExpression = schedule ? (toCron(schedule) || '0 8 * * *') : '0 8 * * *';

    logger.info(`[detectOrderChanges] Cron iniciado - horario: ${schedule || '08:00'} (${cronExpression})`);
    emitReady();

    cron.schedule(cronExpression, async () => {
      logger.info('[detectOrderChanges] Iniciando ejecución programada...');
      try {
        await executeTask();
      } catch (error) {
        logger.error(`[detectOrderChanges] Error en ejecución programada: ${error.message}`);
      }
    });
  })();
}
