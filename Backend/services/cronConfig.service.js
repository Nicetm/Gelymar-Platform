const { poolPromise } = require('../config/db');

/**
 * Obtener configuración de tareas cron desde param_config
 * @returns {Promise<Object>} Configuración de tareas
 */
async function getCronTasksConfig() {
  try {
    const pool = await poolPromise;
    
    // Leer SOLO desde param_config
    const [paramRows] = await pool.execute(`
      SELECT name, params 
      FROM param_config 
      WHERE type = 'configuración'
    `);
    
    const config = {};
    paramRows.forEach(row => {
      try {
        const params = JSON.parse(row.params);
        // Convertir nombre de camelCase a snake_case para consistencia
        const taskName = row.name.replace(/([A-Z])/g, '_$1').toLowerCase();
        config[taskName] = params.enable === 1;
      } catch (parseError) {
        const { logger } = require('../utils/logger');
        logger.error(`[CronConfigService] Error parseando params para ${row.name}: ${parseError.message}`);
      }
    });
    
    return config;
  } catch (error) {
    const { logger } = require('../utils/logger');
    logger.error(`[CronConfigService] Error obteniendo configuración de tareas cron: ${error.message}`);
    throw error;
  }
}

module.exports = {
  getCronTasksConfig
};
