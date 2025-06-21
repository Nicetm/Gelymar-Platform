const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { insertFile, getFiles, RenameFile } = require('../services/file.service');
const { poolPromise } = require('../config/db');
const { generateRO, generateInvoice, generateBL } = require('../pdf-generator/generator');
const fileService = require('../services/file.service');
const emailService = require('../services/email.service');
const PDFDocument = require('pdfkit');
const logger = require('../utils/logger');

const UPLOADS_ROOT = path.join(__dirname, '../uploads');

/**
 * Configuración de almacenamiento para Multer
 * Define el destino físico de los archivos en base al cliente y subcarpeta
 */
const storage = multer.diskStorage({
  destination: async function (req, file, cb) {
    const { client_name, subfolder } = req.body;
    if (!client_name || !subfolder) return cb(new Error('Faltan parámetros'), null);

    const dirPath = path.join(process.env.FILE_SERVER_ROOT, client_name, subfolder);
    fs.mkdirSync(dirPath, { recursive: true });
    cb(null, dirPath);
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  }
});

/**
 * Filtro de archivos aceptados por extensión
 */
const fileFilter = (req, file, cb) => {
  const allowed = ['.pdf'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) cb(null, true);
  else cb(new Error('Tipo de archivo no permitido'), false);
};

// Middleware de subida de archivos
const upload = multer({ storage, fileFilter });

// Middleware listo para una sola subida bajo el campo 'file'
exports.uploadFile = upload.single('file');

/**
 * @route POST /api/files/upload
 * @desc Procesa la carga física del archivo y registra su metadata en la base de datos
 * @access Protegido (requiere JWT)
 */
exports.handleUpload = async (req, res) => {
  try {
    const {
      customer_id, folder_id, client_name, subfolder, name, is_visible_to_customer
    } = req.body;
    const file = req.file;

    if (!file || !customer_id || !folder_id || !client_name || !subfolder) {
      logger.warn('Faltan parámetros obligatorios en handleUpload');
      return res.status(400).json({ message: 'Faltan parámetros obligatorios' });
    }

    const filePath = path.join(client_name, subfolder, file.originalname);

    const fileData = {
      customer_id,
      folder_id,
      name: name,
      path: filePath,
      status_id: 2,
      is_visible_to_customer: is_visible_to_customer,
    };

    await insertFile(fileData);
    
    logger.info(`Archivo subido y registrado correctamente: ${file.originalname}`);
    res.status(201).json({ message: 'Archivo subido y registrado con éxito' });
  } catch (err) {
    logger.error(`Error al subir archivo: ${err.message}`);
    res.status(500).json({ message: 'Error interno del servidor', error: err.message });
  }
};

/**
 * @route GET /api/files/:customerUuid?f=folderId
 * @desc Obtiene todos los archivos de una carpeta específica de un cliente dado su UUID
 * @access Protegido (requiere JWT)
 */
