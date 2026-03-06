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
  logger.warn(`[sendAvailableNotice] Logger backend no disponible, usando consola. error=${error.message}`);
}

// Detectar entorno y cargar variables automáticamente
const networkInterfaces = os.networkInterfaces();
const isServer = Object.values(networkInterfaces)
  .flat()
  .some(iface => iface && iface.address === '172.20.10.151');

logger.info(`[sendAvailableNotice] Detección de entorno isServer=${isServer}`);

// Cargar archivo de configuración según entorno
const envFile = isServer ? '../env.server' : '../env.local';

if (fs.existsSync(envFile)) {
  dotenv.config({ path: envFile });
  logger.info(`[sendAvailableNotice] Archivo de configuración cargado: ${envFile}`);
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

logger.info(`[sendAvailableNotice] BACKEND_API_URL configurado: ${BACKEND_API_URL}`);

// Función para obtener configuración de tareas desde el backend
async function getTaskConfig() {
  try {
    const response = await axios.get(`${BACKEND_API_URL}/api/cron/tasks-config`, {
      timeout: 10000,
      family: 4
    });
    
    if (response.data.success) {
      logger.info(`[sendAvailableNotice] Configuración de tareas cargada desde backend`);
      return response.data.config;
    } else {
      throw new Error('Respuesta del backend no exitosa');
    }
  } catch (error) {
    logger.error(`[sendAvailableNotice] Error cargando configuración desde backend: ${error.message}`);
    return {
      sendAutomaticOrderAvailability: false
    };
  }
}

async function executeTask() {
  const startTime = new Date();
  logger.info(`[sendAvailableNotice] Iniciando tarea - timestamp=${startTime.toISOString()}`);
  
  // Cargar configuración de tareas desde la base de datos
  const taskConfig = await getTaskConfig();
  
  // Verificar si la tarea está habilitada
  if (!taskConfig.sendAutomaticOrderAvailability || !taskConfig.sendAutomaticOrderAvailability.enabled) {
    logger.info('[sendAvailableNotice] Tarea deshabilitada en configuración - saltando ejecución');
    return;
  }
  
  logger.info('[sendAvailableNotice] Tarea habilitada - ejecutando...');
  
  try {
    const url = `${BACKEND_API_URL}/api/cron/process-availability-notices`;
    logger.info(`[sendAvailableNotice] Llamando al endpoint: ${url}`);
    
    const response = await axios.post(url, {}, {
      timeout: 300000,
      family: 4,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const endTime = new Date();
    const duration = endTime - startTime;
    
    logger.info(`[sendAvailableNotice] Tarea completada exitosamente - timestamp=${endTime.toISOString()} duration=${duration}ms`);
    
    const data = response.data || {};
    if (data.processed !== undefined) {
      logger.info(`[sendAvailableNotice] Documentos procesados: ${data.processed}`);
    }
  } catch (error) {
    const errorTime = new Date();
    const duration = errorTime - startTime;
    logger.error(`[sendAvailableNotice] Error en ejecución: ${error.message} - timestamp=${errorTime.toISOString()} duration=${duration}ms`);
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
  logger.info('[sendAvailableNotice] Ejecutando tarea inmediatamente...');
  (async () => {
    try {
      await executeTask();
      logger.info('[sendAvailableNotice] Tarea completada, terminando...');
      process.exit(0);
    } catch (error) {
      logger.error(`[sendAvailableNotice] Error en ejecución inmediata: ${error.message}`);
      process.exit(1);
    }
  })();
} else {
  (async () => {
    const taskConfig = await getTaskConfig();
    const schedule = taskConfig.sendAutomaticOrderAvailability?.schedule;
    const cronExpression = schedule ? convertTimeToCron(schedule) : '35 23 * * *';
    
    logger.info(`[sendAvailableNotice] Cron job iniciado - horario programado: ${schedule || '23:35'} (${cronExpression})`);
    emitReady();

    cron.schedule(cronExpression, async () => {
      logger.info('[sendAvailableNotice] Iniciando ejecución programada...');
      try {
        await executeTask();
        logger.info('[sendAvailableNotice] Ejecución programada completada exitosamente');
      } catch (error) {
        logger.error(`[sendAvailableNotice] Error en ejecución programada: ${error.message}`);
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
