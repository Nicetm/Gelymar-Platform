const { container } = require('../config/container');
const userService = container.resolve('userService');
const userAvatarService = container.resolve('userAvatarService');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { logger } = require('../utils/logger');
const { t } = require('../i18n');

// Configuración de almacenamiento para Multer - Avatares
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const userId = req.user?.id || 'unknown';
    const uploadDir = path.join(
      process.env.FILE_SERVER_ROOT || '/var/www/html',
      'uploads',
      'admins',
      String(userId),
      'avatar'
    );
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
    const fileName = `avatar_${require('uuid').v4()}${ext}`;
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
    logger.error(`[getAllUsers] Error: ${error.message}`);
    res.status(500).json({ message: t('user.get_users_error', req.lang || 'es') });
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
      return res.status(404).json({ message: t('user.profile_not_found', req.lang || 'es') });
    }
    
    res.json(profile);
  } catch (error) {
    logger.error(`[getProfile] Error: ${error.message}`);
    res.status(500).json({ message: t('user.get_profile_error', req.lang || 'es') });
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
    const { full_name, phone, country, city, address } = req.body;
    
    if (!full_name || !phone) {
      return res.status(400).json({ message: t('user.name_phone_required', req.lang || 'es') });
    }
    
    const updated = await userService.updateUserProfile(userId, {
      full_name,
      phone,
      country: country || null,
      city: city || null,
      address: address || null
    });
    
    if (!updated) {
      return res.status(404).json({ message: t('user.profile_not_found', req.lang || 'es') });
    }
    
    logger.info(`[updateProfile] Perfil actualizado userId=${userId}`);
    res.json({ message: t('user.profile_updated', req.lang || 'es') });
  } catch (error) {
    logger.error(`[updateProfile] Error: ${error.message}`);
    res.status(500).json({ message: t('user.update_profile_error', req.lang || 'es') });
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
      return res.status(400).json({ message: t('user.no_file_provided', req.lang || 'es'), code: 'AVATAR_MISSING' });
    }
    
    // Validar archivo
    const validation = userAvatarService.validateAvatarFile(file);
    if (!validation.valid) {
      return res.status(400).json({ message: validation.error, code: validation.code || 'AVATAR_INVALID' });
    }
    
    // El archivo ya está guardado en el directorio correcto por multer
    const fileName = file.filename;
    const filePath = `uploads/admins/${userId}/avatar/${fileName}`;
    
    // Guardar en base de datos
    const avatarData = {
      user_id: userId,
      uuid: require('uuid').v4(),
      file_path: filePath,
      mime_type: file.mimetype,
      file_size: file.size
    };
    
    await userAvatarService.saveAvatar(avatarData);
    
    logger.info(`[handleAvatarUpload] Avatar subido userId=${userId}`);
    res.json({ 
      message: t('user.avatar_uploaded', req.lang || 'es'),
      avatar_path: avatarData.file_path
    });
  } catch (error) {
    logger.error(`[handleAvatarUpload] Error: ${error.message}`);
    res.status(500).json({ message: t('user.upload_avatar_error', req.lang || 'es') });
  }
};

// ===== Admin users (role_id = 1) =====

exports.getAdminUsers = async (req, res) => {
  try {
    const admins = await userService.getAdminUsers();
    res.json(admins);
  } catch (error) {
    logger.error(`[getAdminUsers] Error: ${error.message}`);
    res.status(500).json({ message: t('user.get_admins_error', req.lang || 'es') });
  }
};

exports.getAdminPresenceList = async (req, res) => {
  try {
    const admins = await userService.getAdminPresenceList();
    res.json(admins);
  } catch (error) {
    logger.error(`[getAdminPresenceList] Error: ${error.message}`);
    res.status(500).json({ message: t('user.get_admin_presence_error', req.lang || 'es') });
  }
};

