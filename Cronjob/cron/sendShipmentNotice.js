const axios = require('axios');
const cron = require('node-cron');

const BACKEND_API_URL = process.env.BACKEND_API_URL || 'http://localhost:3000';

const emitReady = () => {
  if (process.send) {
    process.send('ready');
  }
};

async function processShipmentNotices() {
  try {
    const url = `${BACKEND_API_URL}/api/cron/process-shipment-notices`;
    const response = await axios.post(url, {}, {
      timeout: 300000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    const data = response.data || {};

    if (data.processed === 0) {
      console.log('No se encontraron Shipment Notice para enviar');
    } else {
      console.log(`Shipment Notice enviados: ${data.processed}`);
    }
  } catch (error) {
    console.error('Error en procesamiento de Shipment Notice:', error.message);
    if (error.response) {
      console.error('Respuesta del servidor:', error.response.data);
    }
  }
}

async function executeWithErrorHandling() {
  try {
    await processShipmentNotices();
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
    await processShipmentNotices();
  } catch (error) {
    console.error('Error en procesamiento de Shipment Notice:', error.message);
  }
});
