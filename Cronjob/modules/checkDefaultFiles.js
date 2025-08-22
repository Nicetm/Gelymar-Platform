require('dotenv').config();
const axios = require('axios');
const cron = require('node-cron');

// Configuración de la API del backend
const BACKEND_API_URL = process.env.BACKEND_API_URL || 'http://localhost:3000';

console.log('Iniciando servicio de generación de documentos por defecto...');

// Función para emitir señal de ready
const emitReady = () => {
  if (process.send) {
    process.send('ready');
  }
};

// Función para ejecutar con manejo de errores
async function executeWithErrorHandling() {
  try {
    console.log('Llamando al endpoint de generación de archivos por defecto...');
    const response = await axios.post(`${BACKEND_API_URL}/api/cron/generate-default-files`);
    console.log('Generación de archivos por defecto completada:', response.data.message);
  } catch (error) {
    console.error('Error en generación de archivos por defecto:', error.response?.data?.error || error.message);
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

cron.schedule('45 6 * * *', async () => {
  console.log(`[${new Date().toISOString()}] Iniciando generación de archivos por defecto...`);
  try {
    const response = await axios.post(`${BACKEND_API_URL}/api/cron/generate-default-files`);
    console.log(`[${new Date().toISOString()}] Archivos por defecto generados:`, response.data.message);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error en generación de archivos por defecto:`, error.response?.data?.error || error.message);
    console.log('Continuando con el siguiente proceso...');
  }
}); 