exports.createAdminUser = async (req, res) => {
  try {
    const { rut, email, full_name, phone, agent, password } = req.body;
    if (!rut || !email || !password) {
      return res.status(400).json({ message: t('user.rut_email_password_required', req.lang || 'es') });
    }
    const id = await userService.createAdminUser({ rut, email, full_name, phone, agent, password });
    res.status(201).json({ id, message: t('user.admin_created', req.lang || 'es') });
  } catch (error) {
    if (error?.code === 'ER_DUP_ENTRY') {
      logger.error(`[createAdminUser] Error duplicado: ${error.message}`);
      const dupMessage = error.message || '';
      if (dupMessage.includes('users.rut')) {
        return res.status(409).json({ message: t('user.rut_exists', req.lang || 'es') });
      }
      if (dupMessage.includes('admins.email')) {
        return res.status(409).json({ message: t('user.email_exists', req.lang || 'es') });
      }
      return res.status(409).json({ message: t('user.admin_exists', req.lang || 'es') });
    }
    logger.error(`[createAdminUser] Error: ${error.message}`);
    res.status(500).json({ message: t('user.create_admin_error', req.lang || 'es') });
  }
};

exports.updateAdminUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { rut, email, full_name, phone, agent } = req.body;
    if (!id) return res.status(400).json({ message: t('user.id_required', req.lang || 'es') });
    if (!rut || !email) {
      return res.status(400).json({ message: t('user.rut_email_required', req.lang || 'es') });
    }
    const updated = await userService.updateAdminUser(id, { rut, email, full_name, phone, agent });
    if (!updated) return res.status(404).json({ message: t('user.admin_not_found', req.lang || 'es') });
    res.json({ message: t('user.admin_updated', req.lang || 'es') });
  } catch (error) {
    logger.error(`[updateAdminUser] Error: ${error.message}`);
    res.status(500).json({ message: t('user.update_admin_error', req.lang || 'es') });
  }
};

exports.deleteAdminUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: t('user.id_required', req.lang || 'es') });
    const deleted = await userService.deleteUserById(id);
    if (!deleted) return res.status(404).json({ message: t('user.admin_not_found', req.lang || 'es') });
    res.json({ message: t('user.admin_deleted', req.lang || 'es') });
  } catch (error) {
    logger.error(`[deleteAdminUser] Error: ${error.message}`);
    res.status(500).json({ message: t('user.delete_admin_error', req.lang || 'es') });
  }
};

exports.resetAdminPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body || {};
    if (!id) return res.status(400).json({ message: t('user.id_required', req.lang || 'es') });
    const reset = await userService.resetAdminPassword(id, newPassword || '12345');
    if (!reset) return res.status(404).json({ message: t('user.admin_not_found', req.lang || 'es') });
    res.json({ message: t('user.password_reset', req.lang || 'es') });
  } catch (error) {
    logger.error(`[resetAdminPassword] Error: ${error.message}`);
    res.status(500).json({ message: t('user.reset_password_error', req.lang || 'es') });
  }
};


/**
 * @route GET /api/users/blocked-status/:rut
 * @desc Obtiene el estado de bloqueado de un usuario por RUT
 * @access Protegido (requiere JWT)
 */
exports.getBlockedStatus = async (req, res) => {
  try {
    const { rut } = req.params;
    
    if (!rut) {
      return res.status(400).json({ message: 'RUT es requerido' });
    }
    
    const user = await userService.getUserByRut(rut);
    
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    res.json({ bloqueado: user.bloqueado || 0 });
  } catch (error) {
    logger.error(`Error obteniendo estado de bloqueado: ${error.message}`);
    res.status(500).json({ message: 'Error al obtener estado de bloqueado' });
  }
};

/**
 * @route PUT /api/users/block/:rut
 * @desc Actualiza el estado de bloqueado de un usuario por RUT
 * @access Protegido (requiere JWT - solo admin)
 */
exports.updateBlockedStatus = async (req, res) => {
  try {
    const { rut } = req.params;
    const { bloqueado } = req.body;
    
    if (!rut) {
      return res.status(400).json({ message: 'RUT es requerido' });
    }
    
    if (bloqueado === undefined || bloqueado === null) {
      return res.status(400).json({ message: 'Estado de bloqueado es requerido' });
    }
    
    const blockedValue = bloqueado === 1 || bloqueado === '1' || bloqueado === true ? 1 : 0;
    
    const updated = await userService.updateBlockedStatus(rut, blockedValue);
    
    if (!updated) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    logger.info(`Usuario ${rut} ${blockedValue === 1 ? 'bloqueado' : 'desbloqueado'} por admin ${req.user.id}`);
    res.json({ message: 'Estado actualizado correctamente', bloqueado: blockedValue });
  } catch (error) {
    logger.error(`Error actualizando estado de bloqueado: ${error.message}`);
    res.status(500).json({ message: 'Error al actualizar estado de bloqueado' });
  }
};
