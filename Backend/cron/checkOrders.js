const { fetchOrderFilesFromNetwork } = require('../services/checkOrders.service');
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
    await fetchOrderFilesFromNetwork();
    console.log('Procesamiento inicial de órdenes completado');
  } catch (error) {
    console.error('Error en procesamiento inicial de órdenes:', error.message);
    console.log('Continuando con el siguiente proceso...');
  } finally {
    emitReady();
  }
}

// Verificar si se debe ejecutar inmediatamente
const shouldExecuteNow = process.argv.includes('--execute-now');

if (shouldExecuteNow) {
  console.log('🚀 Ejecutando tarea de órdenes inmediatamente...');
  executeWithErrorHandling();
} else {
  console.log('⏰ Proceso de órdenes iniciado. Esperando programación (6:00 AM)...');
  emitReady();
}

cron.schedule('0 6 * * *', async () => {
  console.log(`[${new Date().toISOString()}] Iniciando procesamiento de archivos de órdenes...`);
  try {
    await fetchOrderFilesFromNetwork();
    console.log(`[${new Date().toISOString()}] Archivos de órdenes procesados.`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error en procesamiento de órdenes:`, error.message);
    console.log('Continuando con el siguiente proceso...');
  }
}); 