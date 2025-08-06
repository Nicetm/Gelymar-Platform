const { fetchClientFilesFromNetwork } = require('../services/checkClients.service');
const cron = require('node-cron');

// Función para emitir señal de ready
const emitReady = () => {
  if (process.send) {
    process.send('ready');
  }
};

fetchClientFilesFromNetwork().then(() => {
  console.log('Procesamiento inicial de clientes completado');
  emitReady();
}).catch((error) => {
  console.error('Error en procesamiento inicial de clientes:', error);
  emitReady();
});

cron.schedule('0 6 * * *', async () => {
  console.log(`[${new Date().toISOString()}] Iniciando procesamiento de archivos de clientes...`);
  await fetchClientFilesFromNetwork();
  console.log(`[${new Date().toISOString()}] Archivos de clientes procesados.`);
});
