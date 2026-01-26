// services/user.service.js
const { poolPromise } = require('../config/db');
const { logger } = require('../utils/logger');
const Users = require('../models/user.model');
const bcrypt = require('bcrypt');

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

// Buscar por RUT (login) con JOIN a roles
async function findUserByEmailOrUsername(emailOrUsername) {
  const pool = await poolPromise;
  const normalized = (emailOrUsername || '')
    .trim()
    .toLowerCase()
    .replace(/\./g, '');

  const query = `
    SELECT u.id, u.rut AS rut, u.password, u.role_id,
           u.twoFASecret, u.twoFAEnabled, u.change_pw,
           COALESCE(a.name, c.name, s.nombre) AS full_name,
           COALESCE(a.phone, c.phone) AS phone,
           COALESCE(a.country, c.country) AS country,
           COALESCE(a.city, c.city) AS city,
           r.name AS role
    FROM users u
    LEFT JOIN roles r ON u.role_id = r.id
    LEFT JOIN customers c ON u.rut COLLATE utf8mb4_general_ci = c.rut COLLATE utf8mb4_general_ci
    LEFT JOIN admins a ON u.rut COLLATE utf8mb4_general_ci = a.rut COLLATE utf8mb4_general_ci
    LEFT JOIN sellers s ON u.rut COLLATE utf8mb4_general_ci = s.rut COLLATE utf8mb4_general_ci
    WHERE REPLACE(LOWER(TRIM(u.rut)), '.', '') COLLATE utf8mb4_general_ci
      = ? COLLATE utf8mb4_general_ci
    LIMIT 1
  `;
  logger.info(`[findUserByEmailOrUsername] input=${emailOrUsername} normalized=${normalized}`);
  logger.info(`[findUserByEmailOrUsername] params=${JSON.stringify([normalized])}`);

  const [rows] = await pool.query(query, [normalized]);
  
  return rows[0];
}

// Buscar usuario para recuperacion de contrasena usando correo real (admins.email o customers.email)
async function findUserForPasswordRecovery(email) {
  const pool = await poolPromise;

  const [rows] = await pool.query(
    `
    SELECT u.id, u.rut AS rut, u.password, u.role_id,
           u.twoFASecret, u.twoFAEnabled, u.change_pw,
           COALESCE(a.name, c.name, s.nombre) AS full_name,
           COALESCE(a.phone, c.phone) AS phone,
           COALESCE(a.country, c.country) AS country,
           COALESCE(a.city, c.city) AS city,
           a.email AS admin_email, c.email AS customer_email,
           r.name AS role
    FROM users u
    LEFT JOIN roles r ON u.role_id = r.id
    LEFT JOIN customers c ON u.rut COLLATE utf8mb4_general_ci = c.rut COLLATE utf8mb4_general_ci
    LEFT JOIN admins a ON u.rut COLLATE utf8mb4_general_ci = a.rut COLLATE utf8mb4_general_ci
    LEFT JOIN sellers s ON u.rut COLLATE utf8mb4_general_ci = s.rut COLLATE utf8mb4_general_ci
    WHERE LOWER(a.email) = LOWER(?)
       OR LOWER(c.email) = LOWER(?)
       OR LOWER(u.rut) = LOWER(?)
    LIMIT 1
    `,
    [email, email, email]
  );

  return rows[0];
}

