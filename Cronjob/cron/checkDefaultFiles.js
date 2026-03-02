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
  logger.warn(`[checkDefaultFiles] Logger backend no disponible, usando consola. error=${error.message}`);
}

// Detectar entorno y cargar variables automáticamente
const networkInterfaces = os.networkInterfaces();
const isServer = Object.values(networkInterfaces)
  .flat()
  .some(iface => iface && iface.address === '172.20.10.151');

logger.info(`[checkDefaultFiles] Detección de entorno isServer=${isServer} networkInterfaces=${Object.keys(networkInterfaces).join(',')}`);

// Cargar archivo de configuración según entorno
const envFile = isServer ? '../env.server' : '../env.local';
logger.info(`[checkDefaultFiles] Intentando cargar archivo: ${envFile}`);
logger.info(`[checkDefaultFiles] Archivo existe: ${fs.existsSync(envFile)}`);

if (fs.existsSync(envFile)) {
  dotenv.config({ path: envFile });
  logger.info(`[checkDefaultFiles] Entorno detectado: ${isServer ? 'Servidor Ubuntu (172.20.10.151)' : 'Desarrollo local'}`);
  logger.info(`[checkDefaultFiles] Archivo de configuración cargado: ${envFile}`);
} else {
  logger.warn(`[checkDefaultFiles] Archivo de configuración no encontrado: ${envFile}`);
  logger.info(`[checkDefaultFiles] Directorio actual: ${process.cwd()}`);
  logger.info(`[checkDefaultFiles] Archivos en directorio: ${fs.readdirSync('.').join(', ')}`);
  dotenv.config(); // Fallback a .env si existe
}

// Configuración de la API del backend
let BACKEND_API_URL = process.env.BACKEND_API_URL || 'http://localhost:3000';

// Si estamos en Docker y no se cargó la configuración, forzar la URL correcta
if (isServer && BACKEND_API_URL === 'http://localhost:3000') {
  logger.info('[checkDefaultFiles] Forzando configuración para Docker...');
  BACKEND_API_URL = 'http://backend:3000';
}

// Verificación adicional: si detectamos que estamos en un contenedor Docker
if (process.env.DOCKER_ENV === 'true' || fs.existsSync('/.dockerenv')) {
  logger.info('[checkDefaultFiles] Detectado entorno Docker, usando backend:3000');
  BACKEND_API_URL = 'http://backend:3000';
}

logger.info(`[checkDefaultFiles] BACKEND_API_URL configurado: ${BACKEND_API_URL}`);
logger.info(`[checkDefaultFiles] Variables de entorno disponibles: ${Object.keys(process.env).filter(key => key.includes('BACKEND')).join(', ')}`);

// Función para obtener configuración de tareas desde el backend
async function getTaskConfig() {
  try {
    const response = await axios.get(`${BACKEND_API_URL}/api/cron/tasks-config`, {
      timeout: 10000,
      family: 4
    });
    
    if (response.data.success) {
      logger.info(`[checkDefaultFiles] Configuración de tareas cargada desde backend: ${JSON.stringify(response.data.config)}`);
      return response.data.config;
    } else {
      throw new Error('Respuesta del backend no exitosa');
    }
  } catch (error) {
    logger.error(`[checkDefaultFiles] Error cargando configuración desde backend: ${error.message}`);
    logger.info('[checkDefaultFiles] Usando configuración por defecto...');
    return {
      check_default_files: false
    };
  }
}

async function executeTask() {
  const startTime = new Date();
  logger.info(`[checkDefaultFiles] Iniciando tarea - timestamp=${startTime.toISOString()}`);
  
  // Cargar configuración de tareas desde la base de datos
  const taskConfig = await getTaskConfig();
  
  // Verificar si la tarea está habilitada
  if (!taskConfig.check_default_files) {
    logger.info('[checkDefaultFiles] Tarea deshabilitada en configuración - saltando ejecución');
    return;
  }
  
  logger.info('[checkDefaultFiles] Tarea habilitada - ejecutando...');
  
  try {
    const url = `${BACKEND_API_URL}/api/cron/create-default-records`;
    logger.info(`[checkDefaultFiles] Llamando al endpoint: ${url}`);
    
    const response = await axios.post(url, {}, {
      timeout: 300000, // 5 minutos
      family: 4, // Forzar IPv4
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const endTime = new Date();
    const duration = endTime - startTime;
    
    logger.info(`[checkDefaultFiles] Tarea completada exitosamente - timestamp=${endTime.toISOString()} duration=${duration}ms`);
    
    if (response.data && response.data.recordsCreated !== undefined) {
      logger.info(`[checkDefaultFiles] Registros creados: ${response.data.recordsCreated}`);
    }
  } catch (error) {
    const errorTime = new Date();
    const duration = errorTime - startTime;
    logger.error(`[checkDefaultFiles] Error en ejecución: ${error.message} - timestamp=${errorTime.toISOString()} duration=${duration}ms`);
    throw error;
  }
}

// Función para emitir señal de ready
const emitReady = () => {
  if (process.send) {
    process.send('ready');
  }
};

// Verificar si se debe ejecutar inmediatamente
const arg = process.argv[2];

if (arg === 'execute-now') {
  logger.info('[checkDefaultFiles] Ejecutando tarea inmediatamente...');
  (async () => {
    try {
      await executeTask();
      logger.info('[checkDefaultFiles] Tarea completada, terminando...');
      process.exit(0);
    } catch (error) {
      logger.error(`[checkDefaultFiles] Error en ejecución inmediata: ${error.message}`);
      process.exit(1);
    }
  })();
} else {
  // Solo levantar el proceso, NO ejecutar nada automáticamente
  logger.info('[checkDefaultFiles] Cron job iniciado - esperando horario programado (15:47)...');
  emitReady();

  // Programar ejecución diaria a las 15:47
  cron.schedule('47 15 * * *', async () => {
    logger.info('[checkDefaultFiles] Iniciando ejecución programada...');
    try {
      await executeTask();
      logger.info('[checkDefaultFiles] Ejecución programada completada exitosamente');
    } catch (error) {
      logger.error(`[checkDefaultFiles] Error en ejecución programada: ${error.message}`);
    }
  });
}
