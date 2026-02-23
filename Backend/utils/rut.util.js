/**
 * Utilidades para manejo de RUT chileno
 * Consolida lógica duplicada de normalización y validación
 */

/**
 * Normaliza un RUT removiendo el sufijo 'C' si existe
 * @param {string|number} value - RUT a normalizar
 * @returns {string} RUT normalizado
 */
const normalizeRut = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return raw.toLowerCase().endsWith('c') ? raw.slice(0, -1) : raw;
};

/**
 * Valida el formato de un RUT chileno
 * @param {string} rut - RUT a validar
 * @returns {boolean} true si el formato es válido
 */
const validateRutFormat = (rut) => {
  if (!rut) return false;
  const normalized = normalizeRut(rut);
  // Formato: 12345678-9 o 12345678-K
  const rutRegex = /^\d{7,8}-[\dkK]$/;
  return rutRegex.test(normalized);
};

/**
 * Valida el dígito verificador de un RUT chileno
 * @param {string} rut - RUT completo con dígito verificador (ej: 12345678-9)
 * @returns {boolean} true si el dígito verificador es correcto
 */
const validateRutDigit = (rut) => {
  if (!rut) return false;
  
  const normalized = normalizeRut(rut);
  const parts = normalized.split('-');
  
  if (parts.length !== 2) return false;
  
  const number = parts[0];
  const digit = parts[1].toUpperCase();
  
  // Calcular dígito verificador
  let sum = 0;
  let multiplier = 2;
  
  for (let i = number.length - 1; i >= 0; i--) {
    sum += parseInt(number[i]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }
  
  const remainder = sum % 11;
  const calculatedDigit = remainder === 0 ? '0' : remainder === 1 ? 'K' : String(11 - remainder);
  
  return digit === calculatedDigit;
};

/**
 * Formatea un RUT agregando puntos y guión
 * @param {string} rut - RUT sin formato (ej: 123456789)
 * @returns {string} RUT formateado (ej: 12.345.678-9)
 */
const formatRut = (rut) => {
  if (!rut) return '';
  
  const normalized = normalizeRut(rut);
  const cleaned = normalized.replace(/[^\dkK-]/g, '');
  
  if (cleaned.includes('-')) {
    const [number, digit] = cleaned.split('-');
    const formatted = number.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${formatted}-${digit}`;
  }
  
  // Si no tiene guión, asumir que el último carácter es el dígito verificador
  const number = cleaned.slice(0, -1);
  const digit = cleaned.slice(-1);
  const formatted = number.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${formatted}-${digit}`;
};

module.exports = {
  normalizeRut,
  validateRutFormat,
  validateRutDigit,
  formatRut
};
