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
    
    // Llamar al endpoint del backend que ya tiene toda la lógica
    const url = `${BACKEND_API_URL}/api/cron/process-new-orders`;
    
    const response = await axios.post(url, {}, {
      timeout: 300000, // 5 minutos
      headers: {
        'Content-Type': 'application/json'
      }
    });
    const data = response.data || {};

    if (data.skipped) {
      console.log('Envio automatico de recepcion deshabilitado por configuracion');
      return;
    }

    if (data.processed === 0) {
      console.log('No se encontraron ordenes nuevas para enviar recepcion');
    } else {
      console.log(`Envio de documentos de recepcion completado. Ordenes procesadas: ${data.processed}`);
    }
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

if (arg === 'execute-now') {
  executeWithErrorHandling();
} else {
  emitReady();
}

// Cron independiente - se ejecuta diariamente a las 8 AM
cron.schedule('0 10 * * *', async () => { 
  try {
    await processNewOrdersAndSendEmails();
  } catch (error) {
    console.error('Error en procesamiento de órdenes nuevas:', error.message);
  }
});
