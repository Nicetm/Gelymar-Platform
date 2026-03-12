const { container } = require('../config/container');
const customerService = container.resolve('customerService');
const userService = container.resolve('userService');
const passwordService = container.resolve('passwordService');
const { logger } = require('../utils/logger');
const { normalizeRut } = require('../utils/rut.util');
const { t } = require('../i18n');

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
    res.status(500).json({ message: t('errors.get_customers_error', req.lang || 'es') });
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
      return res.status(404).json({ message: t('errors.customer_not_found', req.lang || 'es') });
    }
    res.json(customer);
  } catch (error) {
    res.status(500).json({ message: t('errors.get_customer_error', req.lang || 'es') });
  }
};

/**
 * @route GET /api/customers/rut/:rut
 * @desc Retorna un cliente por RUT
 * @access Protegido (requiere JWT)
 */
exports.getCustomerByRut = async (req, res) => {
    const rawRut = req.params.rut || req.params.uuid;
    const rut = normalizeRut(rawRut);
  
    try {
    const user = req.user || {};
    const userRole = String(user.role || '').toLowerCase();
    if (userRole === 'seller' || user.role_id === 3) {
      const allowed = await customerService.sellerHasAccessToCustomerRut(user.rut, rut);
      if (!allowed) {
        logger.warn(`[getCustomerByRut] acceso denegado role=${userRole || 'seller'} user=${user.rut || 'N/A'} rut=${rut || 'N/A'} path=${req.originalUrl || req.path}`);
        return res.status(403).json({ message: t('errors.access_denied', req.lang || 'es') });
      }
    }
    logger.info(`[getCustomerByRut] request rawRut=${rawRut || 'N/A'} normalizedRut=${rut || 'N/A'}`);
    const customer = await customerService.getCustomerByRutFromSql(rut);
  
      if (!customer) {
      logger.warn(`[getCustomerByRut] Cliente no encontrado RUT: ${rut || 'N/A'}`);
      return res.status(404).json({ message: t('errors.customer_not_found', req.lang || 'es') });
    }
    res.json(customer);
  } catch (error) {
    logger.error(`[getCustomerByRut] Error obteniendo cliente RUT=${rut || 'N/A'}: ${error.message}`);
    res.status(500).json({ message: t('errors.internal_server_error', req.lang || 'es') });
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
    return res.status(400).json({ message: t('errors.customer_rut_contacts_required', req.lang || 'es') });
  }

  try {
    await customerService.createCustomerContacts(customer_rut, contacts);
    logger.info(`[createCustomerContact] contacts saved rut=${customer_rut} count=${contacts.length}`);
    res.status(201).json({ message: t('success.contacts_created', req.lang || 'es') });
  } catch (error) {
    logger.error(`[createCustomerContact] Error rut=${customer_rut || 'N/A'}: ${error.message}`);
    res.status(500).json({ message: t('errors.create_contacts_error', req.lang || 'es') });
  }
};

exports.getCustomerContacts = async (req, res) => {
    const rut = req.params.rut || req.params.uuid;
    try {
      const user = req.user || {};
      const userRole = String(user.role || '').toLowerCase();
      if (userRole === 'seller' || user.role_id === 3) {
        const allowed = await customerService.sellerHasAccessToCustomerRut(user.rut, rut);
        if (!allowed) {
          logger.warn(`[getCustomerContacts] acceso denegado role=${userRole || 'seller'} user=${user.rut || 'N/A'} rut=${rut || 'N/A'} path=${req.originalUrl || req.path}`);
          return res.status(403).json({ message: t('errors.access_denied', req.lang || 'es') });
        }
      }
      const contacts = await customerService.getContactsByCustomerRut(rut);
      res.json(contacts);
    } catch (error) {
      res.status(500).json({ message: t('errors.get_contacts_error', req.lang || 'es') });
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
    return res.status(400).json({ message: t('errors.invalid_contact_id', req.lang || 'es') });
  }
  
  try {
    await customerService.deleteCustomerContact(customerRut, contactIdx);
    res.json({ message: t('success.contact_deleted', req.lang || 'es') });
  } catch (error) {
    res.status(500).json({ message: error.message || t('errors.delete_contact_error', req.lang || 'es') });
  }
};

