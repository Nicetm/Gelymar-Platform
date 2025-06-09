require('dotenv').config();
const fs = require('fs');
const path = require('path');
const customerService = require('../services/customer.service');
const folderService = require('../services/folder.service');
const FILE_SERVER_ROOT = process.env.FILE_SERVER_ROOT

/**
 * Lista las carpetas del cliente (por UUID)
 * Ruta: GET /api/directories/:customerId
 */
exports.getClientDirectories = async (req, res) => {
  const { customerUuid } = req.params;
  if (!customerUuid) {
    return res.status(400).json({ message: 'UUID inválido' });
  }

  try {
    // 1. Buscar el ID interno del cliente por UUID
    const customer = await customerService.getCustomerByUUID(customerUuid);
    if (!customer) {
      return res.status(404).json({ message: 'Cliente no encontrado' });
    }

    // 2. Consultar folders por customer_id
    const folders = await folderService.getFoldersByCustomer(customer.id);
    res.status(200).json(folders);
  } catch (err) {
    console.error('Error al obtener carpetas:', err);
    res.status(500).json({ message: 'Error interno al obtener carpetas' });
  }
};

/**
 * Crea una carpeta para un cliente
 * Ruta: POST /api/directories/create-client
 * Body: { customer_id, name, path }
 */
exports.createDirectory = async (req, res) => {
  const { customer_id, name, path: folderPath } = req.body;

  if (!customer_id || !name || !folderPath) {
    return res.status(400).json({ message: 'Faltan datos requeridos' });
  }

  const isPCFolder = /^PC\d+$/i.test(name);

  try {
    if (isPCFolder) {
      const exists = await folderService.existsGlobalPCFolder(name);
      if (exists) {
        return res.status(400).json({
          message: `La carpeta con nombre "${name}" ya existe para otro cliente. Los códigos PC deben ser únicos.`,
        });
      }
    } else {
      const exists = await folderService.existsCustomerFolder(customer_id, name);
      if (exists) {
        return res.status(400).json({
          message: `La carpeta "${name}" ya existe para este cliente.`,
        });
      }
    }

    // Intenta crear la carpeta físicamente
    const fullPhysicalPath = path.join(FILE_SERVER_ROOT, folderPath);
    fs.mkdirSync(fullPhysicalPath, { recursive: true });

    // Luego guarda en la base de datos
    const folder = await folderService.createFolder({ customer_id, name, path: folderPath });

    res.status(201).json({ message: 'Carpeta creada', folder });

  } catch (error) {
    console.error('Error al crear carpeta:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Error al crear carpeta' });
    }
  }
};

/**
 * Crea subcarpeta dentro de una carpeta existente
 * Ruta: POST /api/directories/create-sub
 * Body: { folder_id, name, path }
 */
exports.createSubDirectory = async (req, res) => {
  const { folder_id, name, path } = req.body;
  if (!folder_id || !name) {
    return res.status(400).json({ message: 'folder_id y name requeridos' });
  }

  try {
    const subfolder = await folderService.createSubfolder({ folder_id, name, path });
    res.status(201).json({ message: 'Subcarpeta creada', subfolder });
  } catch (err) {
    console.error('Error al crear subcarpeta:', err);
    res.status(500).json({ message: 'Error al crear subcarpeta' });
  }
};

/**
 * Elimina una subcarpeta (lógicamente, solo si no tiene archivos en el sistema)
 * Ruta: DELETE /api/directories/delete-sub
 * Body: { folder_id, name }
 */
exports.deleteSubDirectory = async (req, res) => {
  const { folder_id, name } = req.body;
  if (!folder_id || !name) {
    return res.status(400).json({ message: 'folder_id y name requeridos' });
  }

  try {
    const deleted = await folderService.deleteSubfolder(folder_id, name);
    if (!deleted) {
      return res.status(404).json({ message: 'La subcarpeta no fue encontrada o no pudo eliminarse' });
    }
    res.json({ message: `Subcarpeta "${name}" eliminada exitosamente` });
  } catch (err) {
    console.error('Error al eliminar subcarpeta:', err);
    res.status(500).json({ message: 'Error al eliminar subcarpeta' });
  }
};

exports.getCountDirectoryByCustomerID = async (req, res) => {
  const { customer_id } = req.params;

  if (!customer_id) {
    return res.status(400).json({ message: 'ID de cliente requerido' });
  }

  try {
    const count = await folderService.getCountDirectoryByCustomerID(customer_id);
    res.json({ customer_id, total: count });
  } catch (error) {
    console.error('Error al contar carpetas:', error);
    res.status(500).json({ message: 'Error al contar carpetas del cliente' });
  }
};

