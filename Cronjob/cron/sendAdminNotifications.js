const axios = require('axios');
const cron = require('node-cron');
const { logger } = require('../../Backend/utils/logger');

const BACKEND_API_URL = process.env.BACKEND_API_URL || 'http://localhost:3000';

const emitReady = () => {
  if (process.send) {
    process.send('ready');
  }
};

async function sendAdminNotificationSummary() {
  try {
    const url = `${BACKEND_API_URL}/api/cron/send-admin-notification-summary`;
    const response = await axios.post(url, {}, {
      timeout: 300000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const data = response.data || {};
    if (data.skipped) {
      logger.info('[sendAdminNotifications] Resumen diario: sin destinatarios configurados.');
      return;
    }
    logger.info(`[sendAdminNotifications] Resumen diario enviado. Admins procesados: ${data.processed || 0}`);
  } catch (error) {
    logger.error(`[sendAdminNotifications] Error enviando resumen diario de notificaciones: ${error.message}`);
  }
}

const arg = process.argv[2];

if (arg === 'execute-now') {
  (async () => {
    await sendAdminNotificationSummary();
    emitReady();
  })();
} else {
  emitReady();
}

// Cron diario a las 09:00 AM
cron.schedule('0 9 * * *', async () => {
  await sendAdminNotificationSummary();
});
