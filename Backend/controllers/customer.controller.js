const { container } = require('../config/container');
const customerService = container.resolve('customerService');
const userService = container.resolve('userService');
const { logger } = require('../utils/logger');
const bcrypt = require('bcrypt');

/**
 * @route GET /api/customers
 * @desc Retorna todos los clientes
 * @access Protegido (requiere JWT)
 */
exports.getAllCustomers = async (req, res) => {
  try {
    const options = {};
    const roleId = req.user?.role_id || req.user?.roleId;
    if (roleId === 3 || req.user?.role === 'seller') {
      options.salesRut = req.user?.rut || null;
    }

    logger.info(`[getAllCustomers] request role=${req.user?.role || 'N/A'} rut=${req.user?.rut || 'N/A'} salesRut=${options.salesRut || 'N/A'}`);
    const customers = await customerService.getAllCustomers(options);
    res.json(customers);
  } catch (error) {
    logger.error(`[getAllCustomers] Error: ${error.message}`);
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
  try {
    const customer = await customerService.getCustomerById(id);

    if (!customer) {
      return res.status(404).json({ message: 'Cliente no encontrado' });
    }
    res.json(customer);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener cliente desde la base de datos' });
  }
};

/**
 * @route GET /api/customers/rut/:rut
 * @desc Retorna un cliente por RUT
 * @access Protegido (requiere JWT)
 */
exports.getCustomerByRut = async (req, res) => {
  const rut = req.params.rut || req.params.uuid;

  try {
    logger.info(`[getCustomerByRut] request rut=${rut || 'N/A'}`);
    const customer = await customerService.getCustomerByRutFromSql(rut);

    if (!customer) {
      logger.warn(`[getCustomerByRut] Cliente no encontrado RUT: ${rut || 'N/A'}`);
      return res.status(404).json({ message: 'Cliente no encontrado' });
    }
    res.json(customer);
  } catch (error) {
    logger.error(`[getCustomerByRut] Error obteniendo cliente RUT=${rut || 'N/A'}: ${error.message}`);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

/**
 * @route POST /api/customers/contacts
 * @desc Crea un contacto para un cliente
 * @access Protegido (requiere JWT)
 */
exports.createCustomerContact = async (req, res) => {
  const customer_rut = req.body.customer_rut || req.body.customer_uuid;
  const contacts = req.body.contacts;
  logger.info(`[createCustomerContact] payload rut=${customer_rut || 'N/A'} contactsType=${Array.isArray(contacts) ? 'array' : typeof contacts}`);
  if (!customer_rut || !Array.isArray(contacts) || contacts.length === 0) {
    logger.warn(`[createCustomerContact] invalid payload rut=${customer_rut || 'N/A'} contactsLength=${Array.isArray(contacts) ? contacts.length : 'N/A'}`);
    return res.status(400).json({ message: 'Debe enviar el customer_rut y al menos un contacto' });
  }

  try {
    await customerService.createCustomerContacts(customer_rut, contacts);
    logger.info(`[createCustomerContact] contacts saved rut=${customer_rut} count=${contacts.length}`);
    res.status(201).json({ message: 'Contactos creados correctamente' });
  } catch (error) {
    logger.error(`[createCustomerContact] Error rut=${customer_rut || 'N/A'}: ${error.message}`);
    res.status(500).json({ message: 'Error al crear contactos' });
  }
};

exports.getCustomerContacts = async (req, res) => {
  const rut = req.params.rut || req.params.uuid;
  try {
    const contacts = await customerService.getContactsByCustomerRut(rut);
    res.json(contacts);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener contactos' });
  }
};

/**
 * @route DELETE /api/customers/contacts/:contactId
 * @desc Elimina un contacto de un cliente
 * @access Protegido (requiere JWT)
 */
exports.deleteCustomerContact = async (req, res) => {
  const customerRut = req.params.customerRut || req.params.customerUuid;
  const contactIdx = Number(req.params.contactIdx ?? req.params.contactId);
  if (!Number.isInteger(contactIdx)) {
    return res.status(400).json({ message: 'contactId inválido' });
  }
  
  try {
    await customerService.deleteCustomerContact(customerRut, contactIdx);
    res.json({ message: 'Contacto eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error al eliminar contacto' });
  }
};

exports.updateCustomerContact = async (req, res) => {
  const customerRut = req.params.customerRut || req.params.customerUuid;
  const contactIdx = Number(req.params.contactIdx ?? req.params.contactId);
  const { nombre, email, telefono, sh_documents, reports, cco } = req.body;

  logger.info(`[updateCustomerContact] request rut=${customerRut || 'N/A'} contactIdx=${req.params.contactIdx || req.params.contactId || 'N/A'} name=${nombre ? 'Y' : 'N'} email=${email ? 'Y' : 'N'}`);
  if (!Number.isInteger(contactIdx)) {
    logger.warn(`[updateCustomerContact] invalid contactId=${req.params.contactIdx || req.params.contactId || 'N/A'} rut=${customerRut || 'N/A'}`);
    return res.status(400).json({ message: 'contactId inválido' });
  }

  if (!nombre || !email) {
    logger.warn(`[updateCustomerContact] missing fields rut=${customerRut || 'N/A'} nombre=${nombre ? 'Y' : 'N'} email=${email ? 'Y' : 'N'}`);
    return res.status(400).json({ message: 'El nombre y el email son obligatorios' });
  }

  try {
    const updated = await customerService.updateCustomerContact(customerRut, contactIdx, {
      nombre,
      email,
      telefono,
      sh_documents,
      reports,
      cco
    });

    res.json({ message: 'Contacto actualizado correctamente', contact: updated });
  } catch (error) {
    logger.error(`[updateCustomerContact] Error rut=${customerRut || 'N/A'} contactIdx=${contactIdx}: ${error.message}`);
    res.status(500).json({ message: error.message || 'Error al actualizar contacto' });
  }
};

/**
 * @route PATCH /api/customers/:rut
 * @desc Actualiza un cliente por RUT
 * @access Protegido (requiere JWT)
 */
exports.updateCustomer = async (req, res) => {
  const rut = req.params.rut || req.params.uuid;
  const updateData = req.body;
  
  try {
    const updatedCustomer = await customerService.updateCustomerByRut(rut, updateData);
    
    if (!updatedCustomer) {
      return res.status(404).json({ message: 'Cliente no encontrado' });
    }

    res.json(updatedCustomer);
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar cliente' });
  }
};

/**
 * @route PATCH /api/customers/change-password/:rut
 * @desc Cambia la contraseña del usuario asociado al cliente
 * @access Protegido (requiere JWT)
 */
exports.changeCustomerPassword = async (req, res) => {
  const rawRut = req.params.rut || req.params.uuid;
  const rut = rawRut ? String(rawRut).trim() : rawRut;
  const normalizedRut = rut ? rut.replace(/C$/i, '') : rut;
  const { password } = req.body;
  
  try {
    logger.info(`[changeCustomerPassword] request rut=${rut || 'N/A'} normalized=${normalizedRut || 'N/A'} hasPassword=${password ? 'Y' : 'N'}`);
    // Validar que se proporcione la contraseña
    if (!password) {
      logger.warn(`[changeCustomerPassword] missing password rut=${rut || 'N/A'}`);
      return res.status(400).json({ message: 'La contraseña es requerida' });
    }
  
    const isStrongPassword =
      password.length >= 8 &&
      /[A-Z]/.test(password) &&
      /[a-z]/.test(password) &&
      /[0-9]/.test(password);
    if (!isStrongPassword) {
      logger.warn(`[changeCustomerPassword] weak password rut=${rut || 'N/A'}`);
      return res.status(400).json({
        message: 'La contraseña debe tener al menos 8 caracteres e incluir mayúscula, minúscula y número'
      });
    }

    // Obtener el cliente por RUT desde SQL
    const customer = await customerService.getCustomerByRutFromSql(rut);
    if (!customer) {
      logger.warn(`[changeCustomerPassword] customer not found rut=${rut || 'N/A'}`);
      return res.status(404).json({ message: 'Cliente no encontrado' });
    }

    // Buscar el usuario asociado (users.rut = clientes en SQL: jor_imp_CLI_01_softkey.Rut)
    const { poolPromise } = require('../config/db');
    const pool = await poolPromise;
    
    const [users] = await pool.query(
      'SELECT id, rut FROM users WHERE rut = ?',
      [normalizedRut || customer.rut]
    );

    if (users.length === 0) {
      logger.warn(`[changeCustomerPassword] user not found for rut=${normalizedRut || customer.rut}`);
      return res.status(404).json({ message: 'Usuario no encontrado para este cliente' });
    }

    const user = users[0];

    // Hashear la nueva contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // Actualizar la contraseña en la base de datos
    await pool.query(
      'UPDATE users SET password = ?, change_pw = 1 WHERE id = ?',
      [hashedPassword, user.id]
    );

    res.json({ message: 'Contraseña actualizada exitosamente' });

  } catch (error) {
    res.status(500).json({ message: 'Error al cambiar contraseña' });
  }
};

/**
 * @route GET /api/customers/without-account
 * @desc Obtiene lista de clientes sin cuenta de usuario
 * @access Protegido (requiere JWT)
 */
exports.getCustomersWithoutAccount = async (req, res) => {

  try {
    const customers = await customerService.getCustomersWithoutAccount();
    res.json({ customers });
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener clientes sin cuenta desde la base de datos' });
  }
};


exports.createCustomerAccount = async (req, res) => {
  try {
    const { customerId } = req.params;
    const { customerName, customerRut } = req.body;
    const requestedRut = customerId || customerRut;
    logger.info(`[createCustomerAccount] request paramId=${customerId || 'N/A'} bodyRut=${customerRut || 'N/A'} resolvedRut=${requestedRut || 'N/A'} name=${customerName ? 'Y' : 'N'}`);
    
    // Obtener datos del cliente por RUT
    const customer = await customerService.getCustomerByRut(requestedRut);
    if (!customer) {
      logger.warn(`[createCustomerAccount] Cliente no encontrado rut=${requestedRut || 'N/A'}`);
      return res.status(404).json({ message: 'Cliente no encontrado' });
    }
    
    const bcrypt = require('bcrypt');
    // userService ya provisto por DI
    
    // Generar contraseña por defecto
    const defaultPassword = '123456';
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);
    
    // Crear usuario usando el servicio
    
    const normalizedRut = customer?.rut ? String(customer.rut).trim().replace(/C$/i, '') : '';
    const userData = {
      rut: normalizedRut,
      password: hashedPassword,
      role_id: 2, // role_id = 2 (cliente)
      full_name: customer.name || 'Cliente',
      phone: customer.phone || null,
      country: customer.country || null,
      city: customer.city || null,
      twoFASecret: null
    };
    
    const userId = await userService.createUser(userData);
    logger.info(`[createCustomerAccount] user created id=${userId} rut=${userData.rut || 'N/A'}`);
    
    res.json({ 
      message: 'Cuenta creada exitosamente',
      userId: userId,
      customerName: customer.name,
      customerRut: customer.rut
    });
    
  } catch (error) {
    res.status(500).json({ message: 'Error al crear cuenta de cliente' });
  }
};
