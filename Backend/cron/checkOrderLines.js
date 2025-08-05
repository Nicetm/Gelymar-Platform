const { fetchOrderLineFilesFromNetwork } = require('../services/checkOrderLines.service');
const cron = require('node-cron');

fetchOrderLineFilesFromNetwork().then(() => {
  console.log('Procesamiento inicial completado');
}).catch((error) => {
  console.error('Error en procesamiento inicial:', error);
});

cron.schedule('0 6 * * *', async () => {
  await fetchOrderLineFilesFromNetwork();
  console.log(`[${new Date().toISOString()}] Archivos de líneas de orden procesados.`);
}); 