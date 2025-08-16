const { checkClientAccess } = require('../services/checkClientAccess.service');
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
    await checkClientAccess();
    console.log('Procesamiento inicial de acceso de clientes completado');
  } catch (error) {
    console.error('Error en procesamiento inicial de acceso de clientes:', error.message);
    console.log('Continuando con el siguiente proceso...');
  } finally {
    emitReady();
  }
}

// Verificar si se debe ejecutar inmediatamente
const shouldExecuteNow = process.argv.includes('--execute-now');

if (shouldExecuteNow) {
  console.log('🚀 Ejecutando tarea de acceso de clientes inmediatamente...');
  executeWithErrorHandling();
} else {
  console.log('⏰ Proceso de acceso de clientes iniciado. Esperando programación (7:30 AM)...');
  emitReady();
}

// Programar ejecución diaria a las 7:30 AM
cron.schedule('30 7 * * *', async () => {
  console.log(`[${new Date().toISOString()}] Iniciando verificación de acceso de clientes...`);
  try {
    await checkClientAccess();
    console.log(`[${new Date().toISOString()}] Verificación de acceso de clientes completada.`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error en verificación de acceso de clientes:`, error.message);
    console.log('Continuando con el siguiente proceso...');
  }
}); 