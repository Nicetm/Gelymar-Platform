const { poolPromise } = require('../config/db');

/**
 * Obtener todas las tareas cron con detalles completos
 * @returns {Promise<Array>} Array de tareas con todos los campos
 */
async function getAllCronTasksWithDetails() {
  try {
    const pool = await poolPromise;
    const [rows] = await pool.execute(`
      SELECT id, task_name, task_description, is_enabled, created_at, updated_at
      FROM cron_tasks_config
      ORDER BY task_name
    `);
    return rows;
  } catch (error) {
    const { logger } = require('../utils/logger');
    logger.error(`[CronConfigService] Error obteniendo detalles de tareas cron: ${error.message}`);
    throw error;
  }
}

/**
 * Obtener configuración de tareas cron desde la base de datos
 * @returns {Promise<Object>} Configuración de tareas
 */
async function getCronTasksConfig() {
  try {
    const pool = await poolPromise;
    const [rows] = await pool.execute('SELECT task_name, is_enabled FROM cron_tasks_config');
    
    const config = {};
    rows.forEach(row => {
      config[row.task_name] = row.is_enabled;
    });
    
    return config;
  } catch (error) {
    const { logger } = require('../utils/logger');
    logger.error(`[CronConfigService] Error obteniendo configuración de tareas cron: ${error.message}`);
    throw error;
  }
}

/**
 * Actualizar configuración de una tarea cron
 * @param {string} taskName - Nombre de la tarea
 * @param {boolean} isEnabled - Estado de la tarea
 * @returns {Promise<boolean>} Éxito de la operación
 */
async function updateCronTaskConfig(taskName, isEnabled) {
  try {
    const pool = await poolPromise;
    await pool.execute(
      'UPDATE cron_tasks_config SET is_enabled = ?, updated_at = NOW() WHERE task_name = ?',
      [isEnabled, taskName]
    );
    return true;
  } catch (error) {
    const { logger } = require('../utils/logger');
    logger.error(`[CronConfigService] Error actualizando configuración de tarea cron: ${error.message}`);
    throw error;
  }
}

/**
 * Actualizar múltiples configuraciones de tareas cron con transacción
 * @param {Array} tasks - Array de objetos {task_name, is_enabled}
 * @returns {Promise<boolean>} Éxito de la operación
 */
async function updateMultipleCronTasksConfig(tasks) {
  const pool = await poolPromise;
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    for (const task of tasks) {
      const { task_name, is_enabled } = task;
      
      if (typeof is_enabled !== 'boolean') {
        throw new Error(`is_enabled debe ser booleano para ${task_name}`);
      }

      await connection.query(
        'UPDATE cron_tasks_config SET is_enabled = ?, updated_at = NOW() WHERE task_name = ?',
        [is_enabled, task_name]
      );
    }

    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    const { logger } = require('../utils/logger');
    logger.error(`[CronConfigService] Error actualizando múltiples configuraciones de tareas cron: ${error.message}`);
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  getAllCronTasksWithDetails,
  getCronTasksConfig,
  updateCronTaskConfig,
  updateMultipleCronTasksConfig
};
