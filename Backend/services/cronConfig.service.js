const { poolPromise } = require('../config/db');

/**
 * Convierte formato de hora HH:MM a formato cron
 * @param {string} time - Hora en formato HH:MM (ej: "23:15")
 * @returns {string} Formato cron (ej: "15 23 * * *")
 */
function timeToCron(time) {
  if (!time || typeof time !== 'string') return null;
  const match = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const [, hours, minutes] = match;
  return `${minutes} ${hours} * * *`;
}

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
        const params = typeof row.params === 'string' 
          ? JSON.parse(row.params) 
          : row.params;
        // Usar el nombre tal cual viene de la base de datos
        config[row.name] = {
          enabled: params.enable === 1,
          schedule: params.schedule || null,
          sendFrom: params.sendFrom || null
        };
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
  getCronTasksConfig,
  timeToCron
};
