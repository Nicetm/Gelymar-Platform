const cron = require('node-cron');
const { checkOrdersWithETD } = require('../services/check.service');

// Ejecuta inmediatamente al levantar
checkOrdersWithETD();

// Ejecuta cada 5 minutos
cron.schedule('*/5 * * * *', async () => {
  await checkOrdersWithETD();
  console.log(`[${new Date().toISOString()}] Ejecutando verificación de ETD...`);
});