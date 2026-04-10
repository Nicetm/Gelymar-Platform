const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { getPool, getConfig } = require('../config/database');

exports.login = async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'Usuario y contraseña requeridos' });
  }

  try {
    const pool = getPool();
    if (!pool) return res.status(500).json({ message: 'Base de datos no conectada. Configure un ambiente primero.' });

    const [rows] = await pool.query(
      `SELECT u.id, u.rut, u.password, u.role_id, u.bloqueado,
              a.name AS full_name
       FROM users u
       LEFT JOIN admins a ON u.rut COLLATE utf8mb4_general_ci = a.rut COLLATE utf8mb4_general_ci
       WHERE REPLACE(LOWER(TRIM(u.rut)), '.', '') = REPLACE(LOWER(TRIM(?)), '.', '')
       LIMIT 1`,
      [username]
    );

    if (!rows.length) {
      console.log('[AUTH] No user found for:', username);
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const user = rows[0];
    console.log('[AUTH] Found user:', { id: user.id, rut: user.rut, role_id: user.role_id, bloqueado: user.bloqueado });

    if (Number(user.bloqueado) === 1) {
      return res.status(403).json({ message: 'Cuenta bloqueada' });
    }

    const valid = await bcrypt.compare(password, user.password);
    console.log('[AUTH] Password valid:', valid);
    if (!valid) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    if (user.role_id !== 1) {
      console.log('[AUTH] Not admin, role_id:', user.role_id);
      return res.status(403).json({ message: 'Acceso restringido a administradores' });
    }

    const config = getConfig();
    const token = jwt.sign(
      { id: user.id, rut: user.rut, fullName: user.full_name, roleId: user.role_id },
      config.jwtSecret || 'super-admin-panel-secret-change-me',
      { expiresIn: '8h' }
    );

    res.json({ token, user: { id: user.id, rut: user.rut, fullName: user.full_name } });
  } catch (err) {
    res.status(500).json({ message: 'Error en login: ' + err.message });
  }
};

exports.me = async (req, res) => {
  res.json({ user: req.user });
};
