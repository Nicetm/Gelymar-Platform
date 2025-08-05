const { fetchItemFilesFromNetwork } = require('../services/checkItems.service');
const cron = require('node-cron');

fetchItemFilesFromNetwork().then(() => {
  console.log('Procesamiento inicial completado');
}).catch((error) => {
  console.error('Error en procesamiento inicial:', error);
});

cron.schedule('0 6 * * *', async () => {
  await fetchItemFilesFromNetwork();
  console.log(`[${new Date().toISOString()}] Archivos de items procesados.`);
}); 