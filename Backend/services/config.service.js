const { poolPromise } = require('../config/db');

// Obtener configuración por nombre
const getConfigByName = async (name) => {
  try {
    const pool = await poolPromise;
    const [rows] = await pool.query(
      'SELECT params FROM param_config WHERE name = ?',
      [name]
    );
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    console.error('Error obteniendo configuración:', error);
    throw error;
  }
};

// Actualizar configuración
const updateConfig = async (name, params) => {
  try {
    const pool = await poolPromise;
    const [result] = await pool.query(`
      UPDATE param_config SET params = ? WHERE name = ?
    `, [JSON.stringify(params), name]);
    return result;
  } catch (error) {
    console.error('Error actualizando configuración:', error);
    throw error;
  }
};

module.exports = {
  getConfigByName,
  updateConfig
};
