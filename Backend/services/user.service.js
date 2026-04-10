// services/user.service.js
const { poolPromise } = require('../config/db');
const { getSqlPool, sql } = require('../config/sqlserver');
const { logger } = require('../utils/logger');
const Users = require('../models/user.model');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

async function getSqlCustomerByRut(rut) {
  if (!rut) return null;
  const pool = await getSqlPool();
  const request = pool.request();
  const rawRut = String(rut).trim();
  const hasTrailingC = rawRut.toLowerCase().endsWith('c');
  const altRut = hasTrailingC ? rawRut.slice(0, -1) : `${rawRut}C`;
  request.input('rut', sql.VarChar, rawRut);
  request.input('rutAlt', sql.VarChar, altRut);
  const result = await request.query(`
    SELECT TOP 1
      Rut,
      Nombre,
      Ciudad,
      Pais,
      Telefono,
      Correo
    FROM jor_imp_CLI_01_softkey
    WHERE (Rut = @rut OR Rut = @rutAlt)
      AND LTRIM(RTRIM(EstadoCliente)) = 'Activo'
  `);
  return result.recordset?.[0] || null;
}

async function getSqlCustomerByEmail(email) {
  if (!email) return null;
  const pool = await getSqlPool();
  const request = pool.request();
  request.input('email', sql.VarChar, String(email).trim().toLowerCase());
  const result = await request.query(`
    SELECT TOP 1
      Rut,
      Nombre,
      Ciudad,
      Pais,
      Telefono,
      Correo
    FROM jor_imp_CLI_01_softkey
    WHERE LOWER(Correo) = @email
      AND LTRIM(RTRIM(EstadoCliente)) = 'Activo'
  `);
  return result.recordset?.[0] || null;
}

