const express = require('express');
const router = express.Router();

// Importar servicios de cron via DI
const { container } = require('../config/container');
const { checkClientAccess } = container.resolve('checkClientAccessService');
const { generateDefaultFiles } = container.resolve('checkDefaultFilesService');
const cronConfigService = container.resolve('cronConfigService');
const adminNotificationSummaryService = container.resolve('adminNotificationSummaryService');
const { logger } = require('../utils/logger');


// Endpoint para verificar acceso de clientes
router.post('/check-client-access', async (req, res) => {
  try {
    logger.info('[cronRoutes] Iniciando verificación de acceso de clientes');
    await checkClientAccess();
    res.json({ success: true, message: 'Acceso de clientes verificado correctamente' });
  } catch (error) {
    logger.error(`[cronRoutes] Error verificando acceso de clientes: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});



// Endpoint para generar archivos por defecto
router.post('/generate-default-files', async (req, res) => {
  try {
    const { pc } = req.body || {};
    logger.info(`[cronRoutes] Iniciando generación de archivos por defecto${pc ? ` pc=${pc}` : ''}`);
    await generateDefaultFiles(pc);
    res.json({ success: true, message: 'Archivos por defecto generados correctamente' });
  } catch (error) {
    logger.error(`[cronRoutes] Error generando archivos por defecto: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});


// Endpoint para enviar resumen diario de notificaciones admin
router.post('/send-admin-notification-summary', async (req, res) => {
  try {
    logger.info('[cronRoutes] Iniciando envio de resumen diario de notificaciones');
    const result = await adminNotificationSummaryService.sendDailyAdminNotificationSummary();
    res.json({ success: true, ...result });
  } catch (error) {
    logger.error(`[cronRoutes] Error enviando resumen diario: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint para obtener configuración de tareas cron
router.get('/tasks-config', async (req, res) => {
  try {
    const config = await cronConfigService.getCronTasksConfig();
    res.json({ success: true, config });
  } catch (error) {
    logger.error(`[cronRoutes] Error obteniendo configuración de tareas: ${error.message}`);
    // Fallback a configuración por defecto
    const defaultConfig = {
      clean_database: false,
      check_clients: false,
      check_client_access: true,
      check_items: false,
      check_orders: false,
      check_order_lines: false,
      check_default_files: true
    };
    res.json({ success: true, config: defaultConfig });
  }
});

module.exports = router;

