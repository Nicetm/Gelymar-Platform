const axios = require('axios');
const cron = require('node-cron');
const dotenv = require('dotenv');
const os = require('os');
const fs = require('fs');
// mysql ya no se necesita, se usa endpoint del backend
// El cron no necesita montar la VPN directamente, solo llama a endpoints del backend

// Detectar entorno y cargar variables automáticamente
const networkInterfaces = os.networkInterfaces();
const isServer = Object.values(networkInterfaces)
  .flat()
  .some(iface => iface && iface.address === '172.20.10.151');

console.log(`🔧 [Cronjob] Detección de entorno:`);
console.log(`🔧 [Cronjob] - isServer: ${isServer}`);
console.log(`🔧 [Cronjob] - networkInterfaces:`, Object.keys(networkInterfaces));

// Cargar archivo de configuración según entorno
const envFile = isServer ? '../env.server' : '../env.local';
console.log(`🔧 [Cronjob] Intentando cargar archivo: ${envFile}`);
console.log(`🔧 [Cronjob] Archivo existe: ${fs.existsSync(envFile)}`);

if (fs.existsSync(envFile)) {
  dotenv.config({ path: envFile });
  console.log(`🔧 [Cronjob] Entorno detectado: ${isServer ? 'Servidor Ubuntu (172.20.10.151)' : 'Desarrollo local'}`);
  console.log(`🔧 [Cronjob] Archivo de configuración cargado: ${envFile}`);
} else {
  console.log(`⚠️ [Cronjob] Archivo de configuración no encontrado: ${envFile}`);
  console.log(`⚠️ [Cronjob] Directorio actual: ${process.cwd()}`);
  console.log(`⚠️ [Cronjob] Archivos en directorio:`, fs.readdirSync('.'));
  dotenv.config(); // Fallback a .env si existe
}

// Configuración de la API del backend
let BACKEND_API_URL = process.env.BACKEND_API_URL || 'http://localhost:3000';

// Si estamos en Docker y no se cargó la configuración, forzar la URL correcta
if (isServer && BACKEND_API_URL === 'http://localhost:3000') {
  console.log(`⚠️ [Cronjob] Forzando configuración para Docker...`);
  BACKEND_API_URL = 'http://backend:3000';
}

// Verificación adicional: si detectamos que estamos en un contenedor Docker
if (process.env.DOCKER_ENV === 'true' || fs.existsSync('/.dockerenv')) {
  console.log(`🐳 [Cronjob] Detectado entorno Docker, usando backend:3000`);
  BACKEND_API_URL = 'http://backend:3000';
}

console.log(`🔧 [Cronjob] BACKEND_API_URL configurado: ${BACKEND_API_URL}`);
console.log(`🔧 [Cronjob] Variables de entorno disponibles:`, Object.keys(process.env).filter(key => key.includes('BACKEND')));

// DB_CONFIG ya no se necesita, se usa endpoint del backend

// Función para obtener configuración de tareas desde el backend
async function getTaskConfig() {
  try {
    const response = await axios.get(`${BACKEND_API_URL}/api/cron/tasks-config`, {
      timeout: 10000,
      family: 4
    });
    
    if (response.data.success) {
      console.log(`🔧 [Cronjob] Configuración de tareas cargada desde backend:`, response.data.config);
      return response.data.config;
    } else {
      throw new Error('Respuesta del backend no exitosa');
    }
  } catch (error) {
    console.error(`⚠️ [Cronjob] Error cargando configuración desde backend:`, error.message);
    console.log(`⚠️ [Cronjob] Usando configuración por defecto...`);
    return {
      clean_database: true,
      check_clients: true,
      check_client_access: true,
      check_items: true,
      check_orders: true,
      check_order_lines: true,
      check_default_files: true
    };
  }
}

// Variables globales para configuración de tareas (se cargarán desde BD)
let taskConfig = {};

async function cleanDatabase() {
  console.log(`[${new Date().toISOString()}] -> Cron Master Process -> Iniciando limpieza de base de datos...`);
  
  try {
    const url = `${BACKEND_API_URL}/api/cron/clean-database`;
    console.log(`[${new Date().toISOString()}] -> Cron Master Process -> Llamando al endpoint: ${url}`);
    console.log(`[${new Date().toISOString()}] -> Cron Master Process -> BACKEND_API_URL actual: ${BACKEND_API_URL}`);
    
    const response = await axios.post(url, {}, {
      timeout: 300000, // 5 minutos
      family: 4, // Forzar IPv4
      headers: {
        'Content-Type': 'application/json'
      }
    });
    console.log(`[${new Date().toISOString()}] -> Cron Master Process -> Limpieza de BD completada exitosamente`);
    
  } catch (error) {
    console.error(`[${new Date().toISOString()}] -> Cron Master Process -> Error durante la limpieza:`, error.message);
    console.error(`[${new Date().toISOString()}] -> Cron Master Process -> URL usada: ${BACKEND_API_URL}/api/cron/clean-database`);
    throw error;
  }
}