async function getSqlSellerByRut(rut) {
  if (!rut) return null;
  const rawRut = String(rut).trim();
  const pool = await poolPromise;
  const normalizedRut = rawRut.toLowerCase().replace(/\./g, '').trim();
  const [sellerRows] = await pool.query(
    `SELECT codigo
     FROM sellers
     WHERE REPLACE(LOWER(TRIM(rut)), '.', '') = ?
     LIMIT 1`,
    [normalizedRut]
  );
  const sellerCode = sellerRows?.[0]?.codigo ? String(sellerRows[0].codigo).trim() : '';

  const sqlPool = await getSqlPool();
  const request = sqlPool.request();
  if (sellerCode) {
    const isNumericCode = /^[0-9]+$/.test(sellerCode);
    request.input('slpCode', isNumericCode ? sql.Int : sql.VarChar, isNumericCode ? Number(sellerCode) : sellerCode);
    const result = await request.query(`
      SELECT TOP 1
        Rut,
        SlpName,
        SlpCode
      FROM jor_imp_VEND_90_softkey
      WHERE SlpCode = @slpCode
    `);
    const record = result.recordset?.[0] || null;
    return record;
  }

  const hasTrailingC = rawRut.toLowerCase().endsWith('c');
  const altRut = hasTrailingC ? rawRut.slice(0, -1) : `${rawRut}C`;
  request.input('rut', sql.VarChar, rawRut);
  request.input('rutAlt', sql.VarChar, altRut);
  const fallback = await request.query(`
    SELECT TOP 1
      Rut,
      SlpName,
      SlpCode
    FROM jor_imp_VEND_90_softkey
    WHERE Rut = @rut OR Rut = @rutAlt
  `);
  const record = fallback.recordset?.[0] || null;
  return record;
}

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
           u.twoFASecret, u.twoFAEnabled, u.change_pw, u.bloqueado,
           a.name AS admin_name,
           a.phone AS admin_phone,
           a.country AS admin_country,
           a.city AS admin_city,
           a.address AS admin_address,
           r.name AS role
    FROM users u
    LEFT JOIN roles r ON u.role_id = r.id
    LEFT JOIN admins a ON u.rut COLLATE utf8mb4_general_ci = a.rut COLLATE utf8mb4_general_ci
    WHERE REPLACE(LOWER(TRIM(u.rut)), '.', '') COLLATE utf8mb4_general_ci
      = ? COLLATE utf8mb4_general_ci
    LIMIT 1
  `;
  logger.info(`[findUserByEmailOrUsername] input=${emailOrUsername} normalized=${normalized}`);
  logger.info(`[findUserByEmailOrUsername] params=${JSON.stringify([normalized])}`);

  const [rows] = await pool.query(query, [normalized]);
  const user = rows[0];
  if (!user) return null;

  let sqlCustomer = null;
  let sqlSeller = null;
  if (user.role_id === 3 && !user.admin_name) {
    sqlSeller = await getSqlSellerByRut(user.rut);
  }
  if (user.role_id === 2 || (!user.admin_name && !sqlSeller?.SlpName)) {
    sqlCustomer = await getSqlCustomerByRut(user.rut);
  }

  return {
    ...user,
    seller_name: sqlSeller?.SlpName || null,
    full_name: user.admin_name || sqlSeller?.SlpName || sqlCustomer?.Nombre || null,
    phone: user.admin_phone || sqlCustomer?.Telefono || null,
    country: user.admin_country || sqlCustomer?.Pais || null,
    city: user.admin_city || sqlCustomer?.Ciudad || null,
    address: user.admin_address || sqlCustomer?.Direccion || null,
    customer_email: sqlCustomer?.Correo || null,
  };
}

// Buscar usuario para recuperacion de contrasena usando correo real (admins.email o clientes en SQL: jor_imp_CLI_01_softkey.Correo)
async function findUserForPasswordRecovery(email) {
  const pool = await poolPromise;
  const normalizedEmail = (email || '').trim().toLowerCase();

  // 1) Admin email
  const [adminRows] = await pool.query(
    `
    SELECT u.id, u.rut AS rut, u.password, u.role_id,
           u.twoFASecret, u.twoFAEnabled, u.change_pw,
           a.name AS admin_name,
           a.phone AS admin_phone,
           a.country AS admin_country,
           a.city AS admin_city,
           a.address AS admin_address,
           a.email AS admin_email,
           r.name AS role
    FROM users u
    LEFT JOIN roles r ON u.role_id = r.id
    LEFT JOIN admins a ON u.rut COLLATE utf8mb4_general_ci = a.rut COLLATE utf8mb4_general_ci
    WHERE LOWER(a.email) = ?
    LIMIT 1
    `,
    [normalizedEmail]
  );
  if (adminRows[0]) {
    return {
      ...adminRows[0],
      full_name: adminRows[0].admin_name || null,
      phone: adminRows[0].admin_phone || null,
      country: adminRows[0].admin_country || null,
      city: adminRows[0].admin_city || null,
      address: adminRows[0].admin_address || null,
    };
  }

  // 2) RUT login
  const byRut = await findUserByEmailOrUsername(email);
  if (byRut) return byRut;

  // 3) Customer email (SQL view)
  const sqlCustomer = await getSqlCustomerByEmail(normalizedEmail);
  if (!sqlCustomer?.Rut) return null;

  const [userRows] = await pool.query(
    `
    SELECT u.id, u.rut AS rut, u.password, u.role_id,
           u.twoFASecret, u.twoFAEnabled, u.change_pw,
           r.name AS role
    FROM users u
    LEFT JOIN roles r ON u.role_id = r.id
    WHERE u.rut = ?
    LIMIT 1
    `,
    [sqlCustomer.Rut]
  );

  if (!userRows[0]) return null;

  return {
    ...userRows[0],
    full_name: sqlCustomer.Nombre || null,
    phone: sqlCustomer.Telefono || null,
    country: sqlCustomer.Pais || null,
    city: sqlCustomer.Ciudad || null,
    customer_email: sqlCustomer.Correo || null,
  };
}

async function findUserById(id) {
  const pool = await poolPromise;
  const [rows] = await pool.query(
    `
    SELECT u.id, u.rut AS rut, u.password, u.role_id,
           u.twoFASecret, u.twoFAEnabled, u.change_pw,
           a.name AS admin_name,
           a.phone AS admin_phone,
           a.country AS admin_country,
           a.city AS admin_city,
           a.address AS admin_address,
           a.email AS admin_email,
           r.name AS role
    FROM users u
    LEFT JOIN roles r ON u.role_id = r.id
    LEFT JOIN admins a ON u.rut COLLATE utf8mb4_general_ci = a.rut COLLATE utf8mb4_general_ci
    WHERE u.id = ?
    LIMIT 1
    `,
    [id]
  );

  const user = rows[0];
  if (!user) return null;
  let sqlCustomer = null;
  let sqlSeller = null;
  if (user.role_id === 3 && !user.admin_name) {
    sqlSeller = await getSqlSellerByRut(user.rut);
  }
  if (user.role_id === 2 || (!user.admin_name && !sqlSeller?.SlpName)) {
    sqlCustomer = await getSqlCustomerByRut(user.rut);
  }

  return {
    ...user,
    seller_name: sqlSeller?.SlpName || null,
    full_name: user.admin_name || sqlSeller?.SlpName || sqlCustomer?.Nombre || null,
    phone: user.admin_phone || sqlCustomer?.Telefono || null,
    country: user.admin_country || sqlCustomer?.Pais || null,
    city: user.admin_city || sqlCustomer?.Ciudad || null,
    address: user.admin_address || sqlCustomer?.Direccion || null,
    customer_email: sqlCustomer?.Correo || null,
  };
}

// Buscar customer_id por RUT
async function findCustomerIdByRut(rut) {
  const sqlCustomer = await getSqlCustomerByRut(rut);
  return sqlCustomer?.Rut || null;
}

// Actualizar estado online del usuario
async function updateUserOnlineStatus(userId, onlineStatus) {
  const pool = await poolPromise;
  const [result] = await pool.query('UPDATE users SET online = ? WHERE id = ?', [onlineStatus, userId]);
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

  const { name, email, online } = rows[0];
  const displayName = (name && name.trim()) || email || 'Administrador';
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

  const { name, email, online } = rows[0];
  const displayName = (name && name.trim()) || email || 'Administrador';
  return { online: online === 1 || online === true, name: displayName };
}

// Buscar usuario completo con roles y customer info para autenticación
async function findUserForAuth(userId) {
  const pool = await poolPromise;
  const [rows] = await pool.query(
    `SELECT u.id, u.rut AS rut, u.role_id, r.name AS role, u.twoFAEnabled, u.twoFASecret
     FROM users u
     LEFT JOIN roles r ON u.role_id = r.id
     WHERE u.id = ?`,
    [userId]
  );
  const user = rows[0];
  if (!user) return null;
  if (user.role_id === 2) {
    const sqlCustomer = await getSqlCustomerByRut(user.rut);
    return {
      ...user,
      customer_id: sqlCustomer?.Rut || null,
      customer_rut: sqlCustomer?.Rut || null,
    };
  }
  return user;
}

// Obtener perfil completo del usuario con avatar
async function getUserProfile(userId) {
  const pool = await poolPromise;
  
  const [rows] = await pool.query(
    `
    SELECT u.id, u.rut AS rut, u.role_id,
           a.name AS admin_name,
           a.phone AS admin_phone,
           a.country AS admin_country,
           a.city AS admin_city,
           a.address AS admin_address,
           u.created_at, u.updated_at, u.change_pw,
           a.email AS admin_email,
           r.name AS role,
           ua.file_path AS avatar_path, ua.mime_type AS avatar_mime_type
    FROM users u
    LEFT JOIN roles r ON u.role_id = r.id
    LEFT JOIN admins a ON u.rut COLLATE utf8mb4_general_ci = a.rut COLLATE utf8mb4_general_ci
    LEFT JOIN user_avatar ua ON u.id = ua.user_id AND ua.is_active = 1
    WHERE u.id = ?
    LIMIT 1
    `,
    [userId]
  );
  
  const user = rows[0];
  if (!user) return null;
  let sqlCustomer = null;
  let sqlSeller = null;
  const roleId = Number(user.role_id);
  if (roleId === 3 && !user.admin_name) {
    sqlSeller = await getSqlSellerByRut(user.rut);
  }
  if (roleId === 2 || (!user.admin_name && !sqlSeller?.SlpName)) {
    sqlCustomer = await getSqlCustomerByRut(user.rut);
  }

  return {
    ...user,
    seller_name: sqlSeller?.SlpName || null,
    full_name: user.admin_name || sqlSeller?.SlpName || sqlCustomer?.Nombre || null,
    phone: user.admin_phone || sqlCustomer?.Telefono || null,
    country: user.admin_country || sqlCustomer?.Pais || null,
    city: user.admin_city || sqlCustomer?.Ciudad || null,
    address: user.admin_address || sqlCustomer?.Direccion || null,
    email: user.admin_email || sqlCustomer?.Correo || null,
  };
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
       SET name = ?, phone = ?, country = ?, city = ?, address = ?, updated_at = NOW()
       WHERE rut = ?`,
      [profileData.full_name, profileData.phone, profileData.country, profileData.city, profileData.address, rut]
    );
    return result.affectedRows > 0;
  }

  if (role_id === 2) {
    logger.warn(`[updateUserProfile] customer profile update blocked (read-only SQL view). rut=${rut}`);
    return false;
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
    `SELECT u.id, u.rut, a.email, a.name AS full_name, a.phone, u.agent,
            COALESCE(u.bloqueado, 0) AS bloqueado,
            COALESCE(u.intentos_fallidos, 0) AS intentos_fallidos
     FROM users u
     JOIN admins a ON u.rut = a.rut
     WHERE u.role_id = 1
     ORDER BY u.id ASC`
  );
  return rows;
}

