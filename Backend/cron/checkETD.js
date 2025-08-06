const { checkOrdersWithETD } = require('../services/checkETD.service');
const cron = require('node-cron');

// Función para emitir señal de ready
const emitReady = () => {
  if (process.send) {
    process.send('ready');
  }
};

checkOrdersWithETD().then(() => {
  console.log('Procesamiento inicial de ETD completado');
  emitReady();
}).catch((error) => {
  console.error('Error en procesamiento inicial de ETD:', error);
  emitReady();
});

cron.schedule('*/5 * * * *', async () => {
  console.log(`[${new Date().toISOString()}] Iniciando verificación de ETD...`);
  await checkOrdersWithETD();
  console.log(`[${new Date().toISOString()}] Verificación de ETD ejecutada.`);
});
