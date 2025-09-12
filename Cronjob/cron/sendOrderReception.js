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
    console.log('Llamando al endpoint de envío de documentos de recepción...');
    const response = await axios.post(`${BACKEND_API_URL}/api/cron/send-order-reception`);
    console.log('Envío de documentos de recepción completado');
  } catch (error) {
    console.error('Error en envío de documentos de recepción:', error.message);
    console.log('Continuando con el siguiente proceso...');
  } finally {
    emitReady();
  }
}

// Verificar si se debe ejecutar inmediatamente
const arg = process.argv[2];
console.log('Argumento recibido:', arg);

if (arg === 'execute-now') {
  console.log('👉 Ejecutando envío de documentos de recepción inmediatamente...');
  executeWithErrorHandling();
} else {
  console.log('👉 Modo normal (ejecución programada o sin argumentos)');
  emitReady();
}

// Cron independiente - se ejecuta diariamente a las 8 AM
cron.schedule('0 8 * * *', async () => {
  console.log(`[${new Date().toISOString()}] Iniciando envío de documentos de recepción...`);
  try {
    console.log('Llamando al endpoint de envío de documentos de recepción...');
    const response = await axios.post(`${BACKEND_API_URL}/api/cron/send-order-reception`);
    console.log(`[${new Date().toISOString()}] Envío de documentos de recepción completado.`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error en envío de documentos de recepción:`, error.message);
  }
});
