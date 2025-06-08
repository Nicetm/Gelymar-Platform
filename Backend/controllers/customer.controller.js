const customerService = require('../services/customer.service');

/**
 * @route GET /api/customers
 * @desc Retorna todos los clientes
 * @access Protegido (requiere JWT)
 */
exports.getAllCustomers = async (req, res) => {
  try {
    const customers = await customerService.getAllCustomers();
    res.json(customers);
  } catch (error) {
    console.error('Error al obtener clientes:', error);
    res.status(500).json({ message: 'Error al obtener clientes desde la base de datos' });
  }
};

/**
 * @route GET /api/customers/:id
 * @desc Retorna un cliente específico por ID
 * @access Protegido (requiere JWT)
 */
exports.getCustomerById = async (req, res) => {
  try {
    const customer = await customerService.getCustomerById(req.params.id);

    if (!customer) {
      return res.status(404).json({ message: 'Cliente no encontrado' });
    }

    res.json(customer);
  } catch (error) {
    console.error('Error al obtener cliente:', error);
    res.status(500).json({ message: 'Error al obtener cliente desde la base de datos' });
  }
};

/**
 * @route GET /api/customers/uuid/:uuid
 * @desc Retorna un cliente por UUID
 * @access Protegido (requiere JWT)
 */
exports.getCustomerByUUID = async (req, res) => {
  const { uuid } = req.params;

  try {
    const customer = await customerService.getCustomerByUUID(uuid);
    if (!customer) {
      return res.status(404).json({ message: 'Cliente no encontrado' });
    }
    res.json(customer);
  } catch (error) {
    console.error('Error al obtener cliente por UUID:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

