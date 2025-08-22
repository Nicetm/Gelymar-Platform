const axios = require('axios');
const cron = require('node-cron');

// Configuración de la API del backend
const BACKEND_API_URL = process.env.BACKEND_API_URL || 'http://localhost:3000';

// Función para emitir señal de ready
const emitReady = () => {
  if (process.send) {
    process.send('ready');
  }
};

// Función para ejecutar con manejo de errores
async function executeWithErrorHandling() {
  try {
    console.log('Llamando al endpoint de verificación de acceso de clientes...');
    const response = await axios.post(`${BACKEND_API_URL}/api/cron/check-client-access`);
    console.log('Verificación de acceso de clientes completada:', response.data.message);
  } catch (error) {
    console.error('Error en verificación de acceso de clientes:', error.response?.data?.error || error.message);
    console.log('Continuando con el siguiente proceso...');
  } finally {
    emitReady();
  }
}

// Verificar si se debe ejecutar inmediatamente
const arg = process.argv[2];
console.log('Argumento recibido:', arg);

if (arg === 'execute-now') {
  console.log('👉 Ejecutando inmediatamente...');
  executeWithErrorHandling();
} else {
  console.log('👉 Modo normal (ejecución programada o sin argumentos)');
  emitReady();
}

cron.schedule('30 7 * * *', async () => {
  console.log(`[${new Date().toISOString()}] Iniciando verificación de acceso de clientes...`);
  try {
    await checkClientAccess();
    console.log(`[${new Date().toISOString()}] Verificación de acceso de clientes completada.`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error en verificación de acceso de clientes:`, error.message);
    console.log('Continuando con el siguiente proceso...');
  }
}); 