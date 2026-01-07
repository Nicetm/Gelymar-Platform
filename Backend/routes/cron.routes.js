const express = require('express');
const router = express.Router();

// Importar servicios de cron
const { fetchClientFilesFromNetwork } = require('../services/checkClients.service');
const { checkClientAccess } = require('../services/checkClientAccess.service');
const { fetchItemFilesFromNetwork } = require('../services/checkItems.service');
const { fetchOrderFilesFromNetwork } = require('../services/checkOrders.service');
const { fetchOrderLineFilesFromNetwork } = require('../services/checkOrderLines.service');
const { generateDefaultFiles } = require('../services/checkDefaultFiles.service');
const { checkOrdersWithETD } = require('../services/checkETD.service');
const { cleanDatabaseAndDirectories } = require('../services/cleanDatabase.service');
const { getCronTasksConfig } = require('../services/cronConfig.service');
const { sendDailyAdminNotificationSummary } = require('../services/adminNotificationSummary.service');

// Endpoint para procesar clientes
router.post('/check-clients', async (req, res) => {
  try {
    console.log('Iniciando procesamiento de clientes...');
    await fetchClientFilesFromNetwork();
    console.log('Procesamiento de clientes completado');
    res.json({ success: true, message: 'Clientes procesados correctamente' });
  } catch (error) {
    console.error('Error procesando clientes:', error.message);
    // Si es un error de montaje de red, no fallar completamente
    if (error.message.includes('Archivo no disponible') || error.message.includes('Error montando red')) {
      res.json({ success: true, message: 'Proceso completado (sin archivos de red disponibles)' });
    } else {
      res.status(500).json({ success: false, error: error.message });
    }
  }
});

// Endpoint para verificar acceso de clientes
router.post('/check-client-access', async (req, res) => {
  try {
    console.log('Iniciando verificación de acceso de clientes...');
    await checkClientAccess();
    console.log('Verificación de acceso de clientes completada');
    res.json({ success: true, message: 'Acceso de clientes verificado correctamente' });
  } catch (error) {
    console.error('Error verificando acceso de clientes:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint para procesar items
router.post('/check-items', async (req, res) => {
  try {
    console.log('Iniciando procesamiento de items...');
    await fetchItemFilesFromNetwork();
    console.log('Procesamiento de items completado');
    res.json({ success: true, message: 'Items procesados correctamente' });
  } catch (error) {
    console.error('Error procesando items:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint para procesar órdenes
router.post('/check-orders', async (req, res) => {
  try {
    console.log('Iniciando procesamiento de órdenes...');
    await fetchOrderFilesFromNetwork();
    console.log('Procesamiento de órdenes completado');
    res.json({ success: true, message: 'Órdenes procesadas correctamente' });
  } catch (error) {
    console.error('Error procesando órdenes:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint para procesar líneas de orden
router.post('/check-order-lines', async (req, res) => {
  try {
    console.log('Iniciando procesamiento de líneas de orden...');
    await fetchOrderLineFilesFromNetwork();
    console.log('Procesamiento de líneas de orden completado');
    res.json({ success: true, message: 'Líneas de orden procesadas correctamente' });
  } catch (error) {
    console.error('Error procesando líneas de orden:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint para generar archivos por defecto
router.post('/generate-default-files', async (req, res) => {
  try {
    console.log('Iniciando generación de archivos por defecto...');
    await generateDefaultFiles();
    console.log('Generación de archivos por defecto completada');
    res.json({ success: true, message: 'Archivos por defecto generados correctamente' });
  } catch (error) {
    console.error('Error generando archivos por defecto:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint para verificar ETD
router.post('/check-etd', async (req, res) => {
  try {
    console.log('Iniciando verificación de ETD...');
    await checkOrdersWithETD();
    console.log('Verificación de ETD completada');
    res.json({ success: true, message: 'ETD verificado correctamente' });
  } catch (error) {
    console.error('Error verificando ETD:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint para limpiar base de datos
router.post('/clean-database', async (req, res) => {
  try {
    console.log('Iniciando limpieza de base de datos...');
    await cleanDatabaseAndDirectories();
    console.log('Limpieza de base de datos completada');
    res.json({ success: true, message: 'Base de datos limpiada correctamente' });
  } catch (error) {
    console.error('Error limpiando base de datos:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint para enviar resumen diario de notificaciones admin
router.post('/send-admin-notification-summary', async (req, res) => {
  try {
    console.log('Iniciando envio de resumen diario de notificaciones...');
    const result = await sendDailyAdminNotificationSummary();
    console.log('Envio de resumen diario completado');
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error enviando resumen diario:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint para obtener configuración de tareas cron
router.get('/tasks-config', async (req, res) => {
  try {
    const config = await getCronTasksConfig();
    res.json({ success: true, config });
  } catch (error) {
    console.error('Error obteniendo configuración de tareas:', error.message);
    // Fallback a configuración por defecto
    const defaultConfig = {
      clean_database: true,
      check_clients: true,
      check_client_access: true,
      check_items: true,
      check_orders: true,
      check_order_lines: true,
      check_default_files: true
    };
    res.json({ success: true, config: defaultConfig });
  }
});

module.exports = router;


