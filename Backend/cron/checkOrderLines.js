const { fetchOrderLineFilesFromNetwork } = require('../services/checkOrderLines.service');
const cron = require('node-cron');

// Función para emitir señal de ready
const emitReady = () => {
  if (process.send) {
    process.send('ready');
  }
};

// Función para ejecutar con manejo de errores
async function executeWithErrorHandling(updateMode = false) {
  try {
    await fetchOrderLineFilesFromNetwork(updateMode);
    if (updateMode === 'factura') {
      console.log('Actualización de facturas en líneas de orden completada');
    } else {
      console.log('Procesamiento inicial de líneas de orden completado');
    }
  } catch (error) {
    console.error('Error en procesamiento inicial de líneas de orden:', error.message);
    console.log('Continuando con el siguiente proceso...');
  } finally {
    emitReady();
  }
}

// Verificar parámetros de ejecución desde variables de entorno
const shouldExecuteNow = process.env.EXECUTE_NOW === 'true' || true; // Forzar ejecución
const shouldUpdateFactura = process.env.UPDATE_MODE === 'factura' || true; // Forzar actualización de facturas

if (shouldExecuteNow) {
  if (shouldUpdateFactura) {
    console.log('🚀 Ejecutando tarea de líneas de orden con actualización de facturas...');
    executeWithErrorHandling('factura'); // modo actualización de facturas
  } else {
    console.log('🚀 Ejecutando tarea de líneas de orden inmediatamente...');
    executeWithErrorHandling(false); // modo normal
  }
} else {
  console.log('⏰ Proceso de líneas de orden iniciado. Esperando programación (6:30 AM)...');
  emitReady();
}

cron.schedule('30 6 * * *', async () => {
  console.log(`[${new Date().toISOString()}] Iniciando procesamiento de archivos de líneas de orden...`);
  try {
    await fetchOrderLineFilesFromNetwork();
    console.log(`[${new Date().toISOString()}] Archivos de líneas de orden procesados.`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error en procesamiento de líneas de orden:`, error.message);
    console.log('Continuando con el siguiente proceso...');
  }
}); 