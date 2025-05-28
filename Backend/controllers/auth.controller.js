const { generateToken } = require('../utils/jwt.util');
const users = require('../dummy/users.json');
const bcrypt = require('bcrypt');

exports.login = async (req, res) => {
  const { email, password } = req.body;

  const user = users.find(u => u.email === email);
  if (!user) {
    return res.status(401).json({ message: 'Usuario no encontrado' });
  }

  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) {
    return res.status(401).json({ message: 'Contraseña incorrecta' });
  }

  const token = generateToken({
    id: user.id,
    email: user.email,
    username: user.username || null,
    role: user.role,
    cardCode: user.cardCode || null
  });

  res.json({ token });
};