exports.getFilesByCustomerAndFolder = async (req, res) => {
  const { customerUuid } = req.params;
  const folderId = req.query.f;

  try {
    const pool = await poolPromise;
    const [[customer]] = await pool.query(`SELECT id FROM customers WHERE uuid = ?`, [customerUuid]);

    if (!customer) {
      logger.warn(`Cliente no encontrado UUID: ${customerUuid}`);
      return res.status(404).json({ message: 'Cliente no encontrado' });
    }

    const files = await getFiles(customer.id, folderId);
    logger.info(`Se obtuvieron ${files.length} archivos para cliente ID ${customer.id}`);
    res.json(files);
  } catch (err) {
    logger.error(`Error al obtener archivos: ${err.message}`);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

/**
 * @route PUT /api/files/rename/:id
 * @desc Modifica el nombre de un archivo existente
 * @access Protegido (requiere JWT)
 */
exports.RenameFile = async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;

  if (!name || !id) return res.status(400).json({ message: 'Faltan datos' });

  try {
    const result = await RenameFile(id, name);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Archivo no encontrado' });
    res.json({ success: true, name });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error en la BD' });
  }
};

/**
 * @route POST /api/files/generate/:id
 * @desc Genera el archivo PDF para el registro de archivo solicitado
 * @access Protegido (requiere JWT)
 */
exports.generateFile = async (req, res) => {
  const { id } = req.params;

  try {
    const file = await fileService.getFileById(id);
    if (!file) {
      logger.warn(`Archivo no encontrado ID: ${id}`);
      return res.status(404).json({ message: 'Archivo no encontrado' });
    }

    const FILE_SERVER_ROOT = process.env.FILE_SERVER_ROOT;
    const customerFolder = path.join(FILE_SERVER_ROOT, file.customer_name, file.folder_name);
    
    if (!fs.existsSync(customerFolder)) {
      fs.mkdirSync(customerFolder, { recursive: true });
    }

    const fileName = `${file.name}.pdf`;
    const filePath = path.join(customerFolder, fileName);

    await generateRO(filePath, {
      title: 'Reception Order Advice',
      subtitle: 'Este es el ROA generado',
      customerName: file.customer_name,
      orderNumber: file.order_number,
      items: [ 
        { product: 'Producto A', quantity: 10, price: 1000 },
        { product: 'Producto B', quantity: 5, price: 500 }
      ],
      signName: 'Juan Pérez',
      signRole: 'Logistics Manager'
    });

    const updateData = {
      id: file.id,
      status_id: 2,
      updated_at: new Date(),
      path: path.relative(FILE_SERVER_ROOT, filePath)
    };

    await fileService.updateFile(updateData);

    logger.info(`Archivo generado exitosamente: ${fileName}`);
    return res.json({ message: 'Archivo generado exitosamente', path: updateData.path });

  } catch (error) {
    logger.error(`Error al generar archivo: ${error.message}`);
    return res.status(500).json({ message: 'Error al generar el archivo' });
  }
};

/**
 * @route POST /api/files/send/:id
 * @desc Envía el archivo por correo al cliente
 * @access Protegido (requiere JWT)
 */
exports.sendFile = async (req, res) => {
  const { id } = req.params;

  try {
    const file = await fileService.getFileById(id);
    if (!file) {
      logger.warn(`Archivo no encontrado para enviar: ${id}`);
      return res.status(404).json({ message: 'Archivo no encontrado' });
    }

    await emailService.sendFileToClient(file);

    await fileService.updateFile({
      id: id,
      status_id: 3,
      updated_at: new Date(),
      path: file.path 
    });

    logger.info(`Archivo enviado correctamente: ${file.name}`);
    res.json({ message: 'Documento enviado correctamente' });
  } catch (err) {
    logger.error(`Error al enviar archivo: ${err.message}`);
    res.status(500).json({ message: 'Error al enviar documento' });
  }
};

/**
 * @route DELETE /api/files/delete
 * @desc Elimina un archivo del sistema de archivos y su registro en la base de datos
 * @access Protegido (requiere JWT)
 */
exports.deleteFile = async (req, res) => {
  const { customer_id, folder_id, filename } = req.body;

  if (!customer_id || !folder_id || !filename) {
    logger.warn('Faltan parámetros en deleteFile');
    return res.status(400).json({ message: 'Faltan parámetros obligatorios' });
  }

  try {
    const file = await fileService.getFileByName(customer_id, folder_id, filename);
    if (!file) {
      logger.warn(`Archivo no encontrado en BD: ${filename}`);
      return res.status(404).json({ message: 'Archivo no encontrado en la base de datos' });
    }

    const fullPath = path.join(UPLOADS_ROOT, file.path);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }

    await fileService.deleteFileById(file.id);

    logger.info(`Archivo eliminado correctamente: ${filename}`);
    res.json({ message: `Archivo ${filename} eliminado correctamente` });
  } catch (error) {
    logger.error(`Error al eliminar archivo: ${error.message}`);
    res.status(500).json({ message: 'Error interno del servidor', error: error.message });
  }
};

/**
 * @route POST /api/files/resend/:id
 * @desc Duplica y reenvía el archivo por correo al cliente
 * @access Protegido (requiere JWT)
 */
exports.resendFile = async (req, res) => {
  const { id } = req.params;

  try {
    const newFileId = await fileService.duplicateFile(id);
    const newFile = await fileService.getFileById(newFileId);
    if (!newFile) throw new Error('Error al obtener nuevo archivo para enviar');

    await emailService.sendFileToClient(newFile);

    logger.info(`Archivo reenviado correctamente ID: ${newFileId}`);
    res.json({ message: 'Documento reenviado y enviado por correo correctamente' });
  } catch (err) {
    logger.error(`Error al reenviar archivo: ${err.message}`);
    res.status(500).json({ message: 'Error al reenviar y enviar el documento' });
  }
};
