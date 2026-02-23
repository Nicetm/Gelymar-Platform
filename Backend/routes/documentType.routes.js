const express = require('express');
const router = express.Router();
const documentTypeController = require('../controllers/documentType.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { authorizeRoles } = require('../middleware/role.middleware');

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// GET /api/document-types - Obtener todos los tipos de documentos
router.get('/', authorizeRoles(['admin', 'seller']), documentTypeController.getAllDocumentTypes);

// GET /api/document-types/:id - Obtener un tipo de documento por ID
router.get('/:id', authorizeRoles(['admin', 'seller']), documentTypeController.getDocumentTypeById);

// POST /api/document-types - Crear un nuevo tipo de documento
router.post('/', authorizeRoles(['admin']), documentTypeController.createDocumentType);

// PUT /api/document-types/:id - Actualizar un tipo de documento
router.put('/:id', authorizeRoles(['admin']), documentTypeController.updateDocumentType);

// DELETE /api/document-types/:id - Eliminar un tipo de documento
router.delete('/:id', authorizeRoles(['admin']), documentTypeController.deleteDocumentType);

module.exports = router; 
