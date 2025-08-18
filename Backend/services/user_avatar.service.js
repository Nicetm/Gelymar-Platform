const { poolPromise } = require('../config/db');
const UserAvatar = require('../models/user_avatar.model');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

/**
 * Obtiene el avatar activo de un usuario
 * @param {number} userId - ID del usuario
 * @returns {UserAvatar|null} Avatar activo o null
 */
const getActiveAvatar = async (userId) => {
  const pool = await poolPromise;
  const [rows] = await pool.query(
    `SELECT * FROM user_avatar 
     WHERE user_id = ? AND is_active = 1 
     ORDER BY created_at DESC 
     LIMIT 1`,
    [userId]
  );
  
  return rows.length > 0 ? new UserAvatar(rows[0]) : null;
};

/**
 * Guarda un nuevo avatar en la base de datos
 * @param {Object} avatarData - Datos del avatar
 * @returns {number} ID del avatar creado
 */
const saveAvatar = async (avatarData) => {
  const pool = await poolPromise;
  
  // Desactivar avatares anteriores del usuario
  await pool.query(
    'UPDATE user_avatar SET is_active = 0 WHERE user_id = ?',
    [avatarData.user_id]
  );
  
  // Insertar nuevo avatar
  const [result] = await pool.query(
    `INSERT INTO user_avatar (
      user_id, uuid, file_path, mime_type, file_size, 
      is_active, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      avatarData.user_id,
      avatarData.uuid,
      avatarData.file_path,
      avatarData.mime_type,
      avatarData.file_size,
      1
    ]
  );
  
  return result.insertId;
};

/**
 * Elimina un avatar de la base de datos y del filesystem
 * @param {number} avatarId - ID del avatar
 * @returns {boolean} True si se eliminó correctamente
 */
const deleteAvatar = async (avatarId) => {
  const pool = await poolPromise;
  
  // Obtener información del avatar antes de eliminar
  const [rows] = await pool.query(
    'SELECT file_path FROM user_avatar WHERE id = ?',
    [avatarId]
  );
  
  if (rows.length === 0) return false;
  
  // Eliminar archivo del filesystem
  const filePath = path.join(process.env.FILE_SERVER_ROOT || '/var/www/html', rows[0].file_path);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  
  // Eliminar de la base de datos
  await pool.query('DELETE FROM user_avatar WHERE id = ?', [avatarId]);
  
  return true;
};

/**
 * Genera un nombre único para el archivo de avatar
 * @param {string} originalName - Nombre original del archivo
 * @returns {string} Nombre único con extensión
 */
const generateAvatarFileName = (originalName) => {
  const ext = path.extname(originalName).toLowerCase();
  return `avatar${ext}`;
};

/**
 * Valida el archivo de avatar
 * @param {Object} file - Archivo de multer
 * @returns {Object} { valid: boolean, error?: string }
 */
const validateAvatarFile = (file) => {
  const allowedTypes = ['image/png', 'image/jpg', 'image/jpeg'];
  const maxSize = 5 * 1024 * 1024; // 5MB
  
  if (!allowedTypes.includes(file.mimetype)) {
    return { valid: false, error: 'Solo se permiten archivos PNG, JPG o JPEG' };
  }
  
  if (file.size > maxSize) {
    return { valid: false, error: 'El archivo no puede ser mayor a 5MB' };
  }
  
  return { valid: true };
};

module.exports = {
  getActiveAvatar,
  saveAvatar,
  deleteAvatar,
  generateAvatarFileName,
  validateAvatarFile
}; 