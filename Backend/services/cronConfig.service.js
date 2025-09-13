const { poolPromise } = require('../config/db');

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
    console.error('Error obteniendo configuración de tareas cron:', error.message);
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
    console.error('Error actualizando configuración de tarea cron:', error.message);
    throw error;
  }
}

/**
 * Actualizar múltiples configuraciones de tareas cron
 * @param {Object} configs - Objeto con configuraciones {taskName: isEnabled}
 * @returns {Promise<boolean>} Éxito de la operación
 */
async function updateMultipleCronTasksConfig(configs) {
  try {
    const promises = Object.entries(configs).map(([taskName, isEnabled]) => 
      updateCronTaskConfig(taskName, isEnabled)
    );
    
    await Promise.all(promises);
    return true;
  } catch (error) {
    console.error('Error actualizando múltiples configuraciones de tareas cron:', error.message);
    throw error;
  }
}

module.exports = {
  getCronTasksConfig,
  updateCronTaskConfig,
  updateMultipleCronTasksConfig
};
