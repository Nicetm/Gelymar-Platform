const { checkOrdersWithETD } = require('../services/checkETD.service');
const cron = require('node-cron');

// Función para emitir señal de ready
const emitReady = () => {
  if (process.send) {
    process.send('ready');
  }
};

// Función para ejecutar con manejo de errores
async function executeWithErrorHandling() {
  try {
    await checkOrdersWithETD();
    console.log('Procesamiento inicial de ETD completado');
  } catch (error) {
    console.error('Error en procesamiento inicial de ETD:', error.message);
    console.log('Continuando con el siguiente proceso...');
  } finally {
    emitReady();
  }
}

// Ejecutar inicialmente
executeWithErrorHandling();

cron.schedule('*/5 * * * *', async () => {
  console.log(`[${new Date().toISOString()}] Iniciando verificación de ETD...`);
  try {
    await checkOrdersWithETD();
    console.log(`[${new Date().toISOString()}] Verificación de ETD ejecutada.`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error en verificación de ETD:`, error.message);
    console.log('Continuando con el siguiente proceso...');
  }
});
