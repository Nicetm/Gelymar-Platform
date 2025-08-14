const { fetchItemFilesFromNetwork } = require('../services/checkItems.service');
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
    await fetchItemFilesFromNetwork();
    console.log('Procesamiento inicial de items completado');
  } catch (error) {
    console.error('Error en procesamiento inicial de items:', error.message);
    console.log('Continuando con el siguiente proceso...');
  } finally {
    emitReady();
  }
}

// Ejecutar inicialmente
executeWithErrorHandling();

cron.schedule('0 6 * * *', async () => {
  console.log(`[${new Date().toISOString()}] Iniciando procesamiento de archivos de items...`);
  try {
    await fetchItemFilesFromNetwork();
    console.log(`[${new Date().toISOString()}] Archivos de items procesados.`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error en procesamiento de items:`, error.message);
    console.log('Continuando con el siguiente proceso...');
  }
}); 