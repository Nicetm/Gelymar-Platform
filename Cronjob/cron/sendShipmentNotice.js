const axios = require('axios');
const cron = require('node-cron');
const { logger } = require('../../Backend/utils/logger');

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
      logger.info('[processShipmentNotices] No se encontraron Shipment Notice para enviar');
    } else {
      logger.info(`[processShipmentNotices] Shipment Notice enviados: ${data.processed}`);
    }
  } catch (error) {
    logger.error(`[processShipmentNotices] Error en procesamiento de Shipment Notice: ${error.message}`);
    if (error.response) {
      logger.error(`[processShipmentNotices] Respuesta del servidor: ${JSON.stringify(error.response.data)}`);
    }
  }
}

async function executeWithErrorHandling() {
  try {
    await processShipmentNotices();
  } catch (error) {
    logger.error(`[processShipmentNotices] Error en procesamiento: ${error.message}`);
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
    logger.error(`[processShipmentNotices] Error en procesamiento de Shipment Notice: ${error.message}`);
  }
});
