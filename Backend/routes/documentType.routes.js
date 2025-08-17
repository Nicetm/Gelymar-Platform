const express = require('express');
const router = express.Router();
const documentTypeController = require('../controllers/documentType.controller');
const authMiddleware = require('../middleware/auth.middleware');

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// GET /api/document-types - Obtener todos los tipos de documentos
router.get('/', documentTypeController.getAllDocumentTypes);

// GET /api/document-types/:id - Obtener un tipo de documento por ID
router.get('/:id', documentTypeController.getDocumentTypeById);

// POST /api/document-types - Crear un nuevo tipo de documento
router.post('/', documentTypeController.createDocumentType);

// PUT /api/document-types/:id - Actualizar un tipo de documento
router.put('/:id', documentTypeController.updateDocumentType);

// DELETE /api/document-types/:id - Eliminar un tipo de documento
router.delete('/:id', documentTypeController.deleteDocumentType);

module.exports = router; 