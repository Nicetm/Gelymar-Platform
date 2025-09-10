// services/user.service.js
const { poolPromise } = require('../config/db');
const Users = require('../models/user.model');

/**
 * Obtiene todos los clientes con un conteo de carpetas asociadas (folder_count)
 * @returns {Array<Users>} Lista de clientes con propiedad adicional folder_count
 */
async function getAllUsers() {
  const pool = await poolPromise;
  const [rows] = await pool.query(`
    SELECT * FROM users
  `);

  return rows.map(row => {
    const usesr = new Users(row);
    return usesr;
  });
}

// Buscar por email o username con JOIN a roles
async function findUserByEmailOrUsername(emailOrUsername) {
  const pool = await poolPromise;
  
  const [rows] = await pool.query(
    `
    SELECT u.id, u.email, u.password,
           u.twoFASecret, u.twoFAEnabled, u.change_pw,
           u.full_name, u.phone, u.country, u.city,
           r.name AS role
    FROM users u
    LEFT JOIN roles r ON u.role_id = r.id
    WHERE u.email = ?
    LIMIT 1
    `,
    [emailOrUsername]
  );
  
  return rows[0];
}

// Buscar customer_id por RUT
async function findCustomerIdByRut(rut) {
  const pool = await poolPromise;
  const [rows] = await pool.query('SELECT id FROM customers WHERE rut = ?', [rut]);
  return rows.length > 0 ? rows[0].id : null;
}

// Buscar usuario completo con roles y customer info para autenticación
async function findUserForAuth(userId) {
  const pool = await poolPromise;
  const [rows] = await pool.query(
    `SELECT u.id, u.email, r.name AS role, u.twoFAEnabled, u.twoFASecret, c.id AS customer_id, c.uuid
     FROM users u
     LEFT JOIN roles r ON u.role_id = r.id
     LEFT JOIN customers c ON u.email = c.rut
     WHERE u.id = ?`,
    [userId]
  );
  return rows[0];
}

// Obtener perfil completo del usuario con avatar
async function getUserProfile(userId) {
  const pool = await poolPromise;
  
  const [rows] = await pool.query(
    `
    SELECT u.id, u.email, u.full_name, u.phone, u.country, u.city,
           u.created_at, u.updated_at, u.change_pw,
           r.name AS role,
           ua.file_path AS avatar_path, ua.mime_type AS avatar_mime_type
    FROM users u
    LEFT JOIN roles r ON u.role_id = r.id
    LEFT JOIN user_avatar ua ON u.id = ua.user_id AND ua.is_active = 1
    WHERE u.id = ?
    LIMIT 1
    `,
    [userId]
  );
  
  return rows[0];
}

// Actualizar perfil del usuario
async function updateUserProfile(userId, profileData) {
  const pool = await poolPromise;
  
  const [result] = await pool.query(
    `UPDATE users 
     SET full_name = ?, phone = ?, country = ?, city = ?, updated_at = NOW()
     WHERE id = ?`,
    [profileData.full_name, profileData.phone, profileData.country, profileData.city, userId]
  );
  
  return result.affectedRows > 0;
}

// Crear nuevo usuario
async function createUser(user) {
  const pool = await poolPromise;
  const { email, username, password, role, cardCode, twoFASecret } = user;

  const [result] = await pool.query(
    'INSERT INTO users (email, username, password, role, cardCode, twoFASecret, twoFAEnabled) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [email, username, password, role, cardCode, twoFASecret, false]
  );

  return result.insertId;
}

// Actualizar secret 2FA
async function updateUser2FASecret(userId, secret) {
  const pool = await poolPromise;
  await pool.query('UPDATE users SET twoFASecret = ? WHERE id = ?', [secret, userId]);
}

module.exports = {
  getAllUsers,
  findUserByEmailOrUsername,
  findCustomerIdByRut,
  findUserForAuth,
  getUserProfile,
  updateUserProfile,
  createUser,
  updateUser2FASecret,
};