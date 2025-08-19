const { fetchOrderFilesFromNetwork } = require('../services/checkOrders.service');
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
    await fetchOrderFilesFromNetwork(updateMode);
    if (updateMode === 'factura') {
      console.log('Actualización de facturas completada');
    } else if (updateMode === 'fecha_factura') {
      console.log('Actualización de fechas de factura completada');
    } else {
      console.log('Procesamiento inicial de órdenes completado');
    }
  } catch (error) {
    console.error('Error en procesamiento inicial de órdenes:', error.message);
    console.log('Continuando con el siguiente proceso...');
  } finally {
    emitReady();
  }
}

// Verificar parámetros de ejecución desde variables de entorno
const shouldExecuteNow = process.env.EXECUTE_NOW === 'true';
const shouldUpdateFactura = process.env.UPDATE_MODE === 'factura';
const shouldUpdateFechaFactura = process.env.UPDATE_MODE === 'fecha_factura';

if (shouldExecuteNow) {
  if (shouldUpdateFactura) {
    console.log('🚀 Ejecutando tarea de órdenes con actualización de facturas...');
    executeWithErrorHandling('factura'); // modo actualización de facturas
  } else if (shouldUpdateFechaFactura) {
    console.log('🚀 Ejecutando tarea de órdenes con actualización de fechas de factura...');
    executeWithErrorHandling('fecha_factura'); // modo actualización de fechas
  } else {
    console.log('🚀 Ejecutando tarea de órdenes inmediatamente...');
    executeWithErrorHandling(false); // modo normal
  }
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