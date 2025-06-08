// middleware/auth.middleware.js
const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.split(' ')[1];

  if (!token) return res.status(401).json({ message: 'Token requerido' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    return next();
  } catch (err) {
    // Permitir token expirado SOLO para la ruta /api/auth/refresh
    if (
      req.path === '/refresh' && // porque la ruta en auth.routes.js es '/refresh'
      err.name === 'TokenExpiredError'
    ) {
      const decoded = jwt.decode(token); // no verifica, solo extrae datos
      req.user = decoded;
      return next();
    }

    return res.status(403).json({ message: 'Token inválido o expirado' });
  }
};

