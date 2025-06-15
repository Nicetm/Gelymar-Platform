const customerService = require('../services/customer.service');
const logger = require('@utils/logger');

/**
 * @route GET /api/customers
 * @desc Retorna todos los clientes
 * @access Protegido (requiere JWT)
 */
exports.getAllCustomers = async (req, res) => {
  logger.info('Petición recibida: obtener todos los clientes');

  try {
    const customers = await customerService.getAllCustomers();
    logger.info(`Se obtuvieron ${customers.length} clientes`);
    res.json(customers);
  } catch (error) {
    logger.error(`Error al obtener clientes: ${error.message}`);
    res.status(500).json({ message: 'Error al obtener clientes desde la base de datos' });
  }
};

/**
 * @route GET /api/customers/:id
 * @desc Retorna un cliente específico por ID
 * @access Protegido (requiere JWT)
 */
exports.getCustomerById = async (req, res) => {
  const { id } = req.params;
  logger.info(`Petición recibida: obtener cliente por ID ${id}`);

  try {
    const customer = await customerService.getCustomerById(id);

    if (!customer) {
      logger.warn(`Cliente no encontrado con ID ${id}`);
      return res.status(404).json({ message: 'Cliente no encontrado' });
    }

    logger.info(`Cliente encontrado: ID ${id}`);
    res.json(customer);
  } catch (error) {
    logger.error(`Error al obtener cliente por ID: ${error.message}`);
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
  logger.info(`Petición recibida: obtener cliente por UUID ${uuid}`);

  try {
    const customer = await customerService.getCustomerByUUID(uuid);

    if (!customer) {
      logger.warn(`Cliente no encontrado con UUID ${uuid}`);
      return res.status(404).json({ message: 'Cliente no encontrado' });
    }

    logger.info(`Cliente encontrado: UUID ${uuid}`);
    res.json(customer);
  } catch (error) {
    logger.error(`Error al obtener cliente por UUID: ${error.message}`);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};
