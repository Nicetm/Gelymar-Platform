/**
 * Utilidades para limpiar nombres de directorios
 * Reemplaza caracteres problemáticos para sistemas de archivos
 */

/**
 * Limpia un nombre de directorio reemplazando caracteres problemáticos
 * @param {string} name - Nombre original del directorio
 * @returns {string} - Nombre limpio para usar como directorio
 */
function cleanDirectoryName(name) {
  if (!name || typeof name !== 'string') {
    return 'unnamed_directory';
  }

  return name
    // Reemplazar puntos por espacios (para casos como "A.F.E" -> "A F E")
    .replace(/\./g, ' ')
    // Reemplazar comas por espacios
    .replace(/,/g, ' ')
    // Reemplazar múltiples espacios por un solo espacio
    .replace(/\s+/g, ' ')
    // Reemplazar espacios por guiones bajos
    .replace(/\s/g, '_')
    // Remover caracteres especiales problemáticos para sistemas de archivos
    .replace(/[<>:"/\\|?*]/g, '')
    // Remover caracteres de control
    .replace(/[\x00-\x1f\x7f]/g, '')
    // Remover espacios al inicio y final
    .trim()
    // Si queda vacío, usar nombre por defecto
    .replace(/^$/, 'unnamed_directory');
}

/**
 * Ejemplos de transformación:
 * "A.F.E Distribution, LTDA." -> "A_F_E_Distribution_LTDA"
 * "Anaiah Healthcare, Ltd." -> "Anaiah_Healthcare_Ltd"
 * "AL WAFI FOOD PRODUCTS FACTORY LLC" -> "AL_WAFI_FOOD_PRODUCTS_FACTORY_LLC"
 */

module.exports = {
  cleanDirectoryName
}; 