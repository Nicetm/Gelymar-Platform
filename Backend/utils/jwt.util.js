const jwt = require('jsonwebtoken');

/**
 * Genera un token JWT válido por 1 hora
 */
const generateToken = (user) => {
  const rut = user.rut || user.email;
  const payload = {
    id: user.id,
    rut,
    role: user.role,
  };

  if (user.roleId !== undefined) {
    payload.roleId = user.roleId;
  } else if (user.role_id !== undefined) {
    payload.roleId = user.role_id;
  }

  if (user.cardCode !== undefined) {
    payload.cardCode = user.cardCode;
  }

  if (user.username !== undefined) {
    payload.username = user.username;
  }

  if (user.email !== undefined) {
    payload.email = user.email;
  }

  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
};

const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
};

module.exports = { generateToken, verifyToken };