exports.updateCustomerContact = async (req, res) => {
  const customerRut = req.params.customerRut || req.params.customerUuid;
  const contactIdx = Number(req.params.contactIdx ?? req.params.contactId);
  const { nombre, email, telefono, sh_documents, reports, cco } = req.body;

  logger.info(`[updateCustomerContact] request rut=${customerRut || 'N/A'} contactIdx=${req.params.contactIdx || req.params.contactId || 'N/A'} name=${nombre ? 'Y' : 'N'} email=${email ? 'Y' : 'N'}`);
  if (!Number.isInteger(contactIdx)) {
    logger.warn(`[updateCustomerContact] invalid contactId=${req.params.contactIdx || req.params.contactId || 'N/A'} rut=${customerRut || 'N/A'}`);
    return res.status(400).json({ message: t('errors.invalid_contact_id', req.lang || 'es') });
  }

  if (!nombre || !email) {
    logger.warn(`[updateCustomerContact] missing fields rut=${customerRut || 'N/A'} nombre=${nombre ? 'Y' : 'N'} email=${email ? 'Y' : 'N'}`);
    return res.status(400).json({ message: t('errors.name_email_required', req.lang || 'es') });
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

    res.json({ message: t('success.contact_updated', req.lang || 'es'), contact: updated });
  } catch (error) {
    logger.error(`[updateCustomerContact] Error rut=${customerRut || 'N/A'} contactIdx=${contactIdx}: ${error.message}`);
    res.status(500).json({ message: error.message || t('errors.update_contact_error', req.lang || 'es') });
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
      return res.status(404).json({ message: t('errors.customer_not_found', req.lang || 'es') });
    }

    res.json(updatedCustomer);
  } catch (error) {
    res.status(500).json({ message: t('errors.update_customer_error', req.lang || 'es') });
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
  const normalizedRut = rut ? normalizeRut(rut) : rut;
  // Quitar la C final para buscar en la tabla users
  const rutForUsers = normalizedRut ? normalizedRut.replace(/c$/i, '') : normalizedRut;
  const { password } = req.body;
  
  try {
    logger.info(`[changeCustomerPassword] request rut=${rut || 'N/A'} normalized=${normalizedRut || 'N/A'} rutForUsers=${rutForUsers || 'N/A'} hasPassword=${password ? 'Y' : 'N'}`);
    // Validar que se proporcione la contraseña
    if (!password) {
      logger.warn(`[changeCustomerPassword] missing password rut=${rut || 'N/A'}`);
      return res.status(400).json({ message: t('errors.password_required', req.lang || 'es') });
    }
  
    const validation = passwordService.validatePasswordStrength(password, req.lang || 'es');
    if (!validation.valid) {
      logger.warn(`[changeCustomerPassword] weak password rut=${rut || 'N/A'}`);
      return res.status(400).json({
        message: validation.message
      });
    }

    // Obtener el cliente por RUT desde SQL
    const customer = await customerService.getCustomerByRutFromSql(rut);
    if (!customer) {
      logger.warn(`[changeCustomerPassword] customer not found rut=${rut || 'N/A'}`);
      return res.status(404).json({ message: t('errors.customer_not_found', req.lang || 'es') });
    }

    // Buscar el usuario asociado (sin la C final)
    const user = await userService.findUserByEmailOrUsername(rutForUsers || customer.rut);
    if (!user) {
      logger.warn(`[changeCustomerPassword] user not found for rut=${rutForUsers || customer.rut}`);
      return res.status(404).json({ message: t('errors.user_not_found_for_customer', req.lang || 'es') });
    }

    const result = await passwordService.resetPassword(user.id, password, req.lang || 'es');
    if (!result.success) {
      return res.status(400).json({ message: result.message });
    }

    res.json({ message: t('success.password_updated_successfully', req.lang || 'es') });

  } catch (error) {
    res.status(500).json({ message: t('errors.change_password_error', req.lang || 'es') });
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
    logger.error(`[getCustomersWithoutAccount] Error: ${error.message}`);
    res.status(500).json({ message: t('errors.get_customers_without_account_error', req.lang || 'es') });
  }
};


exports.createCustomerAccount = async (req, res) => {
  try {
    const { customerId } = req.params;
    const { customerName, customerRut } = req.body;
    const requestedRut = customerId || customerRut;
    
    // Normalizar el RUT recibido
    const normalizedRequestedRut = normalizeRut(requestedRut);
    
    logger.info(`[createCustomerAccount] request paramId=${customerId || 'N/A'} bodyRut=${customerRut || 'N/A'} resolvedRut=${requestedRut || 'N/A'} normalizedRut=${normalizedRequestedRut || 'N/A'} name=${customerName ? 'Y' : 'N'}`);
    
    // Obtener datos del cliente por RUT (solo activos)
    const customer = await customerService.getCustomerByRutFromSql(normalizedRequestedRut);
    if (!customer) {
      logger.warn(`[createCustomerAccount] Cliente no encontrado o inactivo rut=${normalizedRequestedRut || 'N/A'}`);
      return res.status(404).json({ message: t('errors.customer_not_found', req.lang || 'es') });
    }
    
    const bcrypt = require('bcrypt');
    
    // Generar contraseña por defecto
    const defaultPassword = '123456';
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);
    
    // Normalizar el RUT del cliente obtenido de SQL Server
    const finalNormalizedRut = normalizeRut(customer.rut);
    const userData = {
      rut: finalNormalizedRut,
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
      message: t('success.account_created', req.lang || 'es'),
      userId: userId,
      customerName: customer.name,
      customerRut: finalNormalizedRut
    });
    
  } catch (error) {
    logger.error(`[createCustomerAccount] Error: ${error.message}`);
    res.status(500).json({ message: t('errors.create_customer_account_error', req.lang || 'es') });
  }
};
