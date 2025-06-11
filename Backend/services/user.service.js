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
           u.twoFASecret, u.twoFAEnabled,
           r.name AS role
    FROM users u
    LEFT JOIN roles r ON u.role_id = r.id
    WHERE u.email = ?
    LIMIT 1
    `,
    [emailOrUsername, emailOrUsername]
  );
  return rows[0];
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
  createUser,
  updateUser2FASecret,
};