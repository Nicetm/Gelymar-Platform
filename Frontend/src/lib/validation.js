// src/lib/validation.js - Sistema de validación de formularios

/**
 * Sanitiza y valida entrada de texto
 * @param {string} input - Texto a sanitizar
 * @param {Object} options - Opciones de validación
 * @returns {string} Texto sanitizado
 */
export function sanitizeText(input, options = {}) {
  if (typeof input !== 'string') return '';
  
  const {
    maxLength = 255,
    allowHtml = false,
    trim = true,
    lowercase = false
  } = options;
  
  let sanitized = input;
  
  // Trim si está habilitado
  if (trim) {
    sanitized = sanitized.trim();
  }
  
  // Convertir a minúsculas si está habilitado
  if (lowercase) {
    sanitized = sanitized.toLowerCase();
  }
  
  // Remover HTML si no está permitido
  if (!allowHtml) {
    const div = document.createElement('div');
    div.textContent = sanitized;
    sanitized = div.innerHTML;
  }
  
  // Limitar longitud
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }
  
  return sanitized;
}

/**
 * Valida email
 * @param {string} email - Email a validar
 * @returns {boolean} Es válido
 */
export function validateEmail(email) {
  if (!email || typeof email !== 'string') return false;
  
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email.trim());
}

/**
 * Valida contraseña
 * @param {string} password - Contraseña a validar
 * @param {Object} options - Opciones de validación
 * @returns {Object} Resultado de validación
 */
