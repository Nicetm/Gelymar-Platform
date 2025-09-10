const axios = require('axios');
const cron = require('node-cron');

// Configuración de la API del backend
const BACKEND_API_URL = process.env.BACKEND_API_URL || 'http://localhost:3000';

// Función para emitir señal de ready
const emitReady = () => {
  if (process.send) {
    process.send('ready');
  }
};

// Función para ejecutar con manejo de errores
async function executeWithErrorHandling() {
  try {
    console.log('Llamando al endpoint de verificación de ETD...');
    const response = await axios.post(`${BACKEND_API_URL}/api/cron/check-etd`);
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

// Cron independiente - se ejecuta 5 veces al día desde 8 AM hasta 1 AM
cron.schedule('0 8,12,16,20,1 * * *', async () => {
  console.log(`[${new Date().toISOString()}] Iniciando verificación de ETD...`);
  try {
    console.log('Llamando al endpoint de verificación de ETD...');
    const response = await axios.post(`${BACKEND_API_URL}/api/cron/check-etd`);
    console.log(`[${new Date().toISOString()}] Verificación de ETD completada.`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error en verificación de ETD:`, error.message);
  }
}); 