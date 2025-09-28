const { poolPromise } = require('../config/db');
const fs = require('fs-extra');
const path = require('path');
// Las variables de entorno ya se cargan automáticamente en app.js

async function cleanDatabaseAndDirectories() {
  try {
    console.log('Iniciando limpieza de base de datos...');
    
    const pool = await poolPromise;
       
    // Limpiar base de datos en orden correcto (por foreign keys)
    console.log('Limpiando base de datos...');
    
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
        console.log(`Tabla ${table} limpiada: ${result.affectedRows} registros eliminados`);
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
        console.log(`Auto-increment de tabla ${table} reseteado`);
      } catch (error) {
        console.error(`Error reseteando auto-increment de ${table}:`, error.message);
      }
    }
    
    // Habilitar verificación de foreign keys
    await pool.query('SET FOREIGN_KEY_CHECKS = 1');
    
    console.log('Limpieza de base de datos completada exitosamente');
    
  } catch (error) {
    console.error('Error en limpieza de base de datos:', error.message);
  }
}

module.exports = { cleanDatabaseAndDirectories }; 