export function validatePassword(password, options = {}) {
  const {
    minLength = 8,
    requireUppercase = true,
    requireLowercase = true,
    requireNumbers = true,
    requireSpecialChars = true
  } = options;
  
  if (!password || typeof password !== 'string') {
    return { isValid: false, errors: ['La contraseña es requerida'] };
  }
  
  const errors = [];
  
  if (password.length < minLength) {
    errors.push(`La contraseña debe tener al menos ${minLength} caracteres`);
  }
  
  if (requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('La contraseña debe contener al menos una letra mayúscula');
  }
  
  if (requireLowercase && !/[a-z]/.test(password)) {
    errors.push('La contraseña debe contener al menos una letra minúscula');
  }
  
  if (requireNumbers && !/\d/.test(password)) {
    errors.push('La contraseña debe contener al menos un número');
  }
  
  if (requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('La contraseña debe contener al menos un carácter especial');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Valida número
 * @param {string|number} input - Número a validar
 * @param {Object} options - Opciones de validación
 * @returns {boolean} Es válido
 */
export function validateNumber(input, options = {}) {
  const {
    min = -Infinity,
    max = Infinity,
    allowDecimals = true,
    allowNegative = false
  } = options;
  
  const num = parseFloat(input);
  
  if (isNaN(num)) return false;
  
  if (!allowDecimals && !Number.isInteger(num)) return false;
  
  if (!allowNegative && num < 0) return false;
  
  if (num < min || num > max) return false;
  
  return true;
}

/**
 * Valida URL
 * @param {string} url - URL a validar
 * @param {Object} options - Opciones de validación
 * @returns {boolean} Es válido
 */
export function validateUrl(url, options = {}) {
  const { requireProtocol = false, allowedProtocols = ['http:', 'https:'] } = options;
  
  if (!url || typeof url !== 'string') return false;
  
  try {
    const urlObj = new URL(url, requireProtocol ? undefined : 'http://localhost');
    
    if (requireProtocol && !allowedProtocols.includes(urlObj.protocol)) {
      return false;
    }
    
    return true;
  } catch {
    return false;
  }
}

/**
 * Valida archivo
 * @param {File} file - Archivo a validar
 * @param {Object} options - Opciones de validación
 * @returns {Object} Resultado de validación
 */
export function validateFile(file, options = {}) {
  const {
    maxSize = 10 * 1024 * 1024, // 10MB por defecto
    allowedTypes = [],
    allowedExtensions = []
  } = options;
  
  if (!file || !(file instanceof File)) {
    return { isValid: false, errors: ['Archivo requerido'] };
  }
  
  const errors = [];
  
  // Validar tamaño
  if (file.size > maxSize) {
    const maxSizeMB = Math.round(maxSize / (1024 * 1024));
    errors.push(`El archivo no puede ser mayor a ${maxSizeMB}MB`);
  }
  
  // Validar tipo MIME
  if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
    errors.push(`Tipo de archivo no permitido. Tipos permitidos: ${allowedTypes.join(', ')}`);
  }
  
  // Validar extensión
  if (allowedExtensions.length > 0) {
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!extension || !allowedExtensions.includes(extension)) {
      errors.push(`Extensión no permitida. Extensiones permitidas: ${allowedExtensions.join(', ')}`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Valida formulario completo
 * @param {HTMLFormElement} form - Formulario a validar
 * @param {Object} rules - Reglas de validación
 * @returns {Object} Resultado de validación
 */
export function validateForm(form, rules) {
  const errors = {};
  const data = {};
  
  for (const [fieldName, fieldRules] of Object.entries(rules)) {
    const field = form.elements[fieldName];
    if (!field) continue;
    
    const value = field.type === 'file' ? field.files[0] : field.value;
    data[fieldName] = value;
    
    // Validar campo requerido
    if (fieldRules.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
      errors[fieldName] = fieldRules.requiredMessage || 'Este campo es requerido';
      continue;
    }
    
    // Si no es requerido y está vacío, continuar
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      continue;
    }
    
    // Validar tipo de campo
    if (fieldRules.type === 'email' && !validateEmail(value)) {
      errors[fieldName] = fieldRules.message || 'Email inválido';
    } else if (fieldRules.type === 'password') {
      const passwordValidation = validatePassword(value, fieldRules.passwordOptions);
      if (!passwordValidation.isValid) {
        errors[fieldName] = passwordValidation.errors[0];
      }
    } else if (fieldRules.type === 'number') {
      if (!validateNumber(value, fieldRules.numberOptions)) {
        errors[fieldName] = fieldRules.message || 'Número inválido';
      }
    } else if (fieldRules.type === 'url') {
      if (!validateUrl(value, fieldRules.urlOptions)) {
        errors[fieldName] = fieldRules.message || 'URL inválida';
      }
    } else if (fieldRules.type === 'file') {
      const fileValidation = validateFile(value, fieldRules.fileOptions);
      if (!fileValidation.isValid) {
        errors[fieldName] = fileValidation.errors[0];
      }
    }
    
    // Validar longitud
    if (fieldRules.minLength && value.length < fieldRules.minLength) {
      errors[fieldName] = fieldRules.minLengthMessage || `Mínimo ${fieldRules.minLength} caracteres`;
    }
    
    if (fieldRules.maxLength && value.length > fieldRules.maxLength) {
      errors[fieldName] = fieldRules.maxLengthMessage || `Máximo ${fieldRules.maxLength} caracteres`;
    }
    
    // Validar patrón
    if (fieldRules.pattern && !fieldRules.pattern.test(value)) {
      errors[fieldName] = fieldRules.patternMessage || 'Formato inválido';
    }
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    data
  };
}

/**
 * Muestra errores de validación en el formulario
 * @param {HTMLFormElement} form - Formulario
 * @param {Object} errors - Errores de validación
 */
export function showFormErrors(form, errors) {
  // Limpiar errores anteriores
  form.querySelectorAll('.error-message').forEach(el => el.remove());
  form.querySelectorAll('.error-field').forEach(el => {
    el.classList.remove('error-field');
  });
  
  // Mostrar nuevos errores
  for (const [fieldName, errorMessage] of Object.entries(errors)) {
    const field = form.elements[fieldName];
    if (!field) continue;
    
    // Marcar campo como error
    field.classList.add('error-field');
    
    // Crear mensaje de error
    const errorElement = document.createElement('div');
    errorElement.className = 'error-message text-red-500 text-sm mt-1';
    errorElement.textContent = errorMessage;
    
    // Insertar después del campo
    field.parentNode.insertBefore(errorElement, field.nextSibling);
  }
}

/**
 * Limpia errores de validación del formulario
 * @param {HTMLFormElement} form - Formulario
 */
export function clearFormErrors(form) {
  form.querySelectorAll('.error-message').forEach(el => el.remove());
  form.querySelectorAll('.error-field').forEach(el => {
    el.classList.remove('error-field');
  });
} 