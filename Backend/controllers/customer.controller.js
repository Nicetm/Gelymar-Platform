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

/**
 * @route POST /api/customers/contacts
 * @desc Crea un contacto para un cliente
 * @access Protegido (requiere JWT)
 */
exports.createCustomerContact = async (req, res) => {
  const { customer_id, contacts } = req.body;
  if (!customer_id || !Array.isArray(contacts) || contacts.length === 0) {
    return res.status(400).json({ message: 'Debe enviar el customer_id y al menos un contacto' });
  }

  try {
    await customerService.createCustomerContacts(customer_id, contacts);
    res.status(201).json({ message: 'Contactos creados correctamente' });
  } catch (error) {
    logger.error(`Error al crear contactos: ${error.message}`);
    res.status(500).json({ message: 'Error al crear contactos' });
  }
};

exports.getCustomerContacts = async (req, res) => {
  const { uuid } = req.params;
  try {
    const contacts = await customerService.getContactsByCustomerUUID(uuid);
    res.json(contacts);
  } catch (error) {
    logger.error(`Error al obtener contactos: ${error.message}`);
    res.status(500).json({ message: 'Error al obtener contactos' });
  }
};

/**
 * @route PATCH /api/customers/:uuid
 * @desc Actualiza un cliente por UUID
 * @access Protegido (requiere JWT)
 */
exports.updateCustomer = async (req, res) => {
  const { uuid } = req.params;
  const updateData = req.body;
  
  logger.info(`Petición recibida: actualizar cliente con UUID ${uuid}`, updateData);

  try {
    const updatedCustomer = await customerService.updateCustomerByUUID(uuid, updateData);
    
    if (!updatedCustomer) {
      logger.warn(`Cliente no encontrado con UUID ${uuid}`);
      return res.status(404).json({ message: 'Cliente no encontrado' });
    }

    logger.info(`Cliente actualizado exitosamente: UUID ${uuid}`);
    res.json(updatedCustomer);
  } catch (error) {
    logger.error(`Error al actualizar cliente: ${error.message}`);
    res.status(500).json({ message: 'Error al actualizar cliente' });
  }
};
