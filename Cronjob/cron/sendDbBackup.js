const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const { spawn } = require('child_process');
const zlib = require('zlib');
const axios = require('axios');
const dotenv = require('dotenv');
const os = require('os');
let logger;
try {
  ({ logger } = require('../../Backend/utils/logger'));
} catch (error) {
  logger = {
    info: console.log,
    warn: console.warn,
    error: console.error
  };
  logger.warn(`[sendDbBackup] Logger backend no disponible, usando consola. error=${error.message}`);
}

// Detectar entorno y cargar variables automáticamente
const networkInterfaces = os.networkInterfaces();
const isServer = Object.values(networkInterfaces)
  .flat()
  .some(iface => iface && iface.address === '172.20.10.151');

logger.info(`[sendDbBackup] Detección de entorno isServer=${isServer} networkInterfaces=${Object.keys(networkInterfaces).join(',')}`);

// Cargar archivo de configuración según entorno
const envFile = isServer ? '../env.server' : '../env.local';
logger.info(`[sendDbBackup] Intentando cargar archivo: ${envFile}`);
logger.info(`[sendDbBackup] Archivo existe: ${fs.existsSync(envFile)}`);

if (fs.existsSync(envFile)) {
  dotenv.config({ path: envFile });
  logger.info(`[sendDbBackup] Entorno detectado: ${isServer ? 'Servidor Ubuntu (172.20.10.151)' : 'Desarrollo local'}`);
  logger.info(`[sendDbBackup] Archivo de configuración cargado: ${envFile}`);
} else {
  logger.warn(`[sendDbBackup] Archivo de configuración no encontrado: ${envFile}`);
  logger.info(`[sendDbBackup] Directorio actual: ${process.cwd()}`);
  logger.info(`[sendDbBackup] Archivos en directorio: ${fs.readdirSync('.').join(', ')}`);
  dotenv.config(); // Fallback a .env si existe
}

// Configuración de la API del backend
let BACKEND_API_URL = process.env.BACKEND_API_URL || 'http://localhost:3000';

// Si estamos en Docker y no se cargó la configuración, forzar la URL correcta
if (isServer && BACKEND_API_URL === 'http://localhost:3000') {
  logger.info('[sendDbBackup] Forzando configuración para Docker...');
  BACKEND_API_URL = 'http://backend:3000';
}

// Verificación adicional: si detectamos que estamos en un contenedor Docker
if (process.env.DOCKER_ENV === 'true' || fs.existsSync('/.dockerenv')) {
  logger.info('[sendDbBackup] Detectado entorno Docker, usando backend:3000');
  BACKEND_API_URL = 'http://backend:3000';
}

logger.info(`[sendDbBackup] BACKEND_API_URL configurado: ${BACKEND_API_URL}`);

// Función para obtener configuración de tareas desde el backend
async function getTaskConfig() {
  try {
    const response = await axios.get(`${BACKEND_API_URL}/api/cron/tasks-config`, {
      timeout: 10000,
      family: 4
    });
    
    if (response.data.success) {
      logger.info(`[sendDbBackup] Configuración de tareas cargada desde backend: ${JSON.stringify(response.data.config)}`);
      return response.data.config;
    } else {
      throw new Error('Respuesta del backend no exitosa');
    }
  } catch (error) {
    logger.error(`[sendDbBackup] Error cargando configuración desde backend: ${error.message}`);
    logger.info('[sendDbBackup] Usando configuración por defecto...');
    return {
      sendDbBackup: { enabled: false, schedule: '02:00' }
    };
  }
}

function convertTimeToCron(time) {
  if (!time || typeof time !== 'string') return null;
  const match = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const [, hours, minutes] = match;
  return `${minutes} ${hours} * * *`;
}

const emitReady = () => {
  if (process.send) {
    process.send('ready');
  }
};

function getBackupDir() {
  if (process.env.DB_BACKUP_DIR) {
    return process.env.DB_BACKUP_DIR;
  }
  return '/var/backups/gelymar';
}

function getBackupFileName(dbName) {
  const stamp = new Date().toISOString().slice(0, 10);
  return `backup_${dbName}_${stamp}.sql.gz`;
}

function removeOldBackups(backupDir, keepFile) {
  if (!fs.existsSync(backupDir)) {
    return;
  }
  const files = fs.readdirSync(backupDir);
  files.forEach((file) => {
    if (file.endsWith('.sql.gz') && file != keepFile) {
      try {
        fs.unlinkSync(path.join(backupDir, file));
      } catch (error) {
        logger.error(`[sendDbBackup] Error removing old backup ${file}: ${error.message}`);
      }
    }
  });
}

