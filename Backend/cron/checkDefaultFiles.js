require('dotenv').config();
const { generateDefaultFiles } = require('../services/checkDefaultFiles.service');
const cron = require('node-cron');

console.log('Iniciando servicio de generación de documentos por defecto...');

// Función para emitir señal de ready
const emitReady = () => {
  if (process.send) {
    process.send('ready');
  }
};

// Ejecutar inmediatamente al iniciar
// Función para ejecutar con manejo de errores
async function executeWithErrorHandling() {
  try {
    await generateDefaultFiles();
    console.log('Procesamiento inicial de documentos por defecto completado');
  } catch (error) {
    console.error('Error en procesamiento inicial de documentos por defecto:', error.message);
    console.log('Continuando con el siguiente proceso...');
  } finally {
    emitReady();
  }
}

// Verificar si se debe ejecutar inmediatamente
const shouldExecuteNow = process.argv.includes('--execute-now');

if (shouldExecuteNow) {
  console.log('🚀 Ejecutando tarea de documentos por defecto inmediatamente...');
  executeWithErrorHandling();
} else {
  console.log('⏰ Proceso de documentos por defecto iniciado. Esperando programación (6:45 AM)...');
  emitReady();
}

// Ejecutar a las 6:45 AM diariamente
cron.schedule('45 6 * * *', async () => {
  console.log('Ejecutando generación de documentos por defecto programada...');
  try {
    await generateDefaultFiles();
    console.log(`[${new Date().toISOString()}] Documentos por defecto generados.`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error en generación de documentos por defecto:`, error.message);
    console.log('Continuando con el siguiente proceso...');
  }
}); 