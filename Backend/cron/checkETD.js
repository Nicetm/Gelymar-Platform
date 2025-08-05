const { checkOrdersWithETD } = require('../services/checkETD.service');
const cron = require('node-cron');

checkOrdersWithETD().then(() => {
  console.log('Procesamiento inicial completado');
}).catch((error) => {
  console.error('Error en procesamiento inicial:', error);
});

cron.schedule('*/5 * * * *', async () => {
  await checkOrdersWithETD();
  console.log(`[${new Date().toISOString()}] Verificación de ETD ejecutada.`);
});