async function checkClients() {
  console.log(`[${new Date().toISOString()}] -> Cron Master Process -> Iniciando procesamiento de clientes...`);
  try {
    const url = `${BACKEND_API_URL}/api/cron/check-clients`;
    console.log(`[${new Date().toISOString()}] -> Cron Master Process -> Llamando al endpoint: ${url}`);
    const response = await axios.post(url, {}, {
      timeout: 300000, // 5 minutos
      family: 4, // Forzar IPv4
      headers: {
        'Content-Type': 'application/json'
      }
    });
    console.log(`[${new Date().toISOString()}] -> Cron Master Process -> Procesamiento de clientes completado exitosamente`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] -> Cron Master Process -> Error en checkClients:`, error.message);
    throw error;
  }
}

async function checkClientAccess() {
  console.log(`[${new Date().toISOString()}] -> Cron Master Process -> Iniciando verificación de acceso de clientes...`);
  try {
    const url = `${BACKEND_API_URL}/api/cron/check-client-access`;
    console.log(`[${new Date().toISOString()}] -> Cron Master Process -> Llamando al endpoint: ${url}`);
    const response = await axios.post(url, {}, {
      timeout: 300000, // 5 minutos
      family: 4, // Forzar IPv4
      headers: {
        'Content-Type': 'application/json'
      }
    });
    console.log(`[${new Date().toISOString()}] -> Cron Master Process -> Verificación de acceso de clientes completada exitosamente`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] -> Cron Master Process -> Error en checkClientAccess:`, error.message);
    throw error;
  }
}

async function checkItems() {
  console.log(`[${new Date().toISOString()}] -> Cron Master Process -> Iniciando procesamiento de items...`);
  try {
    const url = `${BACKEND_API_URL}/api/cron/check-items`;
    console.log(`[${new Date().toISOString()}] -> Cron Master Process -> Llamando al endpoint: ${url}`);
    const response = await axios.post(url, {}, {
      timeout: 300000, // 5 minutos
      family: 4, // Forzar IPv4
      headers: {
        'Content-Type': 'application/json'
      }
    });
    console.log(`[${new Date().toISOString()}] -> Cron Master Process -> Procesamiento de items completado exitosamente`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] -> Cron Master Process -> Error en checkItems:`, error.message);
    throw error;
  }
}

async function checkOrders() {
  console.log(`[${new Date().toISOString()}] -> Cron Master Process -> Iniciando procesamiento de órdenes...`);
  try {
    const url = `${BACKEND_API_URL}/api/cron/check-orders`;
    console.log(`[${new Date().toISOString()}] -> Cron Master Process -> Llamando al endpoint: ${url}`);
    const response = await axios.post(url, {}, {
      timeout: 300000, // 5 minutos
      family: 4, // Forzar IPv4
      headers: {
        'Content-Type': 'application/json'
      }
    });
    console.log(`[${new Date().toISOString()}] -> Cron Master Process -> Procesamiento de órdenes completado exitosamente`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] -> Cron Master Process -> Error en checkOrders:`, error.message);
    throw error;
  }
}

async function checkOrderLines() {
  console.log(`[${new Date().toISOString()}] -> Cron Master Process -> Iniciando procesamiento de líneas de orden...`);
  try {
    const url = `${BACKEND_API_URL}/api/cron/check-order-lines`;
    console.log(`[${new Date().toISOString()}] -> Cron Master Process -> Llamando al endpoint: ${url}`);
    const response = await axios.post(url, {}, {
      timeout: 300000, // 5 minutos
      family: 4, // Forzar IPv4
      headers: {
        'Content-Type': 'application/json'
      }
    });
    console.log(`[${new Date().toISOString()}] -> Cron Master Process -> Procesamiento de líneas de orden completado exitosamente`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] -> Cron Master Process -> Error en checkOrderLines:`, error.message);
    throw error;
  }
}

async function checkDefaultFiles() {
  console.log(`[${new Date().toISOString()}] -> Cron Master Process -> Iniciando verificación de archivos por defecto...`);
  try {
    const url = `${BACKEND_API_URL}/api/cron/generate-default-files`;
    console.log(`[${new Date().toISOString()}] -> Cron Master Process -> Llamando al endpoint: ${url}`);
    const response = await axios.post(url, {}, {
      timeout: 300000, // 5 minutos
      family: 4, // Forzar IPv4
      headers: {
        'Content-Type': 'application/json'
      }
    });
    console.log(`[${new Date().toISOString()}] -> Cron Master Process -> Verificación de archivos por defecto completada exitosamente`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] -> Cron Master Process -> Error en checkDefaultFiles:`, error.message);
    throw error;
  }
}

