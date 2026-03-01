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
  logger.warn(`[cronMaster] Logger backend no disponible, usando consola. error=${error.message}`);
}
// mysql ya no se necesita, se usa endpoint del backend
// El cron llama a endpoints del backend para procesar datos

// Detectar entorno y cargar variables automáticamente
const networkInterfaces = os.networkInterfaces();
const isServer = Object.values(networkInterfaces)
  .flat()
  .some(iface => iface && iface.address === '172.20.10.151');

logger.info(`[cronMaster] Detección de entorno isServer=${isServer} networkInterfaces=${Object.keys(networkInterfaces).join(',')}`);

// Cargar archivo de configuración según entorno
const envFile = isServer ? '../env.server' : '../env.local';
logger.info(`[cronMaster] Intentando cargar archivo: ${envFile}`);
logger.info(`[cronMaster] Archivo existe: ${fs.existsSync(envFile)}`);

if (fs.existsSync(envFile)) {
  dotenv.config({ path: envFile });
  logger.info(`[cronMaster] Entorno detectado: ${isServer ? 'Servidor Ubuntu (172.20.10.151)' : 'Desarrollo local'}`);
  logger.info(`[cronMaster] Archivo de configuración cargado: ${envFile}`);
} else {
  logger.warn(`[cronMaster] Archivo de configuración no encontrado: ${envFile}`);
  logger.info(`[cronMaster] Directorio actual: ${process.cwd()}`);
  logger.info(`[cronMaster] Archivos en directorio: ${fs.readdirSync('.').join(', ')}`);
  dotenv.config(); // Fallback a .env si existe
}

// Configuración de la API del backend
let BACKEND_API_URL = process.env.BACKEND_API_URL || 'http://localhost:3000';

// Si estamos en Docker y no se cargó la configuración, forzar la URL correcta
if (isServer && BACKEND_API_URL === 'http://localhost:3000') {
  logger.info('[cronMaster] Forzando configuración para Docker...');
  BACKEND_API_URL = 'http://backend:3000';
}

// Verificación adicional: si detectamos que estamos en un contenedor Docker
if (process.env.DOCKER_ENV === 'true' || fs.existsSync('/.dockerenv')) {
  logger.info('[cronMaster] Detectado entorno Docker, usando backend:3000');
  BACKEND_API_URL = 'http://backend:3000';
}

logger.info(`[cronMaster] BACKEND_API_URL configurado: ${BACKEND_API_URL}`);
logger.info(`[cronMaster] Variables de entorno disponibles: ${Object.keys(process.env).filter(key => key.includes('BACKEND')).join(', ')}`);

// DB_CONFIG ya no se necesita, se usa endpoint del backend

// Función para obtener configuración de tareas desde el backend
async function getTaskConfig() {
  try {
    const response = await axios.get(`${BACKEND_API_URL}/api/cron/tasks-config`, {
      timeout: 10000,
      family: 4
    });
    
    if (response.data.success) {
      logger.info(`[cronMaster] Configuración de tareas cargada desde backend: ${JSON.stringify(response.data.config)}`);
      return response.data.config;
    } else {
      throw new Error('Respuesta del backend no exitosa');
    }
  } catch (error) {
    logger.error(`[cronMaster] Error cargando configuración desde backend: ${error.message}`);
    logger.info('[cronMaster] Usando configuración por defecto...');
    return {
      clean_database: false,
      check_clients: false,
      check_client_access: false,
      check_default_files: false
    };
  }
}

// Variables globales para configuración de tareas (se cargarán desde BD)
let taskConfig = {};

async function checkClientAccess() {
  logger.info('[cronMaster] Iniciando verificación de acceso de clientes...');
  try {
    const url = `${BACKEND_API_URL}/api/cron/check-client-access`;
    logger.info(`[cronMaster] Llamando al endpoint: ${url}`);
    const response = await axios.post(url, {}, {
      timeout: 300000, // 5 minutos
      family: 4, // Forzar IPv4
      headers: {
        'Content-Type': 'application/json'
      }
    });
    logger.info('[cronMaster] Verificación de acceso de clientes completada exitosamente');
  } catch (error) {
    logger.error(`[cronMaster] Error en checkClientAccess: ${error.message}`);
    throw error;
  }
}


async function checkDefaultFiles() {
  logger.info('[cronMaster] Iniciando verificación de archivos por defecto...');
  try {
    const url = `${BACKEND_API_URL}/api/cron/generate-default-files`;
    logger.info(`[cronMaster] Llamando al endpoint: ${url}`);
    const response = await axios.post(url, {}, {
      timeout: 300000, // 5 minutos
      family: 4, // Forzar IPv4
      headers: {
        'Content-Type': 'application/json'
      }
    });
    logger.info('[cronMaster] Verificación de archivos por defecto completada exitosamente');
  } catch (error) {
    logger.error(`[cronMaster] Error en checkDefaultFiles: ${error.message}`);
    throw error;
  }
}

async function executeSequence() {
  const startTime = new Date();
  logger.info('[cronMaster] Iniciando secuencia de tareas...');
  
  // Cargar configuración de tareas desde la base de datos
  taskConfig = await getTaskConfig();
  
  // El cron llama a endpoints del backend para procesar datos
  logger.info('[cronMaster] Iniciando tareas...');
  
  const tasks = [
    { name: 'Check Client Access', enabled: taskConfig.check_client_access, func: checkClientAccess },
    { name: 'Check Default Files', enabled: taskConfig.check_default_files, func: checkDefaultFiles }
  ];

  for (const task of tasks) {
    if (!task.enabled) {
      logger.info(`[cronMaster] ${task.name} deshabilitado - saltando...`);
      continue;
    }
    
    const taskStartTime = new Date();
    logger.info(`[cronMaster] TAREA ${task.name} HABILITADA - EJECUTANDO...`);
    
    try {
      await task.func();
      const taskEndTime = new Date();
      const taskDuration = taskEndTime - taskStartTime;
      logger.info(`[cronMaster] ${task.name} completado exitosamente`);
      
      // Esperar entre procesos
      logger.info('[cronMaster] Esperando 2 segundos...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      const taskErrorTime = new Date();
      const taskDuration = taskErrorTime - taskStartTime;
      logger.error(`[cronMaster] Error en ${task.name}: ${error.message}`);
      logger.info('[cronMaster] Continuando con el siguiente proceso...');
    }
  }
  
  const endTime = new Date();
  const totalDuration = endTime - startTime;
  logger.info('[cronMaster] Secuencia completada!');
  
  // El cron completa la secuencia de tareas
  logger.info('[cronMaster] Secuencia completada');
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
  logger.info('[cronMaster] Ejecutando secuencia inmediatamente...');
  (async () => {
    await executeSequence();
    logger.info('[cronMaster] Secuencia completada, terminando...');
    process.exit(0);
  })();
} else {
  // Solo levantar el proceso, NO ejecutar nada automáticamente
  logger.info('[cronMaster] Cron Master iniciado - esperando horario programado (07:00)...');
  emitReady();

  // Programar ejecución diaria a las 14:27
  cron.schedule('0 7 * * *', async () => {
    logger.info('[cronMaster] Iniciando secuencia programada...');
    try {
      await executeSequence();
      logger.info('[cronMaster] Secuencia programada completada exitosamente');
    } catch (error) {
      logger.error(`[cronMaster] Error en secuencia programada: ${error.message}`);
    }
  });
} 
