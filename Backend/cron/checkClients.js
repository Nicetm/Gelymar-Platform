const { fetchClientFilesFromNetwork } = require('../services/checkClients.service');
const cron = require('node-cron');

fetchClientFilesFromNetwork();

cron.schedule('0 6 * * *', async () => {
  await fetchClientFilesFromNetwork();
  console.log(`[${new Date().toISOString()}] 📂 Archivos de clientes procesados.`);
});
