const { checkOrdersWithETD } = require('../services/checkETD.service');
const cron = require('node-cron');

checkOrdersWithETD();

cron.schedule('*/5 * * * *', async () => {
  await checkOrdersWithETD();
  console.log(`[${new Date().toISOString()}] ✅ Verificación de ETD ejecutada.`);
});
