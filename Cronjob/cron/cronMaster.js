const axios = require('axios');
const cron = require('node-cron');
const dotenv = require('dotenv');
const os = require('os');
const fs = require('fs');
// El cron no necesita montar la VPN directamente, solo llama a endpoints del backend

// Detectar entorno y cargar variables automáticamente
const networkInterfaces = os.networkInterfaces();
const isServer = Object.values(networkInterfaces)
  .flat()
  .some(iface => iface && iface.address === '172.20.10.151');

// Cargar archivo de configuración según entorno
const envFile = isServer ? './env.server' : './env.local';
if (fs.existsSync(envFile)) {
  dotenv.config({ path: envFile });
  console.log(`🔧 [Cronjob] Entorno detectado: ${isServer ? 'Servidor Ubuntu (172.20.10.151)' : 'Desarrollo local'}`);
} else {
  dotenv.config(); // Fallback a .env si existe
}

// Configuración de la API del backend
const BACKEND_API_URL = process.env.BACKEND_API_URL || 'http://localhost:3000';

// SWITCHES INDIVIDUALES PARA CADA TAREA
const TASK_1_CLEAN_DB = true;       // Limpieza de BD
const TASK_2_CLIENTS = true;        // checkClients
const TASK_3_CLIENT_ACCESS = false;  // checkClientAccess  
const TASK_4_ITEMS = true;          // checkItems
const TASK_5_ORDERS = true;         // checkOrders
const TASK_6_ORDER_LINES = true;    // checkOrderLines
const TASK_7_DEFAULT_FILES = false;  // checkDefaultFiles

async function cleanDatabase() {
  console.log(`[${new Date().toISOString()}] -> Cron Master Process -> Iniciando limpieza de base de datos...`);
  
  try {
    console.log(`[${new Date().toISOString()}] -> Cron Master Process -> Llamando al endpoint de limpieza...`);
    const response = await axios.post(`${BACKEND_API_URL}/api/cron/clean-database`);
    console.log(`[${new Date().toISOString()}] -> Cron Master Process -> Limpieza de BD completada exitosamente`);
    
  } catch (error) {
    console.error(`[${new Date().toISOString()}] -> Cron Master Process -> Error durante la limpieza:`, error.message);
    throw error;
  }
}

async function checkClients() {
  console.log(`[${new Date().toISOString()}] -> Cron Master Process -> Iniciando procesamiento de clientes...`);
  try {
    console.log(`[${new Date().toISOString()}] -> Cron Master Process -> Llamando al endpoint de clientes...`);
    const response = await axios.post(`${BACKEND_API_URL}/api/cron/check-clients`);
    console.log(`[${new Date().toISOString()}] -> Cron Master Process -> Procesamiento de clientes completado exitosamente`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] -> Cron Master Process -> Error en checkClients:`, error.message);
    throw error;
  }
}

async function checkClientAccess() {
  console.log(`[${new Date().toISOString()}] -> Cron Master Process -> Iniciando verificación de acceso de clientes...`);
  try {
    console.log(`[${new Date().toISOString()}] -> Cron Master Process -> Llamando al endpoint de acceso de clientes...`);
    const response = await axios.post(`${BACKEND_API_URL}/api/cron/check-client-access`);
    console.log(`[${new Date().toISOString()}] -> Cron Master Process -> Verificación de acceso de clientes completada exitosamente`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] -> Cron Master Process -> Error en checkClientAccess:`, error.message);
    throw error;
  }
}

async function checkItems() {
  console.log(`[${new Date().toISOString()}] -> Cron Master Process -> Iniciando procesamiento de items...`);
  try {
    console.log(`[${new Date().toISOString()}] -> Cron Master Process -> Llamando al endpoint de items...`);
    const response = await axios.post(`${BACKEND_API_URL}/api/cron/check-items`);
    console.log(`[${new Date().toISOString()}] -> Cron Master Process -> Procesamiento de items completado exitosamente`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] -> Cron Master Process -> Error en checkItems:`, error.message);
    throw error;
  }
}

async function checkOrders() {
  console.log(`[${new Date().toISOString()}] -> Cron Master Process -> Iniciando procesamiento de órdenes...`);
  try {
    console.log(`[${new Date().toISOString()}] -> Cron Master Process -> Llamando al endpoint de órdenes...`);
    const response = await axios.post(`${BACKEND_API_URL}/api/cron/check-orders`);
    console.log(`[${new Date().toISOString()}] -> Cron Master Process -> Procesamiento de órdenes completado exitosamente`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] -> Cron Master Process -> Error en checkOrders:`, error.message);
    throw error;
  }
}

async function checkOrderLines() {
  console.log(`[${new Date().toISOString()}] -> Cron Master Process -> Iniciando procesamiento de líneas de orden...`);
  try {
    console.log(`[${new Date().toISOString()}] -> Cron Master Process -> Llamando al endpoint de líneas de orden...`);
    const response = await axios.post(`${BACKEND_API_URL}/api/cron/check-order-lines`);
    console.log(`[${new Date().toISOString()}] -> Cron Master Process -> Procesamiento de líneas de orden completado exitosamente`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] -> Cron Master Process -> Error en checkOrderLines:`, error.message);
    throw error;
  }
}

async function checkDefaultFiles() {
  console.log(`[${new Date().toISOString()}] -> Cron Master Process -> Iniciando verificación de archivos por defecto...`);
  try {
    console.log(`[${new Date().toISOString()}] -> Cron Master Process -> Llamando al endpoint de archivos por defecto...`);
    const response = await axios.post(`${BACKEND_API_URL}/api/cron/generate-default-files`);
    console.log(`[${new Date().toISOString()}] -> Cron Master Process -> Verificación de archivos por defecto completada exitosamente`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] -> Cron Master Process -> Error en checkDefaultFiles:`, error.message);
    throw error;
  }
}

async function executeSequence() {
  const startTime = new Date();
  console.log(`[${startTime.toISOString()}] -> Cron Master Process -> Iniciando secuencia de tareas...`);
  
  // El cron no monta la VPN, solo llama a endpoints del backend que ya tienen VPN
  console.log(`[${startTime.toISOString()}] -> Cron Master Process -> Iniciando tareas (VPN manejada por backend)...`);
  
  const tasks = [
    { name: 'Limpieza de BD', enabled: TASK_1_CLEAN_DB, func: cleanDatabase },
    { name: 'Check Clients', enabled: TASK_2_CLIENTS, func: checkClients },
    { name: 'Check Client Access', enabled: TASK_3_CLIENT_ACCESS, func: checkClientAccess },
    { name: 'Check Items', enabled: TASK_4_ITEMS, func: checkItems },
    { name: 'Check Orders', enabled: TASK_5_ORDERS, func: checkOrders },
    { name: 'Check Order Lines', enabled: TASK_6_ORDER_LINES, func: checkOrderLines },
    { name: 'Check Default Files', enabled: TASK_7_DEFAULT_FILES, func: checkDefaultFiles }
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