async function executeSequence() {
  const startTime = new Date();
  console.log(`[${startTime.toISOString()}] -> Cron Master Process -> Iniciando secuencia de tareas...`);
  
  // Cargar configuración de tareas desde la base de datos
  taskConfig = await getTaskConfig();
  
  // El cron no monta la VPN, solo llama a endpoints del backend que ya tienen VPN
  console.log(`[${startTime.toISOString()}] -> Cron Master Process -> Iniciando tareas (VPN manejada por backend)...`);
  
  const tasks = [
    { name: 'Limpieza de BD', enabled: taskConfig.clean_database, func: cleanDatabase },
    { name: 'Check Clients', enabled: taskConfig.check_clients, func: checkClients },
    { name: 'Check Client Access', enabled: taskConfig.check_client_access, func: checkClientAccess },
    { name: 'Check Items', enabled: taskConfig.check_items, func: checkItems },
    { name: 'Check Orders', enabled: taskConfig.check_orders, func: checkOrders },
    { name: 'Check Order Lines', enabled: taskConfig.check_order_lines, func: checkOrderLines },
    { name: 'Check Default Files', enabled: taskConfig.check_default_files, func: checkDefaultFiles }
  ];

  for (const task of tasks) {
    if (!task.enabled) {
      console.log(`[${new Date().toISOString()}] -> Cron Master Process -> ⏭️ ${task.name} deshabilitado - saltando...`);
      continue;
    }
    
    const taskStartTime = new Date();
    console.log(`[${taskStartTime.toISOString()}] -> Cron Master Process -> ✅ TAREA ${task.name} HABILITADA - EJECUTANDO...`);
    
    try {
      await task.func();
      const taskEndTime = new Date();
      const taskDuration = taskEndTime - taskStartTime;
      console.log(`[${taskEndTime.toISOString()}] -> Cron Master Process -> ✅ ${task.name} completado exitosamente`);
      
      // Esperar entre procesos
      console.log(`[${new Date().toISOString()}] -> Cron Master Process -> ⏸️ Esperando 2 segundos...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      const taskErrorTime = new Date();
      const taskDuration = taskErrorTime - taskStartTime;
      console.error(`[${taskErrorTime.toISOString()}] -> Cron Master Process -> ❌ Error en ${task.name}:`, error.message);
      console.log(`[${taskErrorTime.toISOString()}] -> Cron Master Process -> ⏭️ Continuando con el siguiente proceso...`);
    }
  }
  
  const endTime = new Date();
  const totalDuration = endTime - startTime;
  console.log(`[${endTime.toISOString()}] -> Cron Master Process -> 🎉 Secuencia completada!`);
  
  // El cron no maneja la VPN, solo llama a endpoints del backend
  console.log(`[${endTime.toISOString()}] -> Cron Master Process -> Secuencia completada (VPN manejada por backend)`);
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
  console.log('👉 Ejecutando secuencia inmediatamente...');
  (async () => {
    await executeSequence();
    console.log('✅ Secuencia completada, terminando...');
    process.exit(0);
  })();
} else {
  // Solo levantar el proceso, NO ejecutar nada automáticamente
  console.log('👉 Cron Master iniciado - esperando horario programado (7:00 AM)...');
  emitReady();

  // Programar ejecución diaria a las 7:00 AM
  cron.schedule('0 7 * * *', async () => {
    console.log(`[${new Date().toISOString()}] -> Cron Master Process -> 🚀 Iniciando secuencia programada...`);
    try {
      await executeSequence();
      console.log(`[${new Date().toISOString()}] -> Cron Master Process -> 🎉 Secuencia programada completada exitosamente`);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] -> Cron Master Process -> ❌ Error en secuencia programada:`, error.message);
    }
  });
} 