const { fetchOrderFilesFromNetwork } = require('../services/checkOrders.service');
const cron = require('node-cron');

// Función para emitir señal de ready
const emitReady = () => {
  if (process.send) {
    process.send('ready');
  }
};

fetchOrderFilesFromNetwork().then(() => {
  console.log('Procesamiento inicial de órdenes completado');
  emitReady();
}).catch((error) => {
  console.error('Error en procesamiento inicial de órdenes:', error);
  emitReady();
});

cron.schedule('0 6 * * *', async () => {
  console.log(`[${new Date().toISOString()}] Iniciando procesamiento de archivos de órdenes...`);
  await fetchOrderFilesFromNetwork();
  console.log(`[${new Date().toISOString()}] Archivos de órdenes procesados.`);
}); 