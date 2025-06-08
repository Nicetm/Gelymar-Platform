const fs = require('fs');
const path = require('path');
const customers = require('../dummy/customers.json');

const UPLOADS_ROOT = path.join(__dirname, '../uploads');

/**
 * Lista las carpetas del cliente según su ID.
 * Ruta: GET /api/directories/:customerId
 * Acceso: Solo administradores con token JWT
 * Requiere: customerId como parámetro de URL
 * Retorna: Array de nombres de carpetas dentro del directorio del cliente
 */
exports.getClientDirectories = (req, res) => {
  const { customerId } = req.params; // este es el UUID
  const clientName = req.query.c;

  if (!customerId) {
    return res.status(400).json({ message: 'ID inválido' });
  }

  // Buscar nombre del cliente por UUID
  const customer = customers.find(c => c.uuid === customerId);
  if (!customer) {
    return res.status(404).json({ message: 'Cliente no encontrado' });
  }

  const clientFolder = customer.name;
  const basePath = path.join(__dirname, '..', 'uploads', clientFolder);

  if (!fs.existsSync(basePath)) {
    return res.status(404).json({ message: 'Directorio no encontrado para este cliente' });
  }

  const directories = fs.readdirSync(basePath, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => ({
      name: dirent.name,
      path: path.join(clientFolder, dirent.name),
      createdAt: fs.statSync(path.join(basePath, dirent.name)).birthtime.toISOString().split('T')[0]
    }));

  return res.status(200).json(directories);
};

/**
 * Crea el directorio principal del cliente (nombre cliente)
 * Ruta: POST /api/directories/create-client
 * Body: { clientName: "Cliente Uno SPA" }
 */
exports.createDirectory = async (req, res) => {
  const { clientName, name } = req.body;
  if (!clientName || !name) {
    return res.status(400).json({ message: 'Faltan datos requeridos' });
  }

  const basePath = path.join(__dirname, '..', 'uploads');
  const isCPFolder = /^PC\d+$/.test(name.toUpperCase()); // Detecta formato PCXXXXXX

  try {
    if (isCPFolder) {
      // Revisión global para CP folders
      const clients = fs.readdirSync(basePath);

      for (const client of clients) {
        const clientPath = path.join(basePath, client);
        if (!fs.statSync(clientPath).isDirectory()) continue;

        const subfolders = fs.readdirSync(clientPath);
        if (subfolders.includes(name)) {
          return res.status(400).json({
            message: `La carpeta ${name} ya existe en el cliente "${client}". Los códigos PC deben ser únicos.`,
          });
        }
      }
    } else {
      // Validación solo dentro del cliente
      const clientFolder = path.join(basePath, clientName);
      if (!fs.existsSync(clientFolder)) fs.mkdirSync(clientFolder);

      const folderPath = path.join(clientFolder, name);
      if (fs.existsSync(folderPath)) {
        return res.status(400).json({
          message: `La carpeta "${name}" ya existe para el cliente ${clientName}.`,
        });
      }
    }

    // Crear carpeta
    const clientDir = path.join(basePath, clientName);
    if (!fs.existsSync(clientDir)) {
      fs.mkdirSync(clientDir, { recursive: true });
    }

    const newPath = path.join(clientDir, name);
    fs.mkdirSync(newPath);
    
    res.status(201).json({ message: 'Carpeta creada exitosamente' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error al crear carpeta' });
  }
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
