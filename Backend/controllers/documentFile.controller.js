const fs = require('fs');
const path = require('path');
const multer = require('multer');

const UPLOADS_ROOT = path.join(__dirname, '../uploads');

// Multer config para validación y destino dinámico
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const { clientName, subfolder } = req.body;
  
    if (!clientName || !subfolder) return cb(new Error('Faltan parámetros'), null);
  
    const dirPath = path.join(UPLOADS_ROOT, clientName, subfolder);
  
    // Crea el directorio si no existe
    fs.mkdirSync(dirPath, { recursive: true });
  
    cb(null, dirPath);
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname); // conservar nombre original
  }
});

// Filtro de tipos de archivos válidos
const fileFilter = (req, file, cb) => {
  const allowed = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) cb(null, true);
  else cb(new Error('Tipo de archivo no permitido'), false);
};

const upload = multer({ storage, fileFilter });

/**
 * POST /api/files/upload
 * Sube un archivo al directorio indicado
 */
const uploadFile = upload.single('file');
const handleUpload = (req, res) => {
  return res.status(201).json({ message: 'Archivo subido con éxito' });
};

/**
 * DELETE /api/files/delete
 * Elimina un archivo del sistema
 * Body: { clientName, subfolder, filename }
 */
const deleteFile = (req, res) => {
  const { clientName, subfolder, filename } = req.body;

  if (!clientName || !subfolder || !filename) {
    return res.status(400).json({ message: 'clientName, subfolder y filename son requeridos' });
  }

  const filePath = path.join(UPLOADS_ROOT, clientName, subfolder, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ message: 'Archivo no encontrado' });
  }

  fs.unlinkSync(filePath);
  return res.json({ message: `Archivo ${filename} eliminado` });
};

module.exports = {uploadFile, handleUpload, deleteFile};
