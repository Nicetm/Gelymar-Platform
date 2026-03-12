const { container } = require('../config/container');
const cronConfigService = container.resolve('cronConfigService');
const { logger } = require('../utils/logger');
const { t } = require('../i18n');

/**
 * @route GET /api/cron-config/cron-tasks-config
 * @desc Obtiene la configuración de todas las tareas de cron
 * @access Protegido (requiere JWT y rol admin)
 */
const getCronTasksConfig = async (req, res) => {
  try {
    const rows = await cronConfigService.getAllCronTasksWithDetails();

    logger.info(`Configuración de cron obtenida: ${rows.length} tareas`);
    res.json(rows);
  } catch (error) {
    logger.error(`Error obteniendo configuración de cron: ${error.message}`);
    res.status(500).json({ message: t('cronConfig.get_config_error', req.lang || 'es') });
  }
};

/**
 * @route PUT /api/cron-config/cron-tasks-config/:taskName
 * @desc Actualiza el estado de una tarea de cron específica
 * @access Protegido (requiere JWT y rol admin)
 */
const updateCronTaskConfig = async (req, res) => {
  try {
    const { taskName } = req.params;
    const { is_enabled } = req.body;

    if (typeof is_enabled !== 'boolean') {
      return res.status(400).json({ message: t('cronConfig.is_enabled_boolean', req.lang || 'es') });
    }

    const success = await cronConfigService.updateCronTaskConfig(taskName, is_enabled);
    
    if (!success) {
      return res.status(404).json({ message: t('cronConfig.task_not_found', req.lang || 'es') });
    }

    logger.info(`Configuración de cron actualizada: ${taskName} = ${is_enabled}`);
    res.json({ message: t('cronConfig.config_updated', req.lang || 'es') });
  } catch (error) {
    logger.error(`Error actualizando configuración de cron: ${error.message}`);
    res.status(500).json({ message: t('cronConfig.update_error', req.lang || 'es') });
  }
};

/**
 * @route PUT /api/cron-config/cron-tasks-config
 * @desc Actualiza múltiples configuraciones de tareas de cron
 * @access Protegido (requiere JWT y rol admin)
 */
const updateMultipleCronTasksConfig = async (req, res) => {
  try {
    const { tasks } = req.body;

    if (!Array.isArray(tasks)) {
      return res.status(400).json({ message: t('cronConfig.tasks_must_be_array', req.lang || 'es') });
    }

    await cronConfigService.updateMultipleCronTasksConfig(tasks);
    
    logger.info(`Configuración de cron actualizada: ${tasks.length} tareas`);
    res.json({ message: t('cronConfig.multiple_updated', req.lang || 'es') });
  } catch (error) {
    logger.error(`Error actualizando múltiples configuraciones de cron: ${error.message}`);
    res.status(500).json({ message: t('cronConfig.multiple_update_error', req.lang || 'es') });
  }
};

module.exports = {
  getCronTasksConfig,
  updateCronTaskConfig,
  updateMultipleCronTasksConfig
};
