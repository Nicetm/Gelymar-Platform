// services/user.service.js
const { poolPromise } = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const Customer = require('../models/customer.model');

/**
 * Obtiene todos los clientes con un conteo de carpetas asociadas (folder_count)
 * @returns {Array<Customer>} Lista de clientes con propiedad adicional folder_count
 */
async function getAllCustomers() {
  const pool = await poolPromise;
  const [rows] = await pool.query(`
    SELECT 
      c.*, 
      COUNT(o.id) AS order_count,
      cc.primary_email,
      u.online
    FROM customers c
    LEFT JOIN orders o ON o.customer_id = c.id
    LEFT JOIN customer_contacts cc ON cc.customer_id = c.id
    LEFT JOIN users u ON u.email = c.rut
    GROUP BY c.id, cc.primary_email
  `);

  return rows.map(row => {
    const customer = new Customer(row);
    customer.folder_count = row.folder_count;
    customer.email = row.primary_email; // Usar el email principal de la nueva tabla
    customer.online = row.online; // Agregar campo online
    return customer;
  });
}

/**
 * Obtiene un cliente por su ID interno
 * @param {number} id - ID numérico del cliente
 * @returns {Customer|null} Objeto Customer si existe, null si no encontrado
 */
async function getCustomerById(id) {
  const pool = await poolPromise;
  const [rows] = await pool.query(`
    SELECT 
      c.*,
      cc.primary_email,
      u.online
    FROM customers c
    LEFT JOIN customer_contacts cc ON cc.customer_id = c.id
    LEFT JOIN users u ON u.email = c.rut
    WHERE c.id = ?
  `, [id]);

  if (rows.length === 0) return null;

  const customer = new Customer(rows[0]);
  customer.email = rows[0].primary_email;
  if (typeof rows[0].online !== 'undefined') {
    customer.online = rows[0].online;
  }
  return customer;
}


/**
 * Obtiene un cliente por su UUID público
 * @param {string} uuid - UUID del cliente
 * @returns {Customer|null} Objeto Customer si existe, null si no encontrado
 */
async function getCustomerByUUID(uuid) {
  const pool = await poolPromise;
  const [rows] = await pool.query(`
    SELECT 
      c.*,
      cc.primary_email,
      u.online
    FROM customers c
    LEFT JOIN customer_contacts cc ON cc.customer_id = c.id
    LEFT JOIN users u ON u.email = c.rut
    WHERE c.uuid = ?
  `, [uuid]);

  if (rows.length === 0) return null;

  const customer = new Customer(rows[0]);
  customer.email = rows[0].primary_email;
  if (typeof rows[0].online !== 'undefined') {
    customer.online = rows[0].online;
  }
  return customer;
}


/**
 * Obtiene un cliente por su RUT
 * @param {string} rut - RUT del cliente
 * @returns {Customer|null} Objeto Customer si existe, null si no encontrado
 */
async function getCustomerByRut(rut) {
  try {
    const pool = await poolPromise;
    const query = `
      SELECT 
        c.*,
        cc.primary_email,
        u.online
      FROM customers c
      LEFT JOIN customer_contacts cc ON cc.customer_id = c.id
      LEFT JOIN users u ON u.email = c.rut
      WHERE c.rut = ?
    `;
    const params = [rut];

    const [rows] = await pool.query(query, params);

    if (rows.length === 0) {
      console.log(`??  Cliente no encontrado con RUT: "${rut}"`);
      return null;
    }

    const customer = new Customer(rows[0]);
    customer.email = rows[0].primary_email;
    if (typeof rows[0].online !== 'undefined') {
      customer.online = rows[0].online;
    }
    // Log simplificado solo para debugging cuando sea necesario
    // console.log(`Cliente encontrado: ${customer.name} (${customer.rut})`);

    return customer;

  } catch (error) {
    console.error(`Error buscando cliente por RUT "${rut}":`);
    console.error(`   Error: ${error.message}`);
    console.error(`   SQL State: ${error.sqlState}`);
    console.error(`   Error Code: ${error.errno}`);
    throw error;
  }
}


