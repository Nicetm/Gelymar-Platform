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
  logger.warn(`[generatePDFs] Logger backend no disponible, usando consola. error=${error.message}`);
}

// Detectar entorno y cargar variables automáticamente
const networkInterfaces = os.networkInterfaces();
const isServer = Object.values(networkInterfaces)
  .flat()
  .some(iface => iface && iface.address === '172.20.10.151');

logger.info(`[generatePDFs] Detección de entorno isServer=${isServer} networkInterfaces=${Object.keys(networkInterfaces).join(',')}`);

// Cargar archivo de configuración según entorno
const envFile = isServer ? '../env.server' : '../env.local';
logger.info(`[generatePDFs] Intentando cargar archivo: ${envFile}`);
logger.info(`[generatePDFs] Archivo existe: ${fs.existsSync(envFile)}`);

if (fs.existsSync(envFile)) {
  dotenv.config({ path: envFile });
  logger.info(`[generatePDFs] Entorno detectado: ${isServer ? 'Servidor Ubuntu (172.20.10.151)' : 'Desarrollo local'}`);
  logger.info(`[generatePDFs] Archivo de configuración cargado: ${envFile}`);
} else {
  logger.warn(`[generatePDFs] Archivo de configuración no encontrado: ${envFile}`);
  logger.info(`[generatePDFs] Directorio actual: ${process.cwd()}`);
  logger.info(`[generatePDFs] Archivos en directorio: ${fs.readdirSync('.').join(', ')}`);
  dotenv.config(); // Fallback a .env si existe
}

// Configuración de la API del backend
let BACKEND_API_URL = process.env.BACKEND_API_URL || 'http://localhost:3000';

// Si estamos en Docker y no se cargó la configuración, forzar la URL correcta
if (isServer && BACKEND_API_URL === 'http://localhost:3000') {
  logger.info('[generatePDFs] Forzando configuración para Docker...');
  BACKEND_API_URL = 'http://backend:3000';
}

// Verificación adicional: si detectamos que estamos en un contenedor Docker
if (process.env.DOCKER_ENV === 'true' || fs.existsSync('/.dockerenv')) {
  logger.info('[generatePDFs] Detectado entorno Docker, usando backend:3000');
  BACKEND_API_URL = 'http://backend:3000';
}

logger.info(`[generatePDFs] BACKEND_API_URL configurado: ${BACKEND_API_URL}`);
logger.info(`[generatePDFs] Variables de entorno disponibles: ${Object.keys(process.env).filter(key => key.includes('BACKEND')).join(', ')}`);

// Función para obtener configuración de tareas desde el backend
async function getTaskConfig() {
  try {
    const response = await axios.get(`${BACKEND_API_URL}/api/cron/tasks-config`, {
      timeout: 10000,
      family: 4
    });
    
    if (response.data.success) {
      logger.info(`[generatePDFs] Configuración de tareas cargada desde backend: ${JSON.stringify(response.data.config)}`);
      return response.data.config;
    } else {
      throw new Error('Respuesta del backend no exitosa');
    }
  } catch (error) {
    logger.error(`[generatePDFs] Error cargando configuración desde backend: ${error.message}`);
    logger.info('[generatePDFs] Usando configuración por defecto...');
    return {
      generate_pdfs: false
    };
  }
}

async function executeTask() {
  const startTime = new Date();
  logger.info(`[generatePDFs] Iniciando tarea - timestamp=${startTime.toISOString()}`);
  
  // Cargar configuración de tareas desde la base de datos
  const taskConfig = await getTaskConfig();
  
  // Verificar si la tarea está habilitada
  if (!taskConfig.generate_pdfs) {
    logger.info('[generatePDFs] Tarea deshabilitada en configuración - saltando ejecución');
    return;
  }
  
  logger.info('[generatePDFs] Tarea habilitada - ejecutando...');
  
  try {
    const url = `${BACKEND_API_URL}/api/cron/generate-pending-pdfs`;
    logger.info(`[generatePDFs] Llamando al endpoint: ${url}`);
    
    const response = await axios.post(url, {}, {
      timeout: 300000, // 5 minutos
      family: 4, // Forzar IPv4
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const endTime = new Date();
    const duration = endTime - startTime;
    
    logger.info(`[generatePDFs] Tarea completada exitosamente - timestamp=${endTime.toISOString()} duration=${duration}ms`);
    
    if (response.data && response.data.pdfsGenerated !== undefined) {
      logger.info(`[generatePDFs] PDFs generados: ${response.data.pdfsGenerated}`);
    }
  } catch (error) {
    const errorTime = new Date();
    const duration = errorTime - startTime;
    logger.error(`[generatePDFs] Error en ejecución: ${error.message} - timestamp=${errorTime.toISOString()} duration=${duration}ms`);
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
  logger.info('[generatePDFs] Ejecutando tarea inmediatamente...');
  (async () => {
    try {
      await executeTask();
      logger.info('[generatePDFs] Tarea completada, terminando...');
      process.exit(0);
    } catch (error) {
      logger.error(`[generatePDFs] Error en ejecución inmediata: ${error.message}`);
      process.exit(1);
    }
  })();
} else {
  // Solo levantar el proceso, NO ejecutar nada automáticamente
  logger.info('[generatePDFs] Cron job iniciado - esperando horario programado (7:30 AM)...');
  emitReady();

  // Programar ejecución diaria a las 7:30 AM
  cron.schedule('30 7 * * *', async () => {
    logger.info('[generatePDFs] Iniciando ejecución programada...');
    try {
      await executeTask();
      logger.info('[generatePDFs] Ejecución programada completada exitosamente');
    } catch (error) {
      logger.error(`[generatePDFs] Error en ejecución programada: ${error.message}`);
    }
  });
}
