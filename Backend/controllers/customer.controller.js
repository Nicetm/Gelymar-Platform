const customerService = require('../services/customer.service');
const userService = require('../services/user.service');
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

    const customers = await customerService.getAllCustomers(options);
    res.json(customers);
  } catch (error) {
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
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

/**
 * @route POST /api/customers/contacts
 * @desc Crea un contacto para un cliente
 * @access Protegido (requiere JWT)
 */
exports.createCustomerContact = async (req, res) => {
  const { customer_uuid, contacts } = req.body;
  if (!customer_uuid || !Array.isArray(contacts) || contacts.length === 0) {
    return res.status(400).json({ message: 'Debe enviar el customer_uuid y al menos un contacto' });
  }

  try {
    await customerService.createCustomerContacts(customer_uuid, contacts);
    res.status(201).json({ message: 'Contactos creados correctamente' });
  } catch (error) {
    res.status(500).json({ message: 'Error al crear contactos' });
  }
};

exports.getCustomerContacts = async (req, res) => {
  const { uuid } = req.params;
  try {
    const contacts = await customerService.getContactsByCustomerUUID(uuid);
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
  const { customerUuid, contactIdx } = req.params;
  
  try {
    await customerService.deleteCustomerContact(customerUuid, contactIdx);
    res.json({ message: 'Contacto eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error al eliminar contacto' });
  }
};

exports.updateCustomerContact = async (req, res) => {
  const { customerUuid, contactIdx } = req.params;
  const { nombre, email, telefono, sh_documents, reports } = req.body;

  if (!nombre || !email) {
    return res.status(400).json({ message: 'El nombre y el email son obligatorios' });
  }

  try {
    const updated = await customerService.updateCustomerContact(customerUuid, contactIdx, {
      nombre,
      email,
      telefono,
      sh_documents,
      reports
    });

    res.json({ message: 'Contacto actualizado correctamente', contact: updated });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error al actualizar contacto' });
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
  
  try {
    const updatedCustomer = await customerService.updateCustomerByUUID(uuid, updateData);
    
    if (!updatedCustomer) {
      return res.status(404).json({ message: 'Cliente no encontrado' });
    }

    res.json(updatedCustomer);
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar cliente' });
  }
};

/**
 * @route PATCH /api/customers/change-password/:uuid
 * @desc Cambia la contraseña del usuario asociado al cliente
 * @access Protegido (requiere JWT)
 */
exports.changeCustomerPassword = async (req, res) => {
  const { uuid } = req.params;
  const { password } = req.body;
  
  try {
    // Validar que se proporcione la contraseña
    if (!password) {
      return res.status(400).json({ message: 'La contraseña es requerida' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres' });
    }

    // Obtener el cliente por UUID
    const customer = await customerService.getCustomerByUUID(uuid);
    if (!customer) {
      return res.status(404).json({ message: 'Cliente no encontrado' });
    }

    // Buscar el usuario asociado (users.rut = customers.rut)
    const { poolPromise } = require('../config/db');
    const pool = await poolPromise;
    
    const [users] = await pool.query(
      'SELECT id, rut FROM users WHERE rut = ?',
      [customer.rut]
    );

    if (users.length === 0) {
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

exports.getCustomerByRut = async (req, res) => {
  try {
    const { rut } = req.params;
    const customer = await customerService.getCustomerByRut(rut);
    
    if (!customer) {
      return res.status(404).json({ message: 'Cliente no encontrado' });
    }
    res.json(customer);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener cliente desde la base de datos' });
  }
};

exports.createCustomerAccount = async (req, res) => {
  try {
    const { customerId } = req.params;
    const { customerName, customerRut } = req.body;
    
    // Obtener datos del cliente por RUT
    const customer = await customerService.getCustomerByRut(customerRut);
    if (!customer) {
      return res.status(404).json({ message: 'Cliente no encontrado' });
    }
    
    const bcrypt = require('bcrypt');
    const userService = require('../services/user.service');
    
    // Generar contraseña por defecto
    const defaultPassword = '123456';
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);
    
    // Crear usuario usando el servicio
    
    const userData = {
      rut: customer.rut.trim(),
      password: hashedPassword,
      role_id: 2, // role_id = 2 (cliente)
      full_name: customer.name || 'Cliente',
      phone: customer.phone || null,
      country: customer.country || null,
      city: customer.city || null,
      twoFASecret: null
    };
    
    const userId = await userService.createUser(userData);
    
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
