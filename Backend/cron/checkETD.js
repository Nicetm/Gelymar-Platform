const { checkETD } = require('../services/checkETD.service');
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
    await checkETD();
    console.log('Verificación de ETD completada');
  } catch (error) {
    console.error('Error en verificación de ETD:', error.message);
    console.log('Continuando con el siguiente proceso...');
  } finally {
    emitReady();
  }
}

// Verificar si se debe ejecutar inmediatamente
const arg = process.argv[2];
console.log('Argumento recibido:', arg);

if (arg === 'execute-now') {
  console.log('👉 Ejecutando inmediatamente...');
  executeWithErrorHandling();
} else {
  console.log('👉 Modo normal (ejecución programada o sin argumentos)');
  emitReady();
}

cron.schedule('0 7 * * *', async () => {
  console.log(`[${new Date().toISOString()}] Iniciando verificación de ETD...`);
  try {
    await checkETD();
    console.log(`[${new Date().toISOString()}] Verificación de ETD completada.`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error en verificación de ETD:`, error.message);
    console.log('Continuando con el siguiente proceso...');
  }
});
