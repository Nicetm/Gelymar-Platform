// middleware/authFromCookie.js
const jwt = require('jsonwebtoken');

const authFromCookie = (req, res, next) => {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).send('No autorizado (token no encontrado)');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).send('Token inválido o expirado');
  }
};

module.exports = authFromCookie;