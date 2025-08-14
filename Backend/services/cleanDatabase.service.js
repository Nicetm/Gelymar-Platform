const { poolPromise } = require('../config/db');
const fs = require('fs-extra');
const path = require('path');
require('dotenv').config();

async function cleanDatabaseAndDirectories() {
  try {
    console.log('Iniciando limpieza de base de datos y directorios...');
    
    const pool = await poolPromise;
    
    // 1. Limpiar directorios físicos
    console.log('Limpiando directorios físicos...');
    const uploadsPath = process.env.FILE_SERVER_ROOT || 'C:\\xampp\\htdocs\\gelymar\\uploads';
    
    if (fs.existsSync(uploadsPath)) {
      try {
        await fs.emptyDir(uploadsPath);
        console.log(`Directorio ${uploadsPath} limpiado correctamente`);
      } catch (error) {
        console.error(`Error limpiando directorio ${uploadsPath}:`, error.message);
      }
    } else {
      console.log(`Directorio ${uploadsPath} no existe, se creará automáticamente`);
    }
    
    // 2. Limpiar base de datos en orden correcto (por foreign keys)
    console.log('Limpiando base de datos...');
    
    // Deshabilitar verificación de foreign keys temporalmente
    await pool.query('SET FOREIGN_KEY_CHECKS = 0');
    
    // Limpiar tablas en orden
    const tablesToClean = ['files', 'order_items', 'orders', 'customers'];
    
    for (const table of tablesToClean) {
      try {
        const [result] = await pool.query(`DELETE FROM ${table}`);
        console.log(`Tabla ${table} limpiada: ${result.affectedRows} registros eliminados`);
      } catch (error) {
        console.error(`Error limpiando tabla ${table}:`, error.message);
      }
    }
    
    // Resetear auto-increment
    for (const table of tablesToClean) {
      try {
        await pool.query(`ALTER TABLE ${table} AUTO_INCREMENT = 1`);
        console.log(`Auto-increment de tabla ${table} reseteado`);
      } catch (error) {
        console.error(`Error reseteando auto-increment de ${table}:`, error.message);
      }
    }
    
    // Habilitar verificación de foreign keys
    await pool.query('SET FOREIGN_KEY_CHECKS = 1');
    
    console.log('Limpieza completada exitosamente');
    
  } catch (error) {
    console.error('Error en limpieza de base de datos y directorios:', error.message);
  }
}

module.exports = { cleanDatabaseAndDirectories }; 