async function getAdminPresenceList() {
  const pool = await poolPromise;
  const [rows] = await pool.query(
    `SELECT u.id, u.rut, u.online, a.name AS full_name, a.email,
            ua.file_path AS avatar_path
     FROM users u
     JOIN admins a ON u.rut = a.rut
     LEFT JOIN user_avatar ua ON u.id = ua.user_id AND ua.is_active = 1
     WHERE u.role_id = 1
     ORDER BY u.online DESC, a.name ASC`
  );
  return rows.map((row) => ({
    id: row.id,
    rut: row.rut,
    online: row.online === 1 || row.online === true,
    full_name: row.full_name,
    email: row.email,
    avatar_path: row.avatar_path
  }));
}

async function getAdminUserById(adminId) {
  const pool = await poolPromise;
  const [rows] = await pool.query(
    'SELECT u.id, u.online, a.email, a.name FROM users u JOIN admins a ON u.rut = a.rut WHERE u.id = ? AND u.role_id = 1',
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
    `INSERT INTO admins (uuid, rut, email, name, phone, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, NOW(), NOW())
     ON DUPLICATE KEY UPDATE
       email = VALUES(email),
       name = VALUES(name),
       phone = VALUES(phone),
       updated_at = NOW()`,
    [uuidv4(), rut, email, full_name || null, phone || null]
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

async function resetAdminPassword(id, newPassword = '12345') {
  const pool = await poolPromise;
  const hashed = await bcrypt.hash(newPassword, 10);
  const [result] = await pool.query(
    `UPDATE users SET password = ?, change_pw = 0, updated_at = NOW() WHERE id = ? AND role_id = 1`,
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
  getAdminPresenceList,
  getAdminUserById,
  getAdminNotificationRecipients,
  createAdminUser,
  updateAdminUser,
  deleteUserById,
  resetAdminPassword,
};


/**
 * Actualiza el estado de bloqueo de un usuario por RUT
 * @param {string} rut - RUT del usuario (sin dígito verificador)
 * @param {number} blocked - Estado de bloqueo (0 = desbloqueado, 1 = bloqueado)
 * @returns {Promise<boolean>} - true si se actualizó, false si no se encontró
 */
async function updateBlockedStatus(rut, blocked) {
  logger.info(`[updateBlockedStatus] Inicio - rut=${rut}, blocked=${blocked}`);
  const pool = await poolPromise;
  const blockedVal = Number(blocked);
  let query;
  let params;
  if (blockedVal === 0) {
    // Al desbloquear, resetear también intentos_fallidos
    query = 'UPDATE users SET bloqueado = 0, intentos_fallidos = 0 WHERE rut = ?';
    params = [rut];
  } else {
    query = 'UPDATE users SET bloqueado = ? WHERE rut = ?';
    params = [blockedVal, rut];
  }
  logger.info(`[updateBlockedStatus] Query: ${query}, params: [${params.join(', ')}]`);
  const [result] = await pool.query(query, params);
  logger.info(`[updateBlockedStatus] Resultado - affectedRows: ${result.affectedRows}`);
  return result.affectedRows > 0;
}

module.exports = {
  getSqlCustomerByRut,
  getSqlCustomerByEmail,
  getSqlSellerByRut,
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
  getAdminPresenceList,
  getAdminUserById,
  getAdminNotificationRecipients,
  createAdminUser,
  updateAdminUser,
  deleteUserById,
  resetAdminPassword,
  updateBlockedStatus
};
