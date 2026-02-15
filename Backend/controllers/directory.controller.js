// Las variables de entorno ya se cargan automáticamente en app.js
const { container } = require('../config/container');
const { logger } = require('../utils/logger');

/**
 * @route GET /api/directories/:customerId
 * @desc Lista las carpetas del cliente (por RUT)
 * @access Protegido (requiere JWT)
 */
exports.getClientDirectories = async (req, res) => {
  const { customerRut } = req.params;
  if (!customerRut) {
    logger.warn('RUT inválido en getClientDirectories');
    return res.status(400).json({ message: 'RUT inválido' });
  }

  try {
    const customerService = container.resolve('customerService');
    const folderService = container.resolve('folderService');
    logger.info(`[getClientDirectories] start. rut=${customerRut}`);
    const customer = await customerService.getCustomerByRutFromSql(customerRut);
    if (!customer) {
      logger.warn(`Cliente no encontrado con RUT ${customerRut}`);
      return res.status(404).json({ message: 'Cliente no encontrado' });
    }

    const folders = await folderService.getFoldersByCustomerRut(customerRut);
    logger.info(`[getClientDirectories] folders=${folders.length} rut=${customerRut}`);
    res.status(200).json(folders);
  } catch (err) {
    logger.error(`Error al obtener carpetas: ${err.message}`);
    res.status(500).json({ message: 'Error interno al obtener carpetas' });
  }
};


/**
 * @route POST /api/directories/create-sub
 * @desc Crea subcarpeta dentro de una carpeta existente
 * @access Protegido (requiere JWT)
 */
exports.createSubDirectory = async (req, res) => {
  const { folder_id, name, path } = req.body;
  if (!folder_id || !name) {
    logger.warn('Faltan folder_id o name en createSubDirectory');
    return res.status(400).json({ message: 'folder_id y name requeridos' });
  }

  try {
    const folderService = container.resolve('folderService');
    const subfolder = await folderService.createSubfolder({ folder_id, name, path });
    logger.info(`Subcarpeta creada: folder_id ${folder_id}, subcarpeta ${name}`);
    res.status(201).json({ message: 'Subcarpeta creada', subfolder });
  } catch (err) {
    logger.error(`Error al crear subcarpeta: ${err.message}`);
    res.status(500).json({ message: 'Error al crear subcarpeta' });
  }
};

/**
 * @route DELETE /api/directories/delete-sub
 * @desc Elimina una subcarpeta (lógicamente, solo si no tiene archivos en el sistema)
 * @access Protegido (requiere JWT)
 */
exports.deleteSubDirectory = async (req, res) => {
  const { folder_id, name } = req.body;
  if (!folder_id || !name) {
    logger.warn('Faltan folder_id o name en deleteSubDirectory');
    return res.status(400).json({ message: 'folder_id y name requeridos' });
  }

  try {
    const folderService = container.resolve('folderService');
    const deleted = await folderService.deleteSubfolder(folder_id, name);
    if (!deleted) {
      logger.warn(`No se pudo eliminar subcarpeta "${name}" (folder_id: ${folder_id})`);
      return res.status(404).json({ message: 'La subcarpeta no fue encontrada o no pudo eliminarse' });
    }
    logger.info(`Subcarpeta "${name}" eliminada correctamente`);
    res.json({ message: `Subcarpeta "${name}" eliminada exitosamente` });
  } catch (err) {
    logger.error(`Error al eliminar subcarpeta: ${err.message}`);
    res.status(500).json({ message: 'Error al eliminar subcarpeta' });
  }
};

/**
 * @route GET /api/directories/count/:customer_id
 * @desc Retorna el total de carpetas de un cliente
 * @access Protegido (requiere JWT)
 */
exports.getCountDirectoryByCustomerID = async (req, res) => {
  const { customer_id } = req.params;

  if (!customer_id) {
    logger.warn('ID de cliente requerido en getCountDirectoryByCustomerID');
    return res.status(400).json({ message: 'ID de cliente requerido' });
  }

  try {
    const folderService = container.resolve('folderService');
    const count = await folderService.getCountDirectoryByCustomerRut(customer_id);
    logger.info(`Total de carpetas para cliente ${customer_id}: ${count}`);
    res.json({ customer_id, total: count });
  } catch (error) {
    logger.error(`Error al contar carpetas: ${error.message}`);
    res.status(500).json({ message: 'Error al contar carpetas del cliente' });
  }
};
