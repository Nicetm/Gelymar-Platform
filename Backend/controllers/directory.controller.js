// Las variables de entorno ya se cargan automáticamente en app.js
const { container } = require('../config/container');
const { logger } = require('../utils/logger');
const { normalizeRut } = require('../utils/rut.util');
const { t } = require('../i18n');

/**
 * @route GET /api/directories/:customerId
 * @desc Lista las carpetas del cliente (por RUT)
 * @access Protegido (requiere JWT)
 */
exports.getClientDirectories = async (req, res) => {
  const { customerRut } = req.params;
  if (!customerRut) {
    logger.warn('RUT inválido en getClientDirectories');
    return res.status(400).json({ message: t('directory.invalid_rut', req.lang || 'es') });
  }

  try {
    const customerService = container.resolve('customerService');
    const folderService = container.resolve('folderService');
    const user = req.user || {};
    const normalizeRutKey = normalizeRut;
    const userRole = String(user.role || '').toLowerCase();
    if (userRole === 'seller' || user.role_id === 3) {
      const allowed = await customerService.sellerHasAccessToCustomerRut(user.rut, customerRut);
      if (!allowed) {
        logger.warn(`[getClientDirectories] acceso denegado role=${userRole || 'seller'} user=${user.rut || 'N/A'} rut=${customerRut} path=${req.originalUrl || req.path}`);
        return res.status(403).json({ message: t('directory.access_denied', req.lang || 'es') });
      }
    } else if (userRole === 'client' || user.role_id === 2) {
      if (normalizeRutKey(user.rut) !== normalizeRutKey(customerRut)) {
        logger.warn(`[getClientDirectories] acceso denegado role=${userRole || 'client'} user=${user.rut || 'N/A'} rut=${customerRut} path=${req.originalUrl || req.path}`);
        return res.status(403).json({ message: t('directory.access_denied', req.lang || 'es') });
      }
    }
    logger.info(`[getClientDirectories] start. rut=${customerRut}`);
    const customer = await customerService.getCustomerByRutFromSql(customerRut);
    if (!customer) {
      logger.warn(`Cliente no encontrado con RUT ${customerRut}`);
      return res.status(404).json({ message: t('directory.customer_not_found', req.lang || 'es') });
    }

    const folders = await folderService.getFoldersByCustomerRut(customerRut);
    logger.info(`[getClientDirectories] folders=${folders.length} rut=${customerRut}`);
    res.status(200).json(folders);
  } catch (err) {
    logger.error(`Error al obtener carpetas: ${err.message}`);
    res.status(500).json({ message: t('directory.get_folders_error', req.lang || 'es') });
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
    return res.status(400).json({ message: t('directory.folder_name_required', req.lang || 'es') });
  }

  try {
    const folderService = container.resolve('folderService');
    const subfolder = await folderService.createSubfolder({ folder_id, name, path });
    logger.info(`Subcarpeta creada: folder_id ${folder_id}, subcarpeta ${name}`);
    res.status(201).json({ message: t('directory.subfolder_created', req.lang || 'es'), subfolder });
  } catch (err) {
    logger.error(`Error al crear subcarpeta: ${err.message}`);
    res.status(500).json({ message: t('directory.create_subfolder_error', req.lang || 'es') });
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
    return res.status(400).json({ message: t('directory.folder_name_required', req.lang || 'es') });
  }

  try {
    const folderService = container.resolve('folderService');
    const deleted = await folderService.deleteSubfolder(folder_id, name);
    if (!deleted) {
      logger.warn(`No se pudo eliminar subcarpeta "${name}" (folder_id: ${folder_id})`);
      return res.status(404).json({ message: t('directory.subfolder_not_found', req.lang || 'es') });
    }
    logger.info(`Subcarpeta "${name}" eliminada correctamente`);
    res.json({ message: t('directory.subfolder_deleted', req.lang || 'es') });
  } catch (err) {
    logger.error(`Error al eliminar subcarpeta: ${err.message}`);
    res.status(500).json({ message: t('directory.delete_subfolder_error', req.lang || 'es') });
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
    return res.status(400).json({ message: t('directory.customer_id_required', req.lang || 'es') });
  }

  try {
    const customerService = container.resolve('customerService');
    const user = req.user || {};
    const normalizeRutKey = normalizeRut;
    const userRole = String(user.role || '').toLowerCase();
    if (userRole === 'seller' || user.role_id === 3) {
      const allowed = await customerService.sellerHasAccessToCustomerRut(user.rut, customer_id);
      if (!allowed) {
        logger.warn(`[getCountDirectoryByCustomerID] acceso denegado role=${userRole || 'seller'} user=${user.rut || 'N/A'} rut=${customer_id} path=${req.originalUrl || req.path}`);
        return res.status(403).json({ message: t('directory.access_denied', req.lang || 'es') });
      }
    } else if (userRole === 'client' || user.role_id === 2) {
      if (normalizeRutKey(user.rut) !== normalizeRutKey(customer_id)) {
        logger.warn(`[getCountDirectoryByCustomerID] acceso denegado role=${userRole || 'client'} user=${user.rut || 'N/A'} rut=${customer_id} path=${req.originalUrl || req.path}`);
        return res.status(403).json({ message: t('directory.access_denied', req.lang || 'es') });
      }
    }
    const folderService = container.resolve('folderService');
    const count = await folderService.getCountDirectoryByCustomerRut(customer_id);
    logger.info(`Total de carpetas para cliente ${customer_id}: ${count}`);
    res.json({ customer_id, total: count });
  } catch (error) {
    logger.error(`Error al contar carpetas: ${error.message}`);
    res.status(500).json({ message: t('directory.count_folders_error', req.lang || 'es') });
  }
};
