const jwt = require('jsonwebtoken');

/**
 * Genera un token JWT válido por 1 hora
 */
const generateToken = (user) => {
  return jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '1h' });
};

module.exports = { generateToken };
