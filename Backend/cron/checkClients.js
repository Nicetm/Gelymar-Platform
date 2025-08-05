const { fetchClientFilesFromNetwork } = require('../services/checkClients.service');
const cron = require('node-cron');

fetchClientFilesFromNetwork().then(() => {
  console.log('Procesamiento inicial completado');
}).catch((error) => {
  console.error('Error en procesamiento inicial:', error);
});

cron.schedule('0 6 * * *', async () => {
  await fetchClientFilesFromNetwork();
  console.log(`[${new Date().toISOString()}] Archivos de clientes procesados.`);
});
