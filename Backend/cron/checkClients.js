const { fetchClientFilesFromNetwork } = require('../services/checkClients.service');
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
    await fetchClientFilesFromNetwork();
    console.log('Procesamiento inicial de clientes completado');
  } catch (error) {
    console.error('Error en procesamiento inicial de clientes:', error.message);
    console.log('Continuando con el siguiente proceso...');
  } finally {
    emitReady();
  }
}

// Ejecutar inicialmente
executeWithErrorHandling();

cron.schedule('0 6 * * *', async () => {
  console.log(`[${new Date().toISOString()}] Iniciando procesamiento de archivos de clientes...`);
  try {
    await fetchClientFilesFromNetwork();
    console.log(`[${new Date().toISOString()}] Archivos de clientes procesados.`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error en procesamiento de clientes:`, error.message);
    console.log('Continuando con el siguiente proceso...');
  }
});
