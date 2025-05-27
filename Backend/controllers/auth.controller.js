const { generateToken } = require('../utils/jwt.util');
const users = require('../dummy/users.json');

/**
 * @route POST /api/auth/login
 * @desc Login ficticio para pruebas, retorna JWT
 * @access Público
 */
exports.login = (req, res) => {
  const { username, password } = req.body;

  // Buscar usuario en el dummy JSON
  const user = users.find(
    (u) => u.username === username && u.password === password
  );

  if (!user) {
    return res.status(401).json({ message: 'Credenciales inválidas' });
  }

  // Generar token
  const token = generateToken({
    id: user.id,
    username: user.username,
    role: user.role
  });

  res.json({ token });
};
