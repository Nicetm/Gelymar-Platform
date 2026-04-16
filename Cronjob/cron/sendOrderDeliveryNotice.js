const axios = require('axios');
const cron = require('node-cron');
const dotenv = require('dotenv');
const os = require('os');
const fs = require('fs');
let logger;
try {
  ({ logger } = require('../../Backend/utils/logger'));
} catch (error) {
  logger = {
    info: console.log,
    warn: console.warn,
    error: console.error
  };
  logger.warn(`[sendOrderDeliveryNotice] Logger backend no disponible, usando consola. error=${error.message}`);
}

// Detectar entorno y cargar variables automáticamente
const networkInterfaces = os.networkInterfaces();
const isServer = Object.values(networkInterfaces)
  .flat()
  .some(iface => iface && iface.address === '172.20.10.151');

logger.info(`[sendOrderDeliveryNotice] Detección de entorno isServer=${isServer}`);

// Cargar archivo de configuración según entorno
const envFile = isServer ? '../env.server' : '../env.local';

if (fs.existsSync(envFile)) {
  dotenv.config({ path: envFile });
  logger.info(`[sendOrderDeliveryNotice] Archivo de configuración cargado: ${envFile}`);
} else {
  dotenv.config();
}

// Configuración de la API del backend
let BACKEND_API_URL = process.env.BACKEND_API_URL || 'http://localhost:3000';

if (isServer && BACKEND_API_URL === 'http://localhost:3000') {
  BACKEND_API_URL = 'http://backend:3000';
}

if (process.env.DOCKER_ENV === 'true' || fs.existsSync('/.dockerenv')) {
  BACKEND_API_URL = 'http://backend:3000';
}

logger.info(`[sendOrderDeliveryNotice] BACKEND_API_URL configurado: ${BACKEND_API_URL}`);

// Función para obtener configuración de tareas desde el backend
async function getTaskConfig() {
  try {
    const response = await axios.get(`${BACKEND_API_URL}/api/cron/tasks-config`, {
      timeout: 10000,
      family: 4
    });
    
    if (response.data.success) {
      logger.info(`[sendOrderDeliveryNotice] Configuración de tareas cargada desde backend`);
      return response.data.config;
    } else {
      throw new Error('Respuesta del backend no exitosa');
    }
  } catch (error) {
    logger.error(`[sendOrderDeliveryNotice] Error cargando configuración desde backend: ${error.message}`);
    return {
      sendAutomaticOrderDelivery: false
    };
  }
}

async function executeTask() {
  const startTime = new Date();
  logger.info(`[sendOrderDeliveryNotice] Iniciando tarea - timestamp=${startTime.toISOString()}`);
  
  // Cargar configuración de tareas desde la base de datos
  const taskConfig = await getTaskConfig();
  
  // Verificar si la tarea está habilitada
  if (!taskConfig.sendAutomaticOrderDelivery || !taskConfig.sendAutomaticOrderDelivery.enabled) {
    logger.info('[sendOrderDeliveryNotice] Tarea deshabilitada en configuración - saltando ejecución');
    return;
  }
  
  logger.info('[sendOrderDeliveryNotice] Tarea habilitada - ejecutando...');
  
  try {
    const url = `${BACKEND_API_URL}/api/cron/process-order-delivery-notices`;
    logger.info(`[sendOrderDeliveryNotice] Llamando al endpoint: ${url}`);
    
    const response = await axios.post(url, {}, {
      timeout: 300000,
      family: 4,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const endTime = new Date();
    const duration = endTime - startTime;
    
    logger.info(`[sendOrderDeliveryNotice] Tarea completada exitosamente - timestamp=${endTime.toISOString()} duration=${duration}ms`);
    
    const data = response.data || {};
    if (data.processed !== undefined) {
      logger.info(`[sendOrderDeliveryNotice] Documentos procesados: ${data.processed}`);
    }
  } catch (error) {
    const errorTime = new Date();
    const duration = errorTime - startTime;
    logger.error(`[sendOrderDeliveryNotice] Error en ejecución: ${error.message} - timestamp=${errorTime.toISOString()} duration=${duration}ms`);
    throw error;
  }
}

const emitReady = () => {
  if (process.send) {
    process.send('ready');
  }
};

const arg = process.argv[2];

if (arg === 'execute-now') {
  logger.info('[sendOrderDeliveryNotice] Ejecutando tarea inmediatamente...');
  (async () => {
    try {
      await executeTask();
      logger.info('[sendOrderDeliveryNotice] Tarea completada, terminando...');
      process.exit(0);
    } catch (error) {
      logger.error(`[sendOrderDeliveryNotice] Error en ejecución inmediata: ${error.message}`);
      process.exit(1);
    }
  })();
} else {
  (async () => {
    const { getTaskConfigWithRetry, convertTimeToCron: toCron } = require('./shared/cronHelper');
    const taskConfig = await getTaskConfigWithRetry(logger);
    const schedule = taskConfig?.sendAutomaticOrderDelivery?.schedule;
    const cronExpression = schedule ? (toCron(schedule) || '30 23 * * *') : '30 23 * * *';
    
    logger.info(`[sendOrderDeliveryNotice] Cron job iniciado - horario programado: ${schedule || '23:30'} (${cronExpression})`);
    emitReady();

    cron.schedule(cronExpression, async () => {
      logger.info('[sendOrderDeliveryNotice] Iniciando ejecución programada...');
      try {
        await executeTask();
        logger.info('[sendOrderDeliveryNotice] Ejecución programada completada exitosamente');
      } catch (error) {
        logger.error(`[sendOrderDeliveryNotice] Error en ejecución programada: ${error.message}`);
      }
    });
  })();
}

function convertTimeToCron(time) {
  if (!time || typeof time !== 'string') return null;
  const match = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const [, hours, minutes] = match;
  return `${minutes} ${hours} * * *`;
}
