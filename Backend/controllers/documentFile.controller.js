const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { insertFile, getFiles } = require('../services/file.service');
const { poolPromise } = require('../config/db');

const UPLOADS_ROOT = path.join(__dirname, '../uploads');

const storage = multer.diskStorage({
  destination: async function (req, file, cb) {
    const { clientName, subfolder } = req.body;
    if (!clientName || !subfolder) return cb(new Error('Faltan parámetros'), null);

    const dirPath = path.join(UPLOADS_ROOT, clientName, subfolder);
    fs.mkdirSync(dirPath, { recursive: true });
    cb(null, dirPath);
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) cb(null, true);
  else cb(new Error('Tipo de archivo no permitido'), false);
};

const upload = multer({ storage, fileFilter });
const uploadFile = upload.single('file');

const handleUpload = async (req, res) => {
  try {
    const {
      customer_id, folder_id, clientName, subfolder,
      eta, etd, document_type, file_type
    } = req.body;
    const file = req.file;

    if (!file || !customer_id || !folder_id || !clientName || !subfolder) {
      return res.status(400).json({ message: 'Faltan parámetros obligatorios' });
    }

    const format = path.extname(file.originalname).substring(1);
    const filePath = path.join(clientName, subfolder, file.originalname);

    const fileData = {
      customer_id,
      folder_id,
      name: file.originalname,
      format,
      path: filePath,
      eta: eta || null,
      etd: etd || null,
      was_sent: false,
      status: 'creado',
      document_type: document_type || null,
      file_type: file_type || null
    };

    await insertFile(fileData);
    res.status(201).json({ message: 'Archivo subido y registrado con éxito' });
  } catch (err) {
    console.error('Error al subir archivo:', err);
    res.status(500).json({ message: 'Error interno del servidor', error: err.message });
  }
};

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

/**
 * DELETE /api/files/delete
 * Elimina un archivo físicamente y su registro en BD
 */
const deleteFile = async (req, res) => {
  const { customer_id, folder_id, filename } = req.body;

  if (!customer_id || !folder_id || !filename) {
    return res.status(400).json({ message: 'Faltan parámetros obligatorios' });
  }

  try {
    // Obtener path desde la BD
    const file = await fileService.getFileByName(customer_id, folder_id, filename);
    if (!file) {
      return res.status(404).json({ message: 'Archivo no encontrado en la base de datos' });
    }

    // Eliminar archivo físico
    const fullPath = path.join(UPLOADS_ROOT, file.path);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }

    // Eliminar registro en la BD
    await fileService.deleteFileById(file.id);

    res.json({ message: `Archivo ${filename} eliminado correctamente` });
  } catch (error) {
    console.error('Error al eliminar archivo:', error);
    res.status(500).json({ message: 'Error interno del servidor', error: error.message });
  }
};


module.exports = {
  uploadFile,
  handleUpload,
  getFilesByCustomerAndFolder,
  deleteFile,
};
