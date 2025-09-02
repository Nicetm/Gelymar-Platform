const userService = require('../services/user.service');
const userAvatarService = require('../services/user_avatar.service');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { logger } = require('../utils/logger');

// Configuración de almacenamiento para Multer - Avatares
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(process.env.FILE_SERVER_ROOT || '/var/www/html', 'uploads');
    logger.info(`DEBUG - Multer avatar destination: ${uploadDir}`);
    
    try {
      fs.mkdirSync(uploadDir, { recursive: true });
      logger.info(`DEBUG - Directorio de avatar creado exitosamente: ${uploadDir}`);
      cb(null, uploadDir);
    } catch (error) {
      logger.error(`DEBUG - Error creando directorio de avatar: ${error.message}`);
      cb(error, null);
    }
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const fileName = `avatar${ext}`;
    logger.info(`DEBUG - Multer avatar filename: ${fileName}`);
    cb(null, fileName);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
});

// Middleware de multer para avatar
exports.uploadAvatar = upload.single('avatar');

/**
 * @route GET /api/users
 * @desc Retorna todos los clientes
 * @access Protegido (requiere JWT)
 */
exports.getAllUsers = async (req, res) => {
  try {
    const users = await userService.getAllUsers();
    res.json(users);
  } catch (error) {
    console.error('Error al obtener clientes:', error);
    res.status(500).json({ message: 'Error al obtener clientes desde la base de datos' });
  }
};

/**
 * @route GET /api/users/profile
 * @desc Obtiene el perfil completo del usuario autenticado
 * @access Protegido (requiere JWT)
 */
exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const profile = await userService.getUserProfile(userId);
    
    if (!profile) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    res.json(profile);
  } catch (error) {
    logger.error(`Error al obtener perfil: ${error.message}`);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

/**
 * @route PUT /api/users/profile
 * @desc Actualiza el perfil del usuario autenticado
 * @access Protegido (requiere JWT)
 */
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { full_name, phone, country, city } = req.body;
    
    if (!full_name || !phone) {
      return res.status(400).json({ message: 'Nombre y teléfono son obligatorios' });
    }
    
    const updated = await userService.updateUserProfile(userId, {
      full_name,
      phone,
      country: country || null,
      city: city || null
    });
    
    if (!updated) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    logger.info(`Perfil actualizado para usuario ${userId}`);
    res.json({ message: 'Perfil actualizado correctamente' });
  } catch (error) {
    logger.error(`Error al actualizar perfil: ${error.message}`);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

/**
 * @route POST /api/users/avatar
 * @desc Sube un avatar para el usuario autenticado
 * @access Protegido (requiere JWT)
 */
exports.handleAvatarUpload = async (req, res) => {
  try {
    const userId = req.user.id;
    const file = req.file;
    
    if (!file) {
      return res.status(400).json({ message: 'No se proporcionó ningún archivo' });
    }
    
    // Validar archivo
    const validation = userAvatarService.validateAvatarFile(file);
    if (!validation.valid) {
      return res.status(400).json({ message: validation.error });
    }
    
    // El archivo ya está guardado en el directorio correcto por multer
    const fileName = `avatar${path.extname(file.originalname).toLowerCase()}`;
    const filePath = `uploads/${fileName}`;
    
    // Guardar en base de datos
    const avatarData = {
      user_id: userId,
      uuid: require('uuid').v4(),
      file_path: filePath,
      mime_type: file.mimetype,
      file_size: file.size
    };
    
    await userAvatarService.saveAvatar(avatarData);
    
    logger.info(`Avatar subido para usuario ${userId}`);
    res.json({ 
      message: 'Avatar subido correctamente',
      avatar_path: avatarData.file_path
    });
  } catch (error) {
    logger.error(`Error al subir avatar: ${error.message}`);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};