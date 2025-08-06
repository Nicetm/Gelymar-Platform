const { fetchItemFilesFromNetwork } = require('../services/checkItems.service');
const cron = require('node-cron');

// Función para emitir señal de ready
const emitReady = () => {
  if (process.send) {
    process.send('ready');
  }
};

fetchItemFilesFromNetwork().then(() => {
  console.log('Procesamiento inicial de items completado');
  emitReady();
}).catch((error) => {
  console.error('Error en procesamiento inicial de items:', error);
  emitReady();
});

cron.schedule('0 6 * * *', async () => {
  console.log(`[${new Date().toISOString()}] Iniciando procesamiento de archivos de items...`);
  await fetchItemFilesFromNetwork();
  console.log(`[${new Date().toISOString()}] Archivos de items procesados.`);
}); 