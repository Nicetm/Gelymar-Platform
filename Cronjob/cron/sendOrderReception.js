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

// Función para procesar órdenes nuevas y enviar correos
async function processNewOrdersAndSendEmails() {
  try {
    console.log('Iniciando procesamiento de órdenes nuevas...');
    
    // Llamar al endpoint del backend que ya tiene toda la lógica
    const url = `${BACKEND_API_URL}/api/cron/process-new-orders`;
    console.log(`Llamando al endpoint: ${url}`);
    
    const response = await axios.post(url, {}, {
      timeout: 300000, // 5 minutos
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Procesamiento de órdenes nuevas completado:', response.data);
    
  } catch (error) {
    console.error('Error en procesamiento de órdenes nuevas:', error.message);
    if (error.response) {
      console.error('Respuesta del servidor:', error.response.data);
    }
  }
}

// Función para ejecutar con manejo de errores
async function executeWithErrorHandling() {
  try {
    await processNewOrdersAndSendEmails();
  } catch (error) {
    console.error('Error en procesamiento:', error.message);
  } finally {
    emitReady();
  }
}

// Verificar si se debe ejecutar inmediatamente
const arg = process.argv[2];
console.log('Argumento recibido:', arg);

if (arg === 'execute-now') {
  console.log('👉 Ejecutando procesamiento de órdenes nuevas inmediatamente...');
  executeWithErrorHandling();
} else {
  console.log('👉 Modo normal (ejecución programada o sin argumentos)');
  emitReady();
}

// Cron independiente - se ejecuta diariamente a las 8 AM
cron.schedule('36 14 * * *', async () => {
  console.log(`[${new Date().toISOString()}] Iniciando procesamiento de órdenes nuevas...`);
  try {
    await processNewOrdersAndSendEmails();
    console.log(`[${new Date().toISOString()}] Procesamiento de órdenes nuevas completado`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error en procesamiento de órdenes nuevas:`, error.message);
  }
});
