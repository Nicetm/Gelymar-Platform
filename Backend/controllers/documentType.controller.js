const DocumentType = require('../models/documentType.model');
const { logger } = require('../utils/logger');
const { t } = require('../i18n');

/**
 * @route GET /api/document-types
 * @desc Obtiene todos los tipos de documentos activos
 * @access Protegido (requiere JWT)
 */
exports.getAllDocumentTypes = async (req, res) => {
  try {
    const documentTypes = await DocumentType.getAll();
    res.json(documentTypes);
  } catch (err) {
    logger.error(`Error al obtener tipos de documentos: ${err.message}`);
    res.status(500).json({ message: t('documentType.get_types_error', req.lang || 'es') });
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
      return res.status(404).json({ message: t('documentType.type_not_found', req.lang || 'es') });
    }
    res.json(documentType);
  } catch (err) {
    logger.error(`Error al obtener tipo de documento: ${err.message}`);
    res.status(500).json({ message: t('documentType.get_type_error', req.lang || 'es') });
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
    return res.status(400).json({ message: t('documentType.name_required', req.lang || 'es') });
  }

  try {
    const id = await DocumentType.create({ name, description });
    const documentType = await DocumentType.getById(id);
    
    logger.info(`Tipo de documento creado: ${name}`);
    res.status(201).json(documentType);
  } catch (err) {
    logger.error(`Error al crear tipo de documento: ${err.message}`);
    res.status(500).json({ message: t('documentType.create_type_error', req.lang || 'es') });
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
    return res.status(400).json({ message: t('documentType.name_required', req.lang || 'es') });
  }

  try {
    const success = await DocumentType.update(id, { name, description });
    if (!success) {
      return res.status(404).json({ message: t('documentType.type_not_found', req.lang || 'es') });
    }

    const documentType = await DocumentType.getById(id);
    logger.info(`Tipo de documento actualizado: ${name}`);
    res.json(documentType);
  } catch (err) {
    logger.error(`Error al actualizar tipo de documento: ${err.message}`);
    res.status(500).json({ message: t('documentType.update_type_error', req.lang || 'es') });
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
      return res.status(404).json({ message: t('documentType.type_not_found', req.lang || 'es') });
    }

    logger.info(`Tipo de documento eliminado ID: ${id}`);
    res.json({ message: t('documentType.type_deleted', req.lang || 'es') });
  } catch (err) {
    logger.error(`Error al eliminar tipo de documento: ${err.message}`);
    res.status(500).json({ message: t('documentType.delete_type_error', req.lang || 'es') });
  }
}; 