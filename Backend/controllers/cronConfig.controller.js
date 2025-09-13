const { poolPromise } = require('../config/db');
const { logger } = require('../utils/logger');

/**
 * @route GET /api/cron-config/cron-tasks-config
 * @desc Obtiene la configuración de todas las tareas de cron
 * @access Protegido (requiere JWT y rol admin)
 */
const getCronTasksConfig = async (req, res) => {
  try {
    const pool = await poolPromise;
    const [rows] = await pool.query(`
      SELECT id, task_name, task_description, is_enabled, created_at, updated_at
      FROM cron_tasks_config
      ORDER BY task_name
    `);

    logger.info(`Configuración de cron obtenida: ${rows.length} tareas`);
    res.json(rows);
  } catch (error) {
    logger.error(`Error obteniendo configuración de cron: ${error.message}`);
    res.status(500).json({ message: 'Error interno del servidor' });
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
      return res.status(400).json({ message: 'is_enabled debe ser un valor booleano' });
    }

    const pool = await poolPromise;
    const [result] = await pool.query(`
      UPDATE cron_tasks_config 
      SET is_enabled = ?, updated_at = NOW()
      WHERE task_name = ?
    `, [is_enabled, taskName]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Tarea de cron no encontrada' });
    }

    logger.info(`Configuración de cron actualizada: ${taskName} = ${is_enabled}`);
    res.json({ message: 'Configuración actualizada exitosamente' });
  } catch (error) {
    logger.error(`Error actualizando configuración de cron: ${error.message}`);
    res.status(500).json({ message: 'Error interno del servidor' });
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
      return res.status(400).json({ message: 'tasks debe ser un array' });
    }

    const pool = await poolPromise;
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();

      for (const task of tasks) {
        const { task_name, is_enabled } = task;
        
        if (typeof is_enabled !== 'boolean') {
          throw new Error(`is_enabled debe ser booleano para ${task_name}`);
        }

        await connection.query(`
          UPDATE cron_tasks_config 
          SET is_enabled = ?, updated_at = NOW()
          WHERE task_name = ?
        `, [is_enabled, task_name]);
      }

      await connection.commit();
      logger.info(`Configuración de cron actualizada: ${tasks.length} tareas`);
      res.json({ message: 'Configuraciones actualizadas exitosamente' });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    logger.error(`Error actualizando múltiples configuraciones de cron: ${error.message}`);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

module.exports = {
  getCronTasksConfig,
  updateCronTaskConfig,
  updateMultipleCronTasksConfig
};
