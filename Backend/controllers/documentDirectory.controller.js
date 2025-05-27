const fs = require('fs');
const path = require('path');

const UPLOADS_ROOT = path.join(__dirname, '../uploads');

/**
 * Crea el directorio principal del cliente (nombre cliente)
 * Ruta: POST /api/directories/create-client
 * Body: { clientName: "Cliente Uno SPA" }
 */
exports.createClientDirectory = (req, res) => {
  const { clientName } = req.body;
  if (!clientName) return res.status(400).json({ message: 'Nombre del cliente requerido' });

  const clientPath = path.join(UPLOADS_ROOT, clientName);
  if (fs.existsSync(clientPath)) {
    return res.status(409).json({ message: 'La carpeta del cliente ya existe' });
  }

  fs.mkdirSync(clientPath, { recursive: true });
  return res.status(201).json({ message: `Carpeta creada para ${clientName}` });
};

/**
 * Crea subcarpeta dentro de la carpeta del cliente (ej: CP1001)
 * Ruta: POST /api/directories/create-sub
 * Body: { clientName: "Cliente Uno SPA", subfolder: "CP1001" }
 */
exports.createSubDirectory = (req, res) => {
  const { clientName, subfolder } = req.body;
  if (!clientName || !subfolder) return res.status(400).json({ message: 'clientName y subfolder requeridos' });

  const subPath = path.join(UPLOADS_ROOT, clientName, subfolder);
  if (!fs.existsSync(path.join(UPLOADS_ROOT, clientName))) {
    return res.status(404).json({ message: 'El cliente no existe' });
  }

  if (fs.existsSync(subPath)) {
    return res.status(409).json({ message: 'La subcarpeta ya existe' });
  }

  fs.mkdirSync(subPath);
  return res.status(201).json({ message: `Subcarpeta ${subfolder} creada para ${clientName}` });
};

/**
 * Elimina una subcarpeta si está vacía (no borra carpetas raíz de cliente)
 * Ruta: DELETE /api/directories/delete-sub
 * Body: { clientName: "Cliente Uno SPA", subfolder: "CP1001" }
 */
exports.deleteSubDirectory = (req, res) => {
  const { clientName, subfolder } = req.body;
  const targetPath = path.join(UPLOADS_ROOT, clientName, subfolder);

  if (!fs.existsSync(targetPath)) {
    return res.status(404).json({ message: 'La subcarpeta no existe' });
  }

  const files = fs.readdirSync(targetPath);
  if (files.length > 0) {
    return res.status(400).json({ message: 'La carpeta no está vacía y no puede ser eliminada' });
  }

  fs.rmdirSync(targetPath);
  return res.json({ message: `Subcarpeta ${subfolder} eliminada para ${clientName}` });
};
