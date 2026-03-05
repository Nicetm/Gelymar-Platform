const axios = require('axios');
const cron = require('node-cron');
let logger;
try {
  ({ logger } = require('../../Backend/utils/logger'));
} catch (error) {
  logger = {
    info: console.log,
    warn: console.warn,
    error: console.error
  };
  logger.warn(`[processShipmentNotices] Logger backend no disponible, usando consola. error=${error.message}`);
}

const BACKEND_API_URL = process.env.BACKEND_API_URL || 'http://localhost:3000';

const emitReady = () => {
  if (process.send) {
    process.send('ready');
  }
};

async function processShipmentNotices(pc = null, factura = null) {
  try {
    const url = `${BACKEND_API_URL}/api/cron/process-shipment-notices`;
    const body = {};
    
    if (pc) {
      body.pc = pc;
    }
    if (factura) {
      body.factura = factura;
    }
    
    const response = await axios.post(url, body, {
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

// Cron diario - se ejecuta a las 8:30 AM
cron.schedule('30 8 * * *', async () => {
  try {
    await processShipmentNotices();
  } catch (error) {
    logger.error(`[processShipmentNotices] Error en procesamiento de Shipment Notice: ${error.message}`);
  }
});
