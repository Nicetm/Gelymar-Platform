const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { insertFile, getFiles } = require('../services/file.service');
const { poolPromise } = require('../config/db');
const { generateRO, generateInvoice, generateBL } = require('../pdf-generator/generator');
const fileService = require('../services/file.service');
const emailService = require('../services/email.service');
const PDFDocument = require('pdfkit');

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
const uploadFile = upload.single('file');

/**
 * POST /api/files/upload
 * Procesa la carga física del archivo y registra su metadata en la base de datos
 */
const handleUpload = async (req, res) => {
  try {
    const {
      customer_id, folder_id, client_name, subfolder, name
    } = req.body;
    const file = req.file;

    if (!file || !customer_id || !folder_id || !client_name || !subfolder) {
      return res.status(400).json({ message: 'Faltan parámetros obligatorios' });
    }

    const filePath = path.join(client_name, subfolder, file.originalname);

    const fileData = {
      customer_id,
      folder_id,
      name: name,
      path: filePath,
      status_id: 2,
    };

    await insertFile(fileData);
    
    res.status(201).json({ message: 'Archivo subido y registrado con éxito' });
  } catch (err) {
    console.error('Error al subir archivo:', err);
    res.status(500).json({ message: 'Error interno del servidor', error: err.message });
  }
};

/**
 * GET /api/files/:customerUuid?f=folderId
 * Obtiene todos los archivos de una carpeta específica de un cliente dado su UUID
 */
const getFilesByCustomerAndFolder = async (req, res) => {
  const { customerUuid } = req.params;
  const folderId = req.query.f;

  try {
    const pool = await poolPromise;
    const [[customer]] = await pool.query(`SELECT id FROM customers WHERE uuid = ?`, [customerUuid]);

    if (!customer) {
      return res.status(404).json({ message: 'Cliente no encontrado' });
    }

    const files = await getFiles(customer.id, folderId);
    res.json(files);
  } catch (err) {
    console.error('Error al obtener archivos:', err);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

const generateFile = async (req, res) => {
  const { id } = req.params;

  try {
    // Primero obtener el registro del archivo
    const file = await fileService.getFileById(id);
    if (!file) {
      return res.status(404).json({ message: 'Archivo no encontrado' });
    }

    // Definir ruta de generación
    const FILE_SERVER_ROOT = process.env.FILE_SERVER_ROOT;
    const customerFolder = path.join(FILE_SERVER_ROOT, file.customer_name, file.folder_name);
    
    // Validamos que exista el directorio del cliente
    if (!fs.existsSync(customerFolder)) {
      fs.mkdirSync(customerFolder, { recursive: true });
    }

    const fileName = `${file.name}.pdf`;
    const filePath = path.join(customerFolder, fileName);

    // Generar el PDF
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

    /*
    const doc = new PDFDocument();
    doc.pipe(fs.createWriteStream(filePath));
    doc.fontSize(18).text(`Documento generado para ${file.name}`);
    doc.end();
    */

    // Actualizar el registro en la tabla files
    const updateData = {
      id: file.id,
      status_id: 2,
      updated_at: new Date(),
      path: path.relative(FILE_SERVER_ROOT, filePath)
    };

    await fileService.updateFile(updateData);

    return res.json({ message: 'Archivo generado exitosamente', path: updateData.path });

  } catch (error) {
    console.error('Error al generar archivo:', error);
    return res.status(500).json({ message: 'Error al generar el archivo' });
  }
};

const sendFile = async (req, res) => {
  const { id } = req.params;

  try {
    // Buscar archivo, obtener datos del cliente, preparar el mail
    const file = await fileService.getFileById(id);
    if (!file) return res.status(404).json({ message: 'Archivo no encontrado' });

    await emailService.sendFileToClient(file);  // envía el email

    await fileService.updateFile({
      id: id,
      status_id: 3,
      updated_at: new Date(),
      path: file.path 
    }); // actualiza a estado enviado

    res.json({ message: 'Documento enviado correctamente' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error al enviar documento' });
  }
};

/**
 * DELETE /api/files/delete
 * Elimina un archivo del sistema de archivos y su registro en la base de datos
 */
const deleteFile = async (req, res) => {
  const { customer_id, folder_id, filename } = req.body;

  if (!customer_id || !folder_id || !filename) {
    return res.status(400).json({ message: 'Faltan parámetros obligatorios' });
  }

  try {
    // Obtener path del archivo desde la BD
    const file = await fileService.getFileByName(customer_id, folder_id, filename);
    if (!file) {
      return res.status(404).json({ message: 'Archivo no encontrado en la base de datos' });
    }

    // Eliminar archivo físico
    const fullPath = path.join(UPLOADS_ROOT, file.path);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }

    // Eliminar registro en la base de datos
    await fileService.deleteFileById(file.id);

    res.json({ message: `Archivo ${filename} eliminado correctamente` });
  } catch (error) {
    console.error('Error al eliminar archivo:', error);
    res.status(500).json({ message: 'Error interno del servidor', error: error.message });
  }
};

const resendFile = async (req, res) => {
  const { id } = req.params;

  try {
    // Duplicar el registro
    const newFileId = await fileService.duplicateFile(id);

    // Obtener el nuevo registro completo (para enviar el email)
    const newFile = await fileService.getFileById(newFileId);
    if (!newFile) throw new Error('Error al obtener nuevo archivo para enviar');

    // Enviar el correo
    await emailService.sendFileToClient(newFile);

    // Responder OK
    res.json({ message: 'Documento reenviado y enviado por correo correctamente' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error al reenviar y enviar el documento' });
  }
};

module.exports = {
  uploadFile,
  generateFile,
  sendFile,
  handleUpload,
  getFilesByCustomerAndFolder,
  deleteFile,
  resendFile,
};
