const userService = require('../services/user.service');

/**
 * @route GET /api/users
 * @desc Retorna todos los clientes
 * @access Protegido (requiere JWT)
 */
exports.getAllUsers = async (req, res) => {
  try {
    const users = await userService.getAllUsers();
    res.json(users);
  } catch (error) {
    console.error('Error al obtener clientes:', error);
    res.status(500).json({ message: 'Error al obtener clientes desde la base de datos' });
  }
};