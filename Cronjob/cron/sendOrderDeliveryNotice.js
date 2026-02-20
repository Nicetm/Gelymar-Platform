const axios = require('axios');
const cron = require('node-cron');
const { logger } = require('../../Backend/utils/logger');

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
      logger.info('[processOrderDeliveryNotices] No se encontraron Order Delivery Notice para enviar');
    } else {
      logger.info(`[processOrderDeliveryNotices] Order Delivery Notice enviados: ${data.processed}`);
    }
  } catch (error) {
    logger.error(`[processOrderDeliveryNotices] Error en procesamiento de Order Delivery Notice: ${error.message}`);
    if (error.response) {
      logger.error(`[processOrderDeliveryNotices] Respuesta del servidor: ${JSON.stringify(error.response.data)}`);
    }
  }
}

async function executeWithErrorHandling() {
  try {
    await processOrderDeliveryNotices();
  } catch (error) {
    logger.error(`[processOrderDeliveryNotices] Error en procesamiento: ${error.message}`);
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
    logger.error(`[processOrderDeliveryNotices] Error en procesamiento de Order Delivery Notice: ${error.message}`);
  }
});
