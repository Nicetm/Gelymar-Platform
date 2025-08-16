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

// Verificar si se debe ejecutar inmediatamente
const shouldExecuteNow = process.argv.includes('--execute-now');

if (shouldExecuteNow) {
  console.log('🚀 Ejecutando tarea de ETD inmediatamente...');
  executeWithErrorHandling();
} else {
  console.log('⏰ Proceso de ETD iniciado. Esperando programación (7:00 AM)...');
  emitReady();
}

cron.schedule('0 7 * * *', async () => {
  console.log(`[${new Date().toISOString()}] Iniciando verificación de ETD...`);
  try {
    await checkOrdersWithETD();
    console.log(`[${new Date().toISOString()}] Verificación de ETD ejecutada.`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error en verificación de ETD:`, error.message);
    console.log('Continuando con el siguiente proceso...');
  }
});
