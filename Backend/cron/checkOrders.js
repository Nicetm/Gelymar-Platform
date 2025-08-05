const { fetchOrderFilesFromNetwork } = require('../services/checkOrders.service');
const cron = require('node-cron');

fetchOrderFilesFromNetwork().then(() => {
  console.log('Procesamiento inicial completado');
}).catch((error) => {
  console.error('Error en procesamiento inicial:', error);
});

cron.schedule('0 6 * * *', async () => {
  await fetchOrderFilesFromNetwork();
  console.log(`[${new Date().toISOString()}] Archivos de órdenes procesados.`);
}); 