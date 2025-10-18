const { poolPromise } = require('../config/db');
const fs = require('fs-extra');
const path = require('path');
// Las variables de entorno ya se cargan automáticamente en app.js

async function cleanDatabaseAndDirectories() {
  try {   
    const pool = await poolPromise;
       
    // Limpiar base de datos en orden correcto (por foreign keys)   
    // Deshabilitar verificación de foreign keys temporalmente
    await pool.query('SET FOREIGN_KEY_CHECKS = 0');
    
    // Limpiar tablas en orden
    //const tablesToClean = ['order_items', 'order_detail', 'orders', 'customers', 'items'];
    const tablesToClean = [];
    
    for (const table of tablesToClean) {
      try {
        // Validar nombre de tabla para prevenir SQL injection
        if (!tablesToClean.includes(table)) {
          throw new Error(`Nombre de tabla no permitido: ${table}`);
        }
        const [result] = await pool.query('DELETE FROM ??', [table]);
      } catch (error) {
        console.error(`Error limpiando tabla ${table}:`, error.message);
      }
    }
    
    // Resetear auto-increment
    for (const table of tablesToClean) {
      try {
        // Validar nombre de tabla para prevenir SQL injection
        if (!tablesToClean.includes(table)) {
          throw new Error(`Nombre de tabla no permitido: ${table}`);
        }
        await pool.query('ALTER TABLE ?? AUTO_INCREMENT = 1', [table]);
      } catch (error) {
        console.error(`Error reseteando auto-increment de ${table}:`, error.message);
      }
    }
    
    // Habilitar verificación de foreign keys
    await pool.query('SET FOREIGN_KEY_CHECKS = 1');
  } catch (error) {
    console.error('Error en limpieza de base de datos:', error.message);
  }
}

module.exports = { cleanDatabaseAndDirectories }; 