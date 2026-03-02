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
  logger.warn(`[checkClientAccess] Logger backend no disponible, usando consola. error=${error.message}`);
}

// Detectar entorno y cargar variables automáticamente
const networkInterfaces = os.networkInterfaces();
const isServer = Object.values(networkInterfaces)
  .flat()
  .some(iface => iface && iface.address === '172.20.10.151');

logger.info(`[checkClientAccess] Detección de entorno isServer=${isServer} networkInterfaces=${Object.keys(networkInterfaces).join(',')}`);

// Cargar archivo de configuración según entorno
const envFile = isServer ? '../env.server' : '../env.local';
logger.info(`[checkClientAccess] Intentando cargar archivo: ${envFile}`);
logger.info(`[checkClientAccess] Archivo existe: ${fs.existsSync(envFile)}`);

if (fs.existsSync(envFile)) {
  dotenv.config({ path: envFile });
  logger.info(`[checkClientAccess] Entorno detectado: ${isServer ? 'Servidor Ubuntu (172.20.10.151)' : 'Desarrollo local'}`);
  logger.info(`[checkClientAccess] Archivo de configuración cargado: ${envFile}`);
} else {
  logger.warn(`[checkClientAccess] Archivo de configuración no encontrado: ${envFile}`);
  logger.info(`[checkClientAccess] Directorio actual: ${process.cwd()}`);
  logger.info(`[checkClientAccess] Archivos en directorio: ${fs.readdirSync('.').join(', ')}`);
  dotenv.config(); // Fallback a .env si existe
}

// Configuración de la API del backend
let BACKEND_API_URL = process.env.BACKEND_API_URL || 'http://localhost:3000';

// Si estamos en Docker y no se cargó la configuración, forzar la URL correcta
if (isServer && BACKEND_API_URL === 'http://localhost:3000') {
  logger.info('[checkClientAccess] Forzando configuración para Docker...');
  BACKEND_API_URL = 'http://backend:3000';
}

// Verificación adicional: si detectamos que estamos en un contenedor Docker
if (process.env.DOCKER_ENV === 'true' || fs.existsSync('/.dockerenv')) {
  logger.info('[checkClientAccess] Detectado entorno Docker, usando backend:3000');
  BACKEND_API_URL = 'http://backend:3000';
}

logger.info(`[checkClientAccess] BACKEND_API_URL configurado: ${BACKEND_API_URL}`);
logger.info(`[checkClientAccess] Variables de entorno disponibles: ${Object.keys(process.env).filter(key => key.includes('BACKEND')).join(', ')}`);

// Función para obtener configuración de tareas desde el backend
async function getTaskConfig() {
  try {
    const response = await axios.get(`${BACKEND_API_URL}/api/cron/tasks-config`, {
      timeout: 10000,
      family: 4
    });
    
    if (response.data.success) {
      logger.info(`[checkClientAccess] Configuración de tareas cargada desde backend: ${JSON.stringify(response.data.config)}`);
      return response.data.config;
    } else {
      throw new Error('Respuesta del backend no exitosa');
    }
  } catch (error) {
    logger.error(`[checkClientAccess] Error cargando configuración desde backend: ${error.message}`);
    logger.info('[checkClientAccess] Usando configuración por defecto...');
    return {
      check_client_access: false
    };
  }
}

async function executeTask() {
  const startTime = new Date();
  logger.info(`[checkClientAccess] Iniciando tarea - timestamp=${startTime.toISOString()}`);
  
  // Cargar configuración de tareas desde la base de datos
  const taskConfig = await getTaskConfig();
  
  // Verificar si la tarea está habilitada
  if (!taskConfig.check_client_access) {
    logger.info('[checkClientAccess] Tarea deshabilitada en configuración - saltando ejecución');
    return;
  }
  
  logger.info('[checkClientAccess] Tarea habilitada - ejecutando...');
  
  try {
    const url = `${BACKEND_API_URL}/api/cron/check-client-access`;
    logger.info(`[checkClientAccess] Llamando al endpoint: ${url}`);
    
    const response = await axios.post(url, {}, {
      timeout: 300000, // 5 minutos
      family: 4, // Forzar IPv4
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const endTime = new Date();
    const duration = endTime - startTime;
    
    logger.info(`[checkClientAccess] Tarea completada exitosamente - timestamp=${endTime.toISOString()} duration=${duration}ms`);
    
    if (response.data && response.data.message) {
      logger.info(`[checkClientAccess] ${response.data.message}`);
    }
  } catch (error) {
    const errorTime = new Date();
    const duration = errorTime - startTime;
    logger.error(`[checkClientAccess] Error en ejecución: ${error.message} - timestamp=${errorTime.toISOString()} duration=${duration}ms`);
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
  logger.info('[checkClientAccess] Ejecutando tarea inmediatamente...');
  (async () => {
    try {
      await executeTask();
      logger.info('[checkClientAccess] Tarea completada, terminando...');
      process.exit(0);
    } catch (error) {
      logger.error(`[checkClientAccess] Error en ejecución inmediata: ${error.message}`);
      process.exit(1);
    }
  })();
} else {
  // Solo levantar el proceso, NO ejecutar nada automáticamente
  logger.info('[checkClientAccess] Cron job iniciado - esperando horario programado (15:47)...');
  emitReady();

  // Programar ejecución diaria a las 15:47
  cron.schedule('47 15 * * *', async () => {
    logger.info('[checkClientAccess] Iniciando ejecución programada...');
    try {
      await executeTask();
      logger.info('[checkClientAccess] Ejecución programada completada exitosamente');
    } catch (error) {
      logger.error(`[checkClientAccess] Error en ejecución programada: ${error.message}`);
    }
  });
}
