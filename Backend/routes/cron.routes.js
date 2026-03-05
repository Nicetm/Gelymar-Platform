const express = require('express');
const router = express.Router();

// Importar servicios de cron via DI
const { container } = require('../config/container');
const { checkClientAccess } = container.resolve('checkClientAccessService');
const { generateDefaultFiles } = container.resolve('checkDefaultFilesService');
const { createDefaultRecords } = container.resolve('createDefaultRecordsService');
const { generatePendingPDFs } = container.resolve('generatePendingPDFsService');
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
    const { pc, factura, idNroOvMasFactura } = req.body || {};
    const parts = [];
    if (pc) parts.push(`pc=${pc}`);
    if (idNroOvMasFactura) parts.push(`id=${idNroOvMasFactura}`);
    if (!idNroOvMasFactura && factura) parts.push(`factura=${factura}`);
    logger.info(`[cronRoutes] Iniciando generación de archivos por defecto${parts.length ? ` ${parts.join(' ')}` : ''}`);
    await generateDefaultFiles({ pc, factura, idNroOvMasFactura });
    res.json({ success: true, message: 'Archivos por defecto generados correctamente' });
  } catch (error) {
    logger.error(`[cronRoutes] Error generando archivos por defecto: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});



// Endpoint para crear registros por defecto
router.post('/create-default-records', async (req, res) => {
  try {
    const { pc, factura } = req.body;
    const filters = {};
    if (pc) filters.pc = pc;
    if (factura) filters.factura = factura;
    
    logger.info(`[cronRoutes] Iniciando creación de registros por defecto pc=${pc || 'todos'} factura=${factura || 'N/A'}`);
    const startTime = Date.now();
    
    const result = await createDefaultRecords(filters);
    
    const duration = Date.now() - startTime;
    logger.info(`[cronRoutes] Creación de registros completada en ${duration}ms`);
    
    res.status(200).json({ 
      success: true, 
      message: 'Registros por defecto creados correctamente',
      ...result
    });
  } catch (error) {
    logger.error(`[cronRoutes] Error creando registros por defecto: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});



// Endpoint para generar PDFs pendientes
router.post('/generate-pending-pdfs', async (req, res) => {
  try {
    const { pc, factura } = req.body;
    const filters = {};
    if (pc) filters.pc = pc;
    if (factura) filters.factura = factura;
    
    logger.info(`[cronRoutes] Iniciando generación de PDFs pendientes pc=${pc || 'todos'} factura=${factura || 'N/A'}`);
    const startTime = Date.now();
    
    const result = await generatePendingPDFs(filters);
    
    const duration = Date.now() - startTime;
    logger.info(`[cronRoutes] Generación de PDFs completada en ${duration}ms`);
    
    res.status(200).json({ 
      success: true, 
      message: 'PDFs pendientes generados correctamente',
      ...result
    });
  } catch (error) {
    logger.error(`[cronRoutes] Error generando PDFs pendientes: ${error.message}`);
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

