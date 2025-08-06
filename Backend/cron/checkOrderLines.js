const { fetchOrderLineFilesFromNetwork } = require('../services/checkOrderLines.service');
const cron = require('node-cron');

// Función para emitir señal de ready
const emitReady = () => {
  if (process.send) {
    process.send('ready');
  }
};

fetchOrderLineFilesFromNetwork().then(() => {
  console.log('Procesamiento inicial de líneas de orden completado');
  emitReady();
}).catch((error) => {
  console.error('Error en procesamiento inicial de líneas de orden:', error);
  emitReady();
});

cron.schedule('0 6 * * *', async () => {
  console.log(`[${new Date().toISOString()}] Iniciando procesamiento de archivos de líneas de orden...`);
  await fetchOrderLineFilesFromNetwork();
  console.log(`[${new Date().toISOString()}] Archivos de líneas de orden procesados.`);
}); 