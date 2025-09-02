const { body, param, query, validationResult } = require('express-validator');
const { logger } = require('../utils/logger');

/**
 * Middleware para manejar errores de validación
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn(`Errores de validación en ${req.method} ${req.path}:`, errors.array());
    return res.status(400).json({
      message: 'Datos de entrada inválidos',
      errors: errors.array().map(error => ({
        field: error.path,
        message: error.msg,
        value: error.value
      }))
    });
  }
  next();
};

/**
 * Validaciones para autenticación
 */
const authValidations = {
  login: [
    body('email').optional().isEmail().withMessage('Email inválido'),
    body('username').optional().isLength({ min: 3 }).withMessage('Username debe tener al menos 3 caracteres'),
    body('password').isLength({ min: 5 }).withMessage('Contraseña debe tener al menos 5 caracteres'),
    handleValidationErrors
  ],
  
  changePassword: [
    body('currentPassword').isLength({ min: 5 }).withMessage('Contraseña actual debe tener al menos 5 caracteres'),
    body('newPassword').isLength({ min: 5 }).withMessage('Nueva contraseña debe tener al menos 5 caracteres'),
    handleValidationErrors
  ],
  
  recoverPassword: [
    body('email').isEmail().withMessage('Email inválido'),
    handleValidationErrors
  ],
  
  resetPassword: [
    body('token').notEmpty().withMessage('Token requerido'),
    body('newPassword').isLength({ min: 5 }).withMessage('Nueva contraseña debe tener al menos 5 caracteres'),
    handleValidationErrors
  ]
};

/**
 * Validaciones para usuarios
 */
const userValidations = {
  updateProfile: [
    body('full_name').isLength({ min: 2, max: 100 }).withMessage('Nombre debe tener entre 2 y 100 caracteres'),
    body('phone').isLength({ min: 8, max: 20 }).withMessage('Teléfono debe tener entre 8 y 20 caracteres'),
    body('country').optional().isLength({ max: 50 }).withMessage('País debe tener máximo 50 caracteres'),
    body('city').optional().isLength({ max: 50 }).withMessage('Ciudad debe tener máximo 50 caracteres'),
    handleValidationErrors
  ],
  
  uploadAvatar: [
    body('avatar').custom((value, { req }) => {
      if (!req.file) {
        throw new Error('Archivo de avatar requerido');
      }
      
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
      if (!allowedTypes.includes(req.file.mimetype)) {
        throw new Error('Tipo de archivo no permitido. Solo JPG, PNG y GIF');
      }
      
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (req.file.size > maxSize) {
        throw new Error('Archivo demasiado grande. Máximo 5MB');
      }
      
      return true;
    }),
    handleValidationErrors
  ]
};

/**
 * Validaciones para órdenes
 */
const orderValidations = {
  search: [
    body('customerUUID').optional().isUUID().withMessage('UUID de cliente inválido'),
    body('orderName').optional().isLength({ max: 100 }).withMessage('Nombre de orden muy largo'),
    body('status').optional().isIn(['pending', 'processing', 'completed', 'cancelled']).withMessage('Estado inválido'),
    body('startDate').optional().isISO8601().withMessage('Fecha de inicio inválida'),
    body('endDate').optional().isISO8601().withMessage('Fecha de fin inválida'),
    handleValidationErrors
  ],
  
  getById: [
    param('id').isInt({ min: 1 }).withMessage('ID de orden inválido'),
    handleValidationErrors
  ]
};

/**
 * Validaciones para archivos
 */
const fileValidations = {
  upload: [
    body('customer_id').isInt({ min: 1 }).withMessage('ID de cliente inválido'),
    body('folder_id').isInt({ min: 1 }).withMessage('ID de carpeta inválido'),
    body('client_name').isLength({ min: 2, max: 100 }).withMessage('Nombre de cliente inválido'),
    body('subfolder').isLength({ min: 1, max: 100 }).withMessage('Nombre de subcarpeta inválido'),
    body('name').isLength({ min: 1, max: 100 }).withMessage('Nombre de archivo inválido'),
    body('is_visible_to_customer').isBoolean().withMessage('Visibilidad debe ser true o false'),
    body('file').custom((value, { req }) => {
      if (!req.file) {
        throw new Error('Archivo requerido');
      }
      
      const allowedTypes = ['.pdf'];
      const fileExt = req.file.originalname.toLowerCase().substring(req.file.originalname.lastIndexOf('.'));
      if (!allowedTypes.includes(fileExt)) {
        throw new Error('Solo se permiten archivos PDF');
      }
      
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (req.file.size > maxSize) {
        throw new Error('Archivo demasiado grande. Máximo 10MB');
      }
      
      return true;
    }),
    handleValidationErrors
  ],
  
  getById: [
    param('id').isInt({ min: 1 }).withMessage('ID de archivo inválido'),
    handleValidationErrors
  ],
  
  rename: [
    param('id').isInt({ min: 1 }).withMessage('ID de archivo inválido'),
    body('name').isLength({ min: 1, max: 100 }).withMessage('Nombre de archivo inválido'),
    body('visible').isBoolean().withMessage('Visibilidad debe ser true o false'),
    handleValidationErrors
  ]
};

/**
 * Validaciones para clientes
 */
const customerValidations = {
  getById: [
    param('id').isInt({ min: 1 }).withMessage('ID de cliente inválido'),
    handleValidationErrors
  ],
  
  getByUUID: [
    param('uuid').isUUID().withMessage('UUID de cliente inválido'),
    handleValidationErrors
  ],
  
  update: [
    param('uuid').isUUID().withMessage('UUID de cliente inválido'),
    body('name').optional().isLength({ min: 2, max: 100 }).withMessage('Nombre inválido'),
    body('email').optional().isEmail().withMessage('Email inválido'),
    body('phone').optional().isLength({ min: 8, max: 20 }).withMessage('Teléfono inválido'),
    handleValidationErrors
  ],
  
  createContacts: [
    body('customer_id').isInt({ min: 1 }).withMessage('ID de cliente inválido'),
    body('contacts').isArray({ min: 1 }).withMessage('Debe enviar al menos un contacto'),
    body('contacts.*.name').isLength({ min: 2, max: 100 }).withMessage('Nombre de contacto inválido'),
    body('contacts.*.email').isEmail().withMessage('Email de contacto inválido'),
    body('contacts.*.phone').optional().isLength({ min: 8, max: 20 }).withMessage('Teléfono de contacto inválido'),
    handleValidationErrors
  ]
};

/**
 * Validaciones para items
 */
const itemValidations = {
  getByOrder: [
    param('orderId').isInt({ min: 1 }).withMessage('ID de orden inválido'),
    handleValidationErrors
  ]
};

/**
 * Validaciones para consultas
 */
const queryValidations = {
  pagination: [
    query('page').optional().isInt({ min: 1 }).withMessage('Página debe ser un número positivo'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Límite debe estar entre 1 y 100'),
    handleValidationErrors
  ],
  
  dateRange: [
    query('startDate').optional().isISO8601().withMessage('Fecha de inicio inválida'),
    query('endDate').optional().isISO8601().withMessage('Fecha de fin inválida'),
    handleValidationErrors
  ]
};

module.exports = {
  handleValidationErrors,
  authValidations,
  userValidations,
  orderValidations,
  fileValidations,
  customerValidations,
  itemValidations,
  queryValidations
}; 