async function findUserById(id) {
  const pool = await poolPromise;
  const [rows] = await pool.query(
    `
    SELECT u.id, u.rut AS rut, u.password, u.role_id,
           u.twoFASecret, u.twoFAEnabled, u.change_pw,
           COALESCE(a.name, c.name, s.nombre) AS full_name,
           COALESCE(a.phone, c.phone) AS phone,
           COALESCE(a.country, c.country) AS country,
           COALESCE(a.city, c.city) AS city,
           a.email AS admin_email, c.email AS customer_email,
           r.name AS role
    FROM users u
    LEFT JOIN roles r ON u.role_id = r.id
    LEFT JOIN customers c ON u.rut COLLATE utf8mb4_general_ci = c.rut COLLATE utf8mb4_general_ci
    LEFT JOIN admins a ON u.rut COLLATE utf8mb4_general_ci = a.rut COLLATE utf8mb4_general_ci
    LEFT JOIN sellers s ON u.rut COLLATE utf8mb4_general_ci = s.rut COLLATE utf8mb4_general_ci
    WHERE u.id = ?
    LIMIT 1
    `,
    [id]
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
    `SELECT a.name, a.email, u.online
     FROM users u
     LEFT JOIN admins a ON u.rut = a.rut
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
    `SELECT a.name, a.email, u.online
     FROM users u
     LEFT JOIN admins a ON u.rut = a.rut
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
    `SELECT u.id, u.rut AS rut, u.role_id, r.name AS role, u.twoFAEnabled, u.twoFASecret, c.id AS customer_id, c.uuid
     FROM users u
     LEFT JOIN roles r ON u.role_id = r.id
     LEFT JOIN customers c ON u.rut = c.rut
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
    SELECT u.id, u.rut AS rut,
           COALESCE(a.name, c.name, s.nombre) AS full_name,
           COALESCE(a.phone, c.phone) AS phone,
           COALESCE(a.country, c.country) AS country,
           COALESCE(a.city, c.city) AS city,
           u.created_at, u.updated_at, u.change_pw,
           COALESCE(a.email, c.email) AS email,
           r.name AS role,
           ua.file_path AS avatar_path, ua.mime_type AS avatar_mime_type
    FROM users u
    LEFT JOIN roles r ON u.role_id = r.id
    LEFT JOIN customers c ON u.rut COLLATE utf8mb4_general_ci = c.rut COLLATE utf8mb4_general_ci
    LEFT JOIN admins a ON u.rut COLLATE utf8mb4_general_ci = a.rut COLLATE utf8mb4_general_ci
    LEFT JOIN sellers s ON u.rut COLLATE utf8mb4_general_ci = s.rut COLLATE utf8mb4_general_ci
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
  const [rows] = await pool.query(
    'SELECT rut, role_id FROM users WHERE id = ?',
    [userId]
  );
  if (rows.length === 0) return false;

  const { rut, role_id } = rows[0];

  if (role_id === 1) {
    const [result] = await pool.query(
      `UPDATE admins
       SET name = ?, phone = ?, country = ?, city = ?, updated_at = NOW()
       WHERE rut = ?`,
      [profileData.full_name, profileData.phone, profileData.country, profileData.city, rut]
    );
    return result.affectedRows > 0;
  }

  if (role_id === 2) {
    const [result] = await pool.query(
      `UPDATE customers
       SET name = ?, phone = ?, country = ?, city = ?, updated_at = NOW()
       WHERE rut = ?`,
      [profileData.full_name, profileData.phone, profileData.country, profileData.city, rut]
    );
    return result.affectedRows > 0;
  }

  return false;
}

// Crear nuevo usuario
async function createUser(user) {
  const pool = await poolPromise;
  const { rut, email, password, role_id, twoFASecret } = user;
  const userRut = (rut || email || '').trim();
  if (!userRut) {
    throw new Error('RUT requerido para crear usuario');
  }

  const [result] = await pool.query(`
    INSERT INTO users (
      rut,
      password, 
      role_id, 
      twoFASecret, 
      twoFAEnabled, 
      created_at, 
      updated_at
    ) VALUES (?, ?, ?, ?, ?, NOW(), NOW())
  `, [
    userRut,
    password,
    role_id,
    twoFASecret,
    false
  ]);

  return result.insertId;
}

// Actualizar secret 2FA
async function updateUser2FASecret(userId, secret) {
  const pool = await poolPromise;
  await pool.query('UPDATE users SET twoFASecret = ? WHERE id = ?', [secret, userId]);
}

// Admin users CRUD (role_id = 1)
async function getAdminUsers() {
  const pool = await poolPromise;
  const [rows] = await pool.query(
    `SELECT u.id, u.rut, a.email, a.name AS full_name, a.phone, u.agent
     FROM users u
     JOIN admins a ON u.rut = a.rut
     WHERE u.role_id = 1
     ORDER BY u.id ASC`
  );
  return rows;
}

async function getAdminUserById(adminId) {
  const pool = await poolPromise;
  const [rows] = await pool.query(
    'SELECT u.id, a.email, a.name FROM users u JOIN admins a ON u.rut = a.rut WHERE u.id = ? AND u.role_id = 1',
    [adminId]
  );
  return rows[0] || null;
}

async function getAdminNotificationRecipients() {
  const pool = await poolPromise;
  const [rows] = await pool.query(
    'SELECT a.email, a.name FROM users u JOIN admins a ON u.rut = a.rut WHERE u.role_id = 1 AND a.email IS NOT NULL AND a.email <> \'\''
  );
  return rows;
}

async function createAdminUser({ rut, email, full_name, phone, agent, password }) {
  const pool = await poolPromise;
  const hashed = await bcrypt.hash(password, 10);
  const [result] = await pool.query(
    `INSERT INTO users (rut, password, role_id, agent, created_at, updated_at)
     VALUES (?, ?, 1, ?, NOW(), NOW())`,
    [rut, hashed, agent || null]
  );

  await pool.query(
    `INSERT INTO admins (rut, email, name, phone, created_at, updated_at)
     VALUES (?, ?, ?, ?, NOW(), NOW())
     ON DUPLICATE KEY UPDATE
       email = VALUES(email),
       name = VALUES(name),
       phone = VALUES(phone),
       updated_at = NOW()`,
    [rut, email, full_name || null, phone || null]
  );

  return result.insertId;
}

async function updateAdminUser(id, { rut, email, full_name, phone, agent }) {
  const pool = await poolPromise;
  const [currentRows] = await pool.query(
    'SELECT rut FROM users WHERE id = ? AND role_id = 1',
    [id]
  );
  if (currentRows.length === 0) return false;
  const currentRut = currentRows[0].rut;

  const [result] = await pool.query(
    `UPDATE users
     SET rut = ?, agent = ?, updated_at = NOW()
     WHERE id = ? AND role_id = 1`,
    [rut, agent || null, id]
  );

  await pool.query(
    `UPDATE admins
     SET rut = ?, email = ?, name = ?, phone = ?, updated_at = NOW()
     WHERE rut = ?`,
    [rut, email, full_name || null, phone || null, currentRut]
  );

  return result.affectedRows > 0;
}

async function deleteUserById(id) {
  const pool = await poolPromise;
  const [rows] = await pool.query(
    'SELECT rut FROM users WHERE id = ? AND role_id = 1',
    [id]
  );
  if (rows.length === 0) return false;
  const { rut } = rows[0];

  await pool.query('DELETE FROM admins WHERE rut = ?', [rut]);

  const [result] = await pool.query(
    `DELETE FROM users WHERE id = ? AND role_id = 1`,
    [id]
  );
  return result.affectedRows > 0;
}

async function resetAdminPassword(id, newPassword = '123456') {
  const pool = await poolPromise;
  const hashed = await bcrypt.hash(newPassword, 10);
  const [result] = await pool.query(
    `UPDATE users SET password = ?, change_pw = 1, updated_at = NOW() WHERE id = ? AND role_id = 1`,
    [hashed, id]
  );
  return result.affectedRows > 0;
}


// Verificar si hay al menos un administrador en línea
module.exports = {
  getAllUsers,
  findUserByEmailOrUsername,
  findUserForPasswordRecovery,
  findUserById,
  findCustomerIdByRut,
  updateUserOnlineStatus,
  getPrimaryAdminPresence,
  getSpecificAdminPresence,
  findUserForAuth,
  getUserProfile,
  updateUserProfile,
  createUser,
  updateUser2FASecret,
  getAdminUsers,
  getAdminUserById,
  getAdminNotificationRecipients,
  createAdminUser,
  updateAdminUser,
  deleteUserById,
  resetAdminPassword,
};
