const fs = require('fs');
const path = require('path');
const { logger } = require('./logger');

/**
 * Configuración de permisos de archivos
 */
const FILE_PERMISSIONS = {
  // Permisos para archivos de configuración
  CONFIG: 0o600, // Solo propietario puede leer/escribir
  
  // Permisos para archivos de logs
  LOGS: 0o640, // Propietario puede leer/escribir, grupo puede leer
  
  // Permisos para archivos subidos por usuarios
  UPLOADS: 0o644, // Propietario puede leer/escribir, otros pueden leer
  
  // Permisos para directorios
  DIRECTORIES: 0o755, // Propietario puede todo, otros pueden leer/ejecutar
  
  // Permisos para archivos temporales
  TEMP: 0o600, // Solo propietario
};

/**
 * Verificar y establecer permisos seguros para un archivo
 * @param {string} filePath - Ruta del archivo
 * @param {number} permissions - Permisos a establecer
 * @returns {Promise<boolean>} - True si se establecieron correctamente
 */
async function setSecureFilePermissions(filePath, permissions = FILE_PERMISSIONS.UPLOADS) {
  try {
    if (!fs.existsSync(filePath)) {
      logger.warn(`Archivo no existe para establecer permisos: ${filePath}`);
      return false;
    }

    await fs.promises.chmod(filePath, permissions);
    logger.info(`Permisos establecidos para ${filePath}: ${permissions.toString(8)}`);
    return true;
  } catch (error) {
    logger.error(`Error estableciendo permisos para ${filePath}:`, error.message);
    return false;
  }
}

/**
 * Verificar y establecer permisos seguros para un directorio
 * @param {string} dirPath - Ruta del directorio
 * @returns {Promise<boolean>} - True si se establecieron correctamente
 */
async function setSecureDirectoryPermissions(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) {
      logger.warn(`Directorio no existe para establecer permisos: ${dirPath}`);
      return false;
    }

    await fs.promises.chmod(dirPath, FILE_PERMISSIONS.DIRECTORIES);
    logger.info(`Permisos de directorio establecidos para ${dirPath}`);
    return true;
  } catch (error) {
    logger.error(`Error estableciendo permisos de directorio para ${dirPath}:`, error.message);
    return false;
  }
}

/**
 * Verificar que un archivo tenga permisos seguros
 * @param {string} filePath - Ruta del archivo
 * @param {number} expectedPermissions - Permisos esperados
 * @returns {Promise<boolean>} - True si los permisos son seguros
 */
async function verifySecureFilePermissions(filePath, expectedPermissions = FILE_PERMISSIONS.UPLOADS) {
  try {
    if (!fs.existsSync(filePath)) {
      return false;
    }

    const stats = await fs.promises.stat(filePath);
    const currentPermissions = stats.mode & 0o777;
    
    // Verificar que los permisos no sean más permisivos de lo esperado
    const isSecure = (currentPermissions & expectedPermissions) === expectedPermissions;
    
    if (!isSecure) {
      logger.warn(`Permisos inseguros detectados en ${filePath}: ${currentPermissions.toString(8)} (esperado: ${expectedPermissions.toString(8)})`);
    }
    
    return isSecure;
  } catch (error) {
    logger.error(`Error verificando permisos de ${filePath}:`, error.message);
    return false;
  }
}

/**
 * Crear directorio con permisos seguros
 * @param {string} dirPath - Ruta del directorio
 * @param {boolean} recursive - Crear directorios padres si no existen
 * @returns {Promise<boolean>} - True si se creó correctamente
 */
async function createSecureDirectory(dirPath, recursive = true) {
  try {
    if (!fs.existsSync(dirPath)) {
      await fs.promises.mkdir(dirPath, { recursive, mode: FILE_PERMISSIONS.DIRECTORIES });
      logger.info(`Directorio creado con permisos seguros: ${dirPath}`);
    } else {
      // Verificar permisos del directorio existente
      await setSecureDirectoryPermissions(dirPath);
    }
    return true;
  } catch (error) {
    logger.error(`Error creando directorio seguro ${dirPath}:`, error.message);
    return false;
  }
}

/**
 * Validar ruta de archivo para prevenir path traversal
 * @param {string} filePath - Ruta del archivo
 * @param {string} basePath - Ruta base permitida
 * @returns {boolean} - True si la ruta es segura
 */
function validateFilePath(filePath, basePath) {
  try {
    // Verificar que la ruta no contenga caracteres peligrosos
    if (filePath.includes('..') || filePath.includes('~')) {
      logger.warn(`Ruta potencialmente peligrosa detectada: ${filePath}`);
      return false;
    }
    
    // Si filePath es relativa, construir la ruta completa
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(basePath, filePath);
    const normalizedPath = path.normalize(fullPath);
    const normalizedBase = path.normalize(basePath);
    
    // Verificar que la ruta esté dentro del directorio base
    const relativePath = path.relative(normalizedBase, normalizedPath);
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      logger.warn(`Intento de acceso fuera del directorio base: ${filePath}`);
      return false;
    }
    
    return true;
  } catch (error) {
    logger.error(`Error validando ruta de archivo ${filePath}:`, error.message);
    return false;
  }
}

/**
 * Limpiar archivos temporales con permisos seguros
 * @param {string} tempDir - Directorio de archivos temporales
 * @param {number} maxAge - Edad máxima en milisegundos
 * @returns {Promise<number>} - Número de archivos eliminados
 */
async function cleanupTempFiles(tempDir, maxAge = 24 * 60 * 60 * 1000) { // 24 horas por defecto
  try {
    if (!fs.existsSync(tempDir)) {
      return 0;
    }

    const files = await fs.promises.readdir(tempDir);
    const now = Date.now();
    let deletedCount = 0;

    for (const file of files) {
      const filePath = path.join(tempDir, file);
      const stats = await fs.promises.stat(filePath);
      
      if (now - stats.mtime.getTime() > maxAge) {
        await fs.promises.unlink(filePath);
        deletedCount++;
        logger.info(`Archivo temporal eliminado: ${filePath}`);
      }
    }

    logger.info(`Limpieza completada: ${deletedCount} archivos eliminados`);
    return deletedCount;
  } catch (error) {
    logger.error(`Error en limpieza de archivos temporales:`, error.message);
    return 0;
  }
}

/**
 * Inicializar directorios del sistema con permisos seguros
 * @returns {Promise<void>}
 */
async function initializeSecureDirectories() {
  const directories = [
    { path: path.join(__dirname, '..', 'logs'), permissions: FILE_PERMISSIONS.DIRECTORIES },
    { path: path.join(__dirname, '..', 'uploads'), permissions: FILE_PERMISSIONS.DIRECTORIES },
    { path: path.join(__dirname, '..', 'temp'), permissions: FILE_PERMISSIONS.DIRECTORIES }
  ];

  for (const dir of directories) {
    await createSecureDirectory(dir.path);
  }

  logger.info('Directories del sistema inicializados con permisos seguros');
}

module.exports = {
  FILE_PERMISSIONS,
  setSecureFilePermissions,
  setSecureDirectoryPermissions,
  verifySecureFilePermissions,
  createSecureDirectory,
  validateFilePath,
  cleanupTempFiles,
  initializeSecureDirectories
}; 