async function getAllCustomerRuts() {
  const pool = await poolPromise;
  const [rows] = await pool.query('SELECT rut FROM customers');
  return rows.map(r => r.rut);
}

/**
 * Obtiene un cliente por RUT con todos sus datos
 * @param {string} rut - RUT del cliente
 * @returns {Customer|null} Cliente encontrado o null
 */
async function getCustomerByRutForUpdate(rut) {
  const pool = await poolPromise;
  const [rows] = await pool.query('SELECT * FROM customers WHERE rut = ?', [rut]);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Actualiza un cliente por RUT
 * @param {string} rut - RUT del cliente
 * @param {Object} updateData - Datos a actualizar
 * @returns {boolean} true si se actualizó, false si no
 */
async function updateCustomerByRut(rut, updateData) {
  const pool = await poolPromise;
  
  // Construir la query de actualización dinámicamente
  const allowedFields = ['name', 'email', 'contact_name', 'contact_secondary', 'phone', 'fax', 'mobile', 'address', 'address_alt', 'country', 'city'];
  const fieldsToUpdate = [];
  const values = [];

  for (const [key, value] of Object.entries(updateData)) {
    if (allowedFields.includes(key)) {
      fieldsToUpdate.push(`${key} = ?`);
      values.push(value); // Permitir null para actualizar campos vacíos a NULL
    }
  }

  if (fieldsToUpdate.length === 0) {
    return false; // No hay campos para actualizar
  }

  // Agregar el RUT al final para la condición WHERE
  values.push(rut);

  const query = `
    UPDATE customers 
    SET ${fieldsToUpdate.join(', ')}, updated_at = NOW()
    WHERE rut = ?
  `;

  await pool.query(query, values);
  return true;
}

async function insertCustomer(data) {
  const pool = await poolPromise;
  const query = `
    INSERT INTO customers (
      uuid, rut, name, email, address, address_alt, city, country,
      contact_name, contact_secondary, fax, phone, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW())
  `;

  const params = [
    uuidv4(),
    data.rut,
    data.name,
    data.email || null,
    data.address,
    data.address_alt,
    data.city,
    data.country,
    data.contact_name,
    data.contact_secondary,
    data.fax,
    data.phone
  ];

  await pool.query(query, params);
}

async function createCustomerContacts(customer_uuid, contacts) {
  const pool = await poolPromise;
  
  // Buscar el cliente por UUID
  const [customer] = await pool.query('SELECT id, rut FROM customers WHERE uuid = ?', [customer_uuid]);
  if (!customer[0]) throw new Error('Cliente no encontrado');
  
  const customer_id = customer[0].id;
  const customer_rut = customer[0].rut;
  
  // Verificar si existe un registro en la tabla de contactos
  const [existingContact] = await pool.query(
    'SELECT id, primary_email, contact_email FROM customer_contacts WHERE customer_id = ?', 
    [customer_id]
  );
  
  if (!existingContact[0]) {
    throw new Error('Para ingresar contactos adicionales debe ingresar el mail principal');
  }
  
  if (!existingContact[0].primary_email) {
    throw new Error('Para ingresar contactos adicionales debe ingresar el mail principal');
  }
  
  // Obtener contactos existentes del JSON
  let existingContacts = [];
  if (existingContact[0].contact_email) {
    try {
      // Si ya es un objeto, usarlo directamente
      if (typeof existingContact[0].contact_email === 'object') {
        existingContacts = existingContact[0].contact_email;
      } else {
        // Si es string, parsearlo
        existingContacts = JSON.parse(existingContact[0].contact_email);
      }
    } catch (error) {
      existingContacts = [];
    }
  }
  
  // Agregar nuevos contactos con índice incremental
  const maxIdx = existingContacts.length > 0 ? Math.max(...existingContacts.map(c => c.idx || 0)) : 0;
  const newContacts = contacts.map((contact, index) => ({
    idx: maxIdx + index + 1,
    nombre: contact.name,
    email: contact.email || '',
    telefono: contact.phone || ''
  }));
  
  // Combinar contactos existentes con nuevos
  const allContacts = [...existingContacts, ...newContacts];
  
  // Actualizar el registro con los nuevos contactos
  await pool.query(
    'UPDATE customer_contacts SET contact_email = ? WHERE customer_id = ?',
    [JSON.stringify(allContacts), customer_id]
  );
}

async function getContactsByCustomerUUID(uuid) {
  const pool = await poolPromise;
  
  // Buscar el cliente por UUID
  const [customer] = await pool.query('SELECT id FROM customers WHERE uuid = ?', [uuid]);
  if (!customer[0]) {
    return {
      id: null,
      primary_email: null,
      role: null,
      additional_contacts: []
    };
  }
  
  const customerId = customer[0].id;
  
  // Buscar en la tabla de contactos
  const [contactRecord] = await pool.query(
    'SELECT id, primary_email, contact_email, role FROM customer_contacts WHERE customer_id = ?', 
    [customerId]
  );
  
  if (!contactRecord[0]) {
    return {
      id: null,
      primary_email: null,
      role: null,
      additional_contacts: []
    };
  }
  
  const result = {
    id: contactRecord[0].id,
    primary_email: contactRecord[0].primary_email,
    role: contactRecord[0].role,
    additional_contacts: []
  };
  
  // Parsear contactos adicionales del JSON
  if (contactRecord[0].contact_email) {
    try {
      // Si ya es un objeto, usarlo directamente
      if (typeof contactRecord[0].contact_email === 'object') {
        result.additional_contacts = contactRecord[0].contact_email;
      } else {
        // Si es string, parsearlo
        result.additional_contacts = JSON.parse(contactRecord[0].contact_email);
      }
    } catch (error) {
      result.additional_contacts = [];
    }
  }
  
  return result;
}

/**
 * Crea o actualiza el registro principal de contactos cuando se actualiza el email principal
 * @param {string} customer_uuid - UUID del cliente
 * @param {string} primary_email - Email principal del cliente
 * @returns {void}
 */
async function createOrUpdatePrimaryContact(customer_uuid, primary_email) {
  const pool = await poolPromise;
  
  // Buscar el cliente por UUID
  const [customer] = await pool.query('SELECT id, rut FROM customers WHERE uuid = ?', [customer_uuid]);
  if (!customer[0]) throw new Error('Cliente no encontrado');
  
  const customer_id = customer[0].id;
  const customer_rut = customer[0].rut;
  
  // Verificar si ya existe un registro
  const [existingRecord] = await pool.query(
    'SELECT id FROM customer_contacts WHERE customer_id = ?', 
    [customer_id]
  );
  
  if (existingRecord[0]) {
    // Actualizar registro existente
    await pool.query(
      'UPDATE customer_contacts SET primary_email = ? WHERE customer_id = ?',
      [primary_email, customer_id]
    );
  } else {
    // Crear nuevo registro
    await pool.query(
      'INSERT INTO customer_contacts (customer_id, rut, primary_email, role) VALUES (?, ?, ?, ?)',
      [customer_id, customer_rut, primary_email, '3']
    );
  }
}

/**
 * Obtiene clientes que no tienen cuenta de usuario
 * @returns {Array<Customer>} Lista de clientes sin cuenta
 */
async function getCustomersWithoutAccount() {
  const pool = await poolPromise;
  const [rows] = await pool.query(`
    SELECT * FROM customers 
    WHERE rut NOT IN (SELECT email FROM users)
  `);

  return rows.map(row => new Customer(row));
}

/**
 * Elimina un contacto de un cliente
 * @param {number} contactId - ID del contacto a eliminar
 * @returns {boolean} true si se eliminó, false si no se encontró
 */
async function deleteCustomerContact(customer_uuid, contactIdx) {
  const pool = await poolPromise;
  
  // Buscar el cliente por UUID
  const [customer] = await pool.query('SELECT id FROM customers WHERE uuid = ?', [customer_uuid]);
  if (!customer[0]) throw new Error('Cliente no encontrado');
  
  const customer_id = customer[0].id;
  
  // Obtener el registro de contactos
  const [contactRecord] = await pool.query(
    'SELECT contact_email FROM customer_contacts WHERE customer_id = ?', 
    [customer_id]
  );
  
  if (!contactRecord[0] || !contactRecord[0].contact_email) {
    throw new Error('No se encontraron contactos para eliminar');
  }
  
  // Parsear contactos existentes
  let contacts = [];
  try {
    // Si ya es un objeto, usarlo directamente
    if (typeof contactRecord[0].contact_email === 'object') {
      contacts = contactRecord[0].contact_email;
    } else {
      // Si es string, parsearlo
      contacts = JSON.parse(contactRecord[0].contact_email);
    }
  } catch (error) {
    throw new Error('Error al parsear contactos existentes');
  }
  
  // Filtrar el contacto a eliminar
  const updatedContacts = contacts.filter(contact => contact.idx !== parseInt(contactIdx));
  
  // Actualizar el registro
  await pool.query(
    'UPDATE customer_contacts SET contact_email = ? WHERE customer_id = ?',
    [JSON.stringify(updatedContacts), customer_id]
  );
  
  return true;
}

/**
 * Actualiza un cliente por su UUID
 * @param {string} uuid - UUID del cliente
 * @param {Object} updateData - Datos a actualizar
 * @returns {Customer|null} Cliente actualizado o null si no encontrado
 */
async function updateCustomerByUUID(uuid, updateData) {
  const pool = await poolPromise;
  
  // Verificar que el cliente existe
  const [existingCustomer] = await pool.query('SELECT * FROM customers WHERE uuid = ?', [uuid]);
  if (existingCustomer.length === 0) {
    console.error(`Cliente no encontrado con UUID: ${uuid}`);
    return null;
  }

  console.log(`Cliente encontrado: ${existingCustomer[0].name} (${existingCustomer[0].rut})`);

  // Construir la query de actualización dinámicamente
  const allowedFields = ['name', 'email', 'phone', 'country', 'city', 'address', 'address_alt', 'contact_name', 'contact_secondary', 'fax'];
  const fieldsToUpdate = [];
  const values = [];

  for (const [key, value] of Object.entries(updateData)) {
    if (allowedFields.includes(key) && value !== undefined) {
      fieldsToUpdate.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (fieldsToUpdate.length === 0) {
    throw new Error('No hay campos válidos para actualizar');
  }

  // Agregar el UUID al final para la condición WHERE
  values.push(uuid);

  const query = `
    UPDATE customers 
    SET ${fieldsToUpdate.join(', ')}, updated_at = NOW()
    WHERE uuid = ?
  `;

  await pool.query(query, values);

  // Si se actualizó el email, crear o actualizar el registro de contactos
  if (updateData.email) {
    try {
      console.log(`Creando/actualizando contacto principal para email: ${updateData.email}`);
      await createOrUpdatePrimaryContact(uuid, updateData.email);
    } catch (error) {
      console.error('Error actualizando contacto principal:', error.message);
    }
  }

  // Retornar el cliente actualizado
  const updatedCustomer = await getCustomerByUUID(uuid);
  console.log(`Cliente actualizado exitosamente: ${updatedCustomer ? updatedCustomer.name : 'null'}`);
  return updatedCustomer;
}

module.exports = {
  getAllCustomerRuts,
  getCustomerByRutForUpdate,
  updateCustomerByRut,
  insertCustomer,
  getAllCustomers,
  getCustomerById,  
  getCustomerByUUID,
  getCustomerByRut,
  createCustomerContacts,
  getContactsByCustomerUUID,
  deleteCustomerContact,
  updateCustomerByUUID,
  createOrUpdatePrimaryContact,
  getCustomersWithoutAccount
};

