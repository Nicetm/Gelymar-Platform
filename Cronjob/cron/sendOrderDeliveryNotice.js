const axios = require('axios');
const cron = require('node-cron');

const BACKEND_API_URL = process.env.BACKEND_API_URL || 'http://localhost:3000';

const emitReady = () => {
  if (process.send) {
    process.send('ready');
  }
};

async function processOrderDeliveryNotices() {
  try {
    const url = `${BACKEND_API_URL}/api/cron/process-order-delivery-notices`;
    const response = await axios.post(url, {}, {
      timeout: 300000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    const data = response.data || {};

    if (data.processed === 0) {
      console.log('No se encontraron Order Delivery Notice para enviar');
    } else {
      console.log(`Order Delivery Notice enviados: ${data.processed}`);
    }
  } catch (error) {
    console.error('Error en procesamiento de Order Delivery Notice:', error.message);
    if (error.response) {
      console.error('Respuesta del servidor:', error.response.data);
    }
  }
}

async function executeWithErrorHandling() {
  try {
    await processOrderDeliveryNotices();
  } catch (error) {
    console.error('Error en procesamiento:', error.message);
  } finally {
    emitReady();
  }
}

const arg = process.argv[2];

if (arg === 'execute-now') {
  executeWithErrorHandling();
} else {
  emitReady();
}

// Cron diario
cron.schedule('0 10 * * *', async () => {
  try {
    await processOrderDeliveryNotices();
  } catch (error) {
    console.error('Error en procesamiento de Order Delivery Notice:', error.message);
  }
});
