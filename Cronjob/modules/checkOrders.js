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
    console.log('Llamando al endpoint de procesamiento de órdenes...');
    const response = await axios.post(`${BACKEND_API_URL}/api/cron/check-orders`);
    console.log('Procesamiento inicial de órdenes completado:', response.data.message);
  } catch (error) {
    console.error('Error en procesamiento inicial de órdenes:', error.response?.data?.error || error.message);
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

cron.schedule('0 6 * * *', async () => {
  console.log(`[${new Date().toISOString()}] Iniciando procesamiento de archivos de órdenes...`);
  try {
    await executeWithErrorHandling();
    console.log(`[${new Date().toISOString()}] Archivos de órdenes procesados.`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error en procesamiento de órdenes:`, error.message);
    console.log('Continuando con el siguiente proceso...');
  }
}); 