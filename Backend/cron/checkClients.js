const { fetchClientFilesFromNetwork } = require('../services/checkClients.service');
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
    await fetchClientFilesFromNetwork();
    console.log('Procesamiento inicial de clientes completado');
  } catch (error) {
    console.error('Error en procesamiento inicial de clientes:', error.message);
    console.log('Continuando con el siguiente proceso...');
  } finally {
    emitReady();
  }
}

// Verificar si se debe ejecutar inmediatamente
const shouldExecuteNow = process.argv.includes('--execute-now');

if (shouldExecuteNow) {
  console.log('🚀 Ejecutando tarea de clientes inmediatamente...');
  executeWithErrorHandling();
} else {
  console.log('⏰ Proceso de clientes iniciado. Esperando programación (5:00 AM)...');
  emitReady();
}

cron.schedule('0 5 * * *', async () => {
  console.log(`[${new Date().toISOString()}] Iniciando procesamiento de archivos de clientes...`);
  try {
    await fetchClientFilesFromNetwork();
    console.log(`[${new Date().toISOString()}] Archivos de clientes procesados.`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error en procesamiento de clientes:`, error.message);
    console.log('Continuando con el siguiente proceso...');
  }
});
