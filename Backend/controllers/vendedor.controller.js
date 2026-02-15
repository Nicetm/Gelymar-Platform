const { container } = require('../config/container');
const vendedorService = container.resolve('vendedorService');
const { logger } = require('../utils/logger');

/**
 * Obtiene todos los vendedores (usuarios con role_id = 3)
 */
exports.getVendedores = async (req, res) => {
  try {
    if (!req.user || Number(req.user.roleId) !== 1) {
      return res.status(403).json({ message: 'Acceso no autorizado - Solo administradores' });
    }

    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const vendedores = await vendedorService.getVendedores({ search });
    res.json(vendedores);
  } catch (error) {
    logger.error(`Error al obtener vendedores: ${error.message}`);
    res.status(500).json({ message: 'Error al obtener la lista de vendedores' });
  }
};