async function runBackup() {
  const dbHost = process.env.MYSQL_DB_HOST;
  const dbUser = process.env.MYSQL_DB_USER;
  const dbPass = process.env.MYSQL_DB_PASS;
  const dbName = process.env.MYSQL_DB_NAME;

  if (!dbHost || !dbUser || !dbPass || !dbName) {
    throw new Error('Missing MYSQL_DB_HOST/MYSQL_DB_USER/MYSQL_DB_PASS/MYSQL_DB_NAME env vars');
  }

  const backupDir = getBackupDir();
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const fileName = getBackupFileName(dbName);
  const filePath = path.join(backupDir, fileName);

  removeOldBackups(backupDir, fileName);

  const args = [
    '-h', dbHost,
    '-u', dbUser,
    '--databases', dbName,
    '--single-transaction',
    '--quick',
    '--lock-tables=false'
  ];

  logger.info(`[sendDbBackup] Starting backup: ${filePath}`);

  const dump = spawn('mysqldump', args, {
    env: { ...process.env, MYSQL_PWD: dbPass }
  });

  const gzip = zlib.createGzip();
  const output = fs.createWriteStream(filePath);

  dump.stdout.pipe(gzip).pipe(output);

  let stderr = '';
  dump.stderr.on('data', (data) => {
    stderr += data.toString();
  });

  return new Promise((resolve, reject) => {
    dump.on('error', (error) => {
      reject(error);
    });

    output.on('finish', () => {
      resolve(filePath);
    });

    dump.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`mysqldump failed (code ${code}): ${stderr.trim()}`));
      }
    });
  });
}

async function executeTask() {
  const startTime = new Date();
  logger.info(`[sendDbBackup] Iniciando tarea - timestamp=${startTime.toISOString()}`);
  
  // Cargar configuración de tareas desde la base de datos
  const taskConfig = await getTaskConfig();
  
  // Verificar si la tarea está habilitada
  if (!taskConfig.sendDbBackup || !taskConfig.sendDbBackup.enabled) {
    logger.info('[sendDbBackup] Tarea deshabilitada en configuración - saltando ejecución');
    return;
  }
  
  logger.info('[sendDbBackup] Tarea habilitada - ejecutando...');
  
  try {
    const filePath = await runBackup();
    const endTime = new Date();
    const duration = endTime - startTime;
    
    logger.info(`[sendDbBackup] Backup completado exitosamente: ${filePath} - timestamp=${endTime.toISOString()} duration=${duration}ms`);
  } catch (error) {
    const errorTime = new Date();
    const duration = errorTime - startTime;
    logger.error(`[sendDbBackup] Error en ejecución: ${error.message} - timestamp=${errorTime.toISOString()} duration=${duration}ms`);
    throw error;
  }
}

// Verificar si se debe ejecutar inmediatamente
const arg = process.argv[2];

if (arg === 'execute-now') {
  logger.info('[sendDbBackup] Ejecutando tarea inmediatamente...');
  (async () => {
    try {
      await executeTask();
      logger.info('[sendDbBackup] Tarea completada, terminando...');
      process.exit(0);
    } catch (error) {
      logger.error(`[sendDbBackup] Error en ejecución inmediata: ${error.message}`);
      process.exit(1);
    }
  })();
} else {
  // Solo levantar el proceso, NO ejecutar nada automáticamente
  (async () => {
    const { getTaskConfigWithRetry, convertTimeToCron: toCron } = require('./shared/cronHelper');
    const taskConfig = await getTaskConfigWithRetry(logger);
    const schedule = taskConfig?.sendDbBackup?.schedule;
    const cronExpression = schedule ? (toCron(schedule) || '0 2 * * *') : '0 2 * * *';
    
    logger.info(`[sendDbBackup] Cron job iniciado - horario programado: ${schedule || '02:00'} (${cronExpression})`);
    emitReady();

    cron.schedule(cronExpression, async () => { 
      logger.info('[sendDbBackup] Iniciando ejecución programada...');
      try {
        await executeTask();
        logger.info('[sendDbBackup] Ejecución programada completada exitosamente');
      } catch (error) {
        logger.error(`[sendDbBackup] Error en ejecución programada: ${error.message}`);
      }
    });
  })();
}
