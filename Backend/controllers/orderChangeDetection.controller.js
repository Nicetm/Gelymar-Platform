const { container } = require('../config/container');
const { logger } = require('../utils/logger');
const { poolPromise } = require('../config/db');
const cronConfigService = container.resolve('cronConfigService');
const orderChangeDetectionService = container.resolve('orderChangeDetectionService');

/**
 * POST /api/cron/detect-order-changes
 * Ejecuta un ciclo de detección de cambios en órdenes.
 * Lee config desde param_config; si deshabilitado retorna { skipped: true }.
 */
const detectOrderChanges = async (req, res) => {
  const startTimeMs = Date.now();
  try {
    const config = await cronConfigService.getCronTasksConfig();
    const taskConfig = config.orderChangeDetection;

    if (!taskConfig || !taskConfig.enabled) {
      const duration = ((Date.now() - startTimeMs) / 1000).toFixed(2);
      logger.info('[OrderChangeDetection] Tarea deshabilitada, omitiendo ciclo');
      return res.json({ success: true, message: 'Tarea deshabilitada en configuración', skipped: true, ordersProcessed: 0, changesDetected: 0, errors: 0, duration: `${duration}s` });
    }

    const result = await orderChangeDetectionService.runDetectionCycle();
    const duration = ((Date.now() - startTimeMs) / 1000).toFixed(2);
    const message = result.changesDetected > 0
      ? `Cambios detectados en ${result.changesDetected} campo(s) de ${result.ordersProcessed} orden(es)`
      : `${result.ordersProcessed} orden(es) procesada(s), sin cambios detectados`;

    res.json({
      success: true,
      message,
      ordersProcessed: result.ordersProcessed,
      changesDetected: result.changesDetected,
      errors: result.errorsCount,
      skipped: false,
      duration: `${duration}s`
    });
  } catch (error) {
    const duration = ((Date.now() - startTimeMs) / 1000).toFixed(2);
    logger.error(`[OrderChangeDetection] Error en endpoint cron: ${error.message}`);
    res.status(500).json({ success: false, error: error.message, duration: `${duration}s` });
  }
};

/**
 * GET /api/order-changes/summary
 * Retorna lista de órdenes con cambios no reconocidos (para badge en frontend).
 */
const getChangeSummary = async (req, res) => {
  try {
    const pool = await poolPromise;
    const [rows] = await pool.execute(`
      SELECT pc, factura, COUNT(*) AS unacknowledged_count
      FROM order_changes
      WHERE acknowledged = 0
      GROUP BY pc, factura
    `);

    const summary = rows.map(row => ({
      pc: row.pc,
      factura: row.factura,
      has_unacknowledged_changes: true,
      unacknowledged_count: row.unacknowledged_count,
    }));

    res.json(summary);
  } catch (error) {
    logger.error(`[OrderChangeDetection] Error obteniendo resumen: ${error.message}`);
    res.status(500).json({ message: 'Error obteniendo resumen de cambios' });
  }
};

/**
 * GET /api/order-changes/:pc
 * Retorna cambios no reconocidos de una orden.
 */
const getOrderChanges = async (req, res) => {
  try {
    const { pc } = req.params;
    const factura = req.query.factura || null;
    const pool = await poolPromise;

    const [rows] = await pool.execute(
      'SELECT field_name, old_value, new_value, detected_at FROM order_changes WHERE pc = ? AND factura <=> ? AND acknowledged = 0 ORDER BY detected_at DESC',
      [pc, factura]
    );

    res.json(rows);
  } catch (error) {
    logger.error(`[OrderChangeDetection] Error obteniendo cambios pc=${req.params.pc}: ${error.message}`);
    res.status(500).json({ message: 'Error obteniendo cambios de la orden' });
  }
};

/**
 * POST /api/order-changes/:pc/acknowledge
 * Marca cambios como reconocidos por el admin.
 */
const acknowledgeOrderChanges = async (req, res) => {
  try {
    const { pc } = req.params;
    const factura = req.query.factura || null;
    const userId = req.user?.id;
    const pool = await poolPromise;

    const [result] = await pool.execute(
      'UPDATE order_changes SET acknowledged = 1, acknowledged_by = ?, acknowledged_at = NOW() WHERE pc = ? AND factura <=> ? AND acknowledged = 0',
      [userId, pc, factura]
    );

    res.json({ success: true, acknowledged: result.affectedRows });
  } catch (error) {
    logger.error(`[OrderChangeDetection] Error reconociendo cambios pc=${req.params.pc}: ${error.message}`);
    res.status(500).json({ message: 'Error reconociendo cambios' });
  }
};

module.exports = {
  detectOrderChanges,
  getChangeSummary,
  getOrderChanges,
  acknowledgeOrderChanges,
};
