#!/usr/bin/env node

/**
 * Script de mantenimiento para limpiar archivos temporales y verificar permisos
 * Uso: node scripts/cleanup.js [--temp-only] [--check-permissions]
 */

require('dotenv').config();
const path = require('path');
const { logger } = require('../utils/logger');
const { 
  cleanupTempFiles, 
  verifySecureFilePermissions, 
  setSecureFilePermissions,
  initializeSecureDirectories 
} = require('../utils/filePermissions');

const args = process.argv.slice(2);
const tempOnly = args.includes('--temp-only');
const checkPermissions = args.includes('--check-permissions');

async function main() {
  try {
    logger.info('Iniciando script de mantenimiento...');

    if (!tempOnly) {
      // Inicializar directorios seguros
      logger.info('Inicializando directorios seguros...');
      await initializeSecureDirectories();
    }

    // Limpiar archivos temporales
    const tempDir = path.join(__dirname, '..', 'temp');
    logger.info('Limpiando archivos temporales...');
    const deletedCount = await cleanupTempFiles(tempDir, 24 * 60 * 60 * 1000); // 24 horas
    logger.info(`Archivos temporales eliminados: ${deletedCount}`);

    if (checkPermissions) {
      // Verificar permisos de archivos críticos
      logger.info('Verificando permisos de archivos...');
      
      const criticalFiles = [
        path.join(__dirname, '..', '.env'),
        path.join(__dirname, '..', 'package.json'),
        path.join(__dirname, '..', 'app.js')
      ];

      for (const file of criticalFiles) {
        const isSecure = await verifySecureFilePermissions(file);
        if (!isSecure) {
          logger.warn(`Permisos inseguros detectados en: ${file}`);
          // Intentar corregir permisos
          await setSecureFilePermissions(file);
        }
      }
    }

    logger.info('Script de mantenimiento completado exitosamente');
    process.exit(0);

  } catch (error) {
    logger.error('Error en script de mantenimiento:', error.message);
    process.exit(1);
  }
}

// Ejecutar script
if (require.main === module) {
  main();
}

module.exports = { main }; 