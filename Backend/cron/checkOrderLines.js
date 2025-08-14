const { fetchOrderLineFilesFromNetwork } = require('../services/checkOrderLines.service');
const cron = require('node-cron');

// Función para emitir señal de ready
const emitReady = () => {
  if (process.send) {
    process.send('ready');
  }
};

// Función para ejecutar con manejo de errores
async function executeWithErrorHandling() {
  try {
    await fetchOrderLineFilesFromNetwork();
    console.log('Procesamiento inicial de líneas de orden completado');
  } catch (error) {
    console.error('Error en procesamiento inicial de líneas de orden:', error.message);
    console.log('Continuando con el siguiente proceso...');
  } finally {
    emitReady();
  }
}

// Ejecutar inicialmente
executeWithErrorHandling();

cron.schedule('0 6 * * *', async () => {
  console.log(`[${new Date().toISOString()}] Iniciando procesamiento de archivos de líneas de orden...`);
  try {
    await fetchOrderLineFilesFromNetwork();
    console.log(`[${new Date().toISOString()}] Archivos de líneas de orden procesados.`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error en procesamiento de líneas de orden:`, error.message);
    console.log('Continuando con el siguiente proceso...');
  }
}); 