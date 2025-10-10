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

// Buscar por email (que contiene el RUT/username) con JOIN a roles
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

// Actualizar estado online del usuario
async function updateUserOnlineStatus(userId, onlineStatus) {
  const pool = await poolPromise;
  await pool.query('UPDATE users SET online = ? WHERE id = ?', [onlineStatus, userId]);
}

// Obtener informaci�n del administrador principal (online/offline y nombre)
async function getPrimaryAdminPresence() {
  const pool = await poolPromise;
  const [rows] = await pool.query(
    `SELECT u.full_name, u.email, u.online
     FROM users u
     LEFT JOIN roles r ON u.role_id = r.id
     WHERE u.role_id = 1
     ORDER BY u.online DESC, u.id ASC
     LIMIT 1`
  );

  if (!rows || rows.length === 0) {
    return { online: false, name: 'Administrador' };
  }

  const { full_name, email, online } = rows[0];
  const displayName = (full_name && full_name.trim()) || email || 'Administrador';
  return { online: online === 1 || online === true, name: displayName };
}

async function getSpecificAdminPresence(adminId) {
  const pool = await poolPromise;
  const [rows] = await pool.query(
    `SELECT u.full_name, u.email, u.online
     FROM users u
     WHERE u.id = ? AND u.role_id = 1`,
    [adminId]
  );

  if (!rows || rows.length === 0) {
    return { online: false, name: 'Administrador' };
  }

  const { full_name, email, online } = rows[0];
  const displayName = (full_name && full_name.trim()) || email || 'Administrador';
  return { online: online === 1 || online === true, name: displayName };
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
  const { email, password, role_id, full_name, phone, country, city, twoFASecret } = user;

  const [result] = await pool.query(`
    INSERT INTO users (
      email, 
      password, 
      role_id, 
      twoFASecret, 
      twoFAEnabled, 
      full_name, 
      phone, 
      country, 
      city, 
      created_at, 
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
  `, [
    email,
    password,
    role_id,
    twoFASecret,
    false,
    full_name,
    phone,
    country,
    city
  ]);

  return result.insertId;
}

// Actualizar secret 2FA
async function updateUser2FASecret(userId, secret) {
  const pool = await poolPromise;
  await pool.query('UPDATE users SET twoFASecret = ? WHERE id = ?', [secret, userId]);
}


// Verificar si hay al menos un administrador en línea
module.exports = {
  getAllUsers,
  findUserByEmailOrUsername,
  findCustomerIdByRut,
  updateUserOnlineStatus,
  getPrimaryAdminPresence,
  getSpecificAdminPresence,
  findUserForAuth,
  getUserProfile,
  updateUserProfile,
  createUser,
  updateUser2FASecret,
};

