const DocumentType = require('../models/documentType.model');
const logger = require('../utils/logger');

/**
 * @route GET /api/document-types
 * @desc Obtiene todos los tipos de documentos activos
 * @access Protegido (requiere JWT)
 */
exports.getAllDocumentTypes = async (req, res) => {
  try {
    const documentTypes = await DocumentType.getAll();
    logger.info(`Se obtuvieron ${documentTypes.length} tipos de documentos`);
    res.json(documentTypes);
  } catch (err) {
    logger.error(`Error al obtener tipos de documentos: ${err.message}`);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

/**
 * @route GET /api/document-types/:id
 * @desc Obtiene un tipo de documento por ID
 * @access Protegido (requiere JWT)
 */
exports.getDocumentTypeById = async (req, res) => {
  const { id } = req.params;

  try {
    const documentType = await DocumentType.getById(id);
    if (!documentType) {
      return res.status(404).json({ message: 'Tipo de documento no encontrado' });
    }
    res.json(documentType);
  } catch (err) {
    logger.error(`Error al obtener tipo de documento: ${err.message}`);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

/**
 * @route POST /api/document-types
 * @desc Crea un nuevo tipo de documento
 * @access Protegido (requiere JWT)
 */
exports.createDocumentType = async (req, res) => {
  const { name, description } = req.body;

  if (!name) {
    return res.status(400).json({ message: 'El nombre es obligatorio' });
  }

  try {
    const id = await DocumentType.create({ name, description });
    const documentType = await DocumentType.getById(id);
    
    logger.info(`Tipo de documento creado: ${name}`);
    res.status(201).json(documentType);
  } catch (err) {
    logger.error(`Error al crear tipo de documento: ${err.message}`);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

/**
 * @route PUT /api/document-types/:id
 * @desc Actualiza un tipo de documento
 * @access Protegido (requiere JWT)
 */
exports.updateDocumentType = async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;

  if (!name) {
    return res.status(400).json({ message: 'El nombre es obligatorio' });
  }

  try {
    const success = await DocumentType.update(id, { name, description });
    if (!success) {
      return res.status(404).json({ message: 'Tipo de documento no encontrado' });
    }

    const documentType = await DocumentType.getById(id);
    logger.info(`Tipo de documento actualizado: ${name}`);
    res.json(documentType);
  } catch (err) {
    logger.error(`Error al actualizar tipo de documento: ${err.message}`);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

/**
 * @route DELETE /api/document-types/:id
 * @desc Elimina un tipo de documento (soft delete)
 * @access Protegido (requiere JWT)
 */
exports.deleteDocumentType = async (req, res) => {
  const { id } = req.params;

  try {
    const success = await DocumentType.delete(id);
    if (!success) {
      return res.status(404).json({ message: 'Tipo de documento no encontrado' });
    }

    logger.info(`Tipo de documento eliminado ID: ${id}`);
    res.json({ message: 'Tipo de documento eliminado correctamente' });
  } catch (err) {
    logger.error(`Error al eliminar tipo de documento: ${err.message}`);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
}; 