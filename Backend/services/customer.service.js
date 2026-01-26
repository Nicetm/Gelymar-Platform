// services/user.service.js
const { poolPromise } = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const Customer = require('../models/customer.model');

/**
 * Obtiene todos los clientes con un conteo de carpetas asociadas (folder_count)
 * @returns {Array<Customer>} Lista de clientes con propiedad adicional folder_count
 */
async function getAllCustomers(options = {}) {
  const { salesRut = null } = options;
  const pool = await poolPromise;
  const params = [];

  console.log('[getAllCustomers] salesRut recibido:', salesRut);
  
  let query = '';
  
  if (salesRut) {
    // Para sellers: solo clientes que tienen órdenes relacionadas con este vendedor
    query = `
      SELECT 
        c.*, 
        COUNT(DISTINCT o.id) AS order_count,
        cc.primary_email,
        u.online
      FROM customers c
      INNER JOIN orders o ON o.customer_id = c.id AND o.rut = c.rut
      LEFT JOIN customer_contacts cc ON cc.customer_id = c.id
      LEFT JOIN users u ON u.rut = c.rut
      WHERE EXISTS (
        SELECT 1 
        FROM order_detail od
        INNER JOIN sellers s ON s.codigo = od.vendedor
        WHERE od.order_id = o.id AND s.rut = ?
      )
      GROUP BY c.id, cc.primary_email, u.online
    `;
    params.push(salesRut);
    console.log('[getAllCustomers] Query para seller ejecutada con salesRut:', salesRut);
  } else {
    // Para admin: todos los clientes
    query = `
      SELECT 
        c.*, 
        COUNT(DISTINCT o.id) AS order_count,
        cc.primary_email,
        u.online
      FROM customers c
      LEFT JOIN orders o ON o.customer_id = c.id
      LEFT JOIN order_detail od ON od.order_id = o.id
      LEFT JOIN sellers s ON s.codigo = od.vendedor
      LEFT JOIN customer_contacts cc ON cc.customer_id = c.id
      LEFT JOIN users u ON u.rut = c.rut
      GROUP BY c.id, cc.primary_email, u.online
    `;
  }

  const [rows] = await pool.query(query, params);
  
  console.log('[getAllCustomers] Resultados obtenidos:', rows.length, 'clientes');
  if (salesRut && rows.length > 0) {
    console.log('[getAllCustomers] Primer cliente encontrado:', { id: rows[0].id, name: rows[0].name, rut: rows[0].rut });
  }

  return rows.map(row => {
    const customer = new Customer(row);
    customer.folder_count = row.folder_count;
    //customer.email = row.primary_email; // Usar el email principal de la nueva tabla
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
    LEFT JOIN users u ON u.rut = c.rut
    WHERE c.id = ?
  `, [id]);

  if (rows.length === 0) return null;

  const customer = new Customer(rows[0]);
  customer.email = rows[0].email || rows[0].primary_email;
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
    LEFT JOIN users u ON u.rut = c.rut
    WHERE c.uuid = ?
  `, [uuid]);

  if (rows.length === 0) return null;

  const customer = new Customer(rows[0]);
  customer.email = rows[0].email || rows[0].primary_email;
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
      LEFT JOIN users u ON u.rut = c.rut
      WHERE c.rut = ?
    `;
    const params = [rut];

    const [rows] = await pool.query(query, params);

    if (rows.length === 0) {
      return null;
    }

    const customer = new Customer(rows[0]);
    customer.email = rows[0].email || rows[0].primary_email;
    if (typeof rows[0].online !== 'undefined') {
      customer.online = rows[0].online;
    }

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
  const [customerRows] = await pool.query('SELECT id, rut, email FROM customers WHERE uuid = ?', [customer_uuid]);
  const customer = customerRows[0];
  if (!customer) throw new Error('Cliente no encontrado');
  
  const customerId = customer.id;

  // Obtener (si existe) el registro de contactos para el cliente
  const [contactRows] = await pool.query(
    'SELECT id, contact_email, primary_email, role FROM customer_contacts WHERE customer_id = ?',
    [customerId]
  );
  const contactRecord = contactRows[0];
  
  // Obtener contactos existentes del JSON almacenado
  let existingContacts = [];
  if (contactRecord && contactRecord.contact_email) {
    try {
      if (typeof contactRecord.contact_email === 'object') {
        existingContacts = contactRecord.contact_email;
      } else {
        existingContacts = JSON.parse(contactRecord.contact_email);
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
    telefono: contact.phone || '',
    sh_documents: contact.sh_documents || false,
    reports: contact.reports || false,
    cco: contact.cco || false
  }));
  
  // Combinar contactos existentes con nuevos
  const allContacts = [...existingContacts, ...newContacts];
  
  if (contactRecord) {
    // Actualizar registro existente
    await pool.query(
      'UPDATE customer_contacts SET contact_email = ?, primary_email = ? WHERE customer_id = ?',
      [JSON.stringify(allContacts), customer.email || null, customerId]
    );
  } else {
    // Crear registro si no existe aún
    await pool.query(
      'INSERT INTO customer_contacts (customer_id, rut, primary_email, contact_email, role) VALUES (?, ?, ?, ?, ?)',
      [customerId, customer.rut, customer.email || null, JSON.stringify(allContacts), '3']
    );
  }
}

async function getContactsByCustomerUUID(uuid) {
  const pool = await poolPromise;
  
  // Buscar el cliente por UUID
  const [customerRows] = await pool.query('SELECT id, email FROM customers WHERE uuid = ?', [uuid]);
  const customer = customerRows[0];
  if (!customer) {
    return {
      id: null,
      primary_email: null,
      role: null,
      additional_contacts: []
    };
  }
  
  const customerId = customer.id;
  
  // Buscar en la tabla de contactos
  const [contactRows] = await pool.query(
    'SELECT id, primary_email, contact_email, role FROM customer_contacts WHERE customer_id = ?', 
    [customerId]
  );
  const contactRecord = contactRows[0];
  
  const result = {
    id: contactRecord ? contactRecord.id : null,
    primary_email: customer.email || null,
    role: contactRecord ? contactRecord.role : null,
    additional_contacts: []
  };
  
  // Parsear contactos adicionales del JSON
  if (contactRecord && contactRecord.contact_email) {
    try {
      if (typeof contactRecord.contact_email === 'object') {
        result.additional_contacts = contactRecord.contact_email;
      } else {
        result.additional_contacts = JSON.parse(contactRecord.contact_email);
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
    WHERE rut NOT IN (SELECT rut FROM users)
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

async function updateCustomerContact(customer_uuid, contactIdx, contactData) {
  const pool = await poolPromise;

  const [customer] = await pool.query('SELECT id FROM customers WHERE uuid = ?', [customer_uuid]);
  if (!customer[0]) throw new Error('Cliente no encontrado');

  const customer_id = customer[0].id;

  const [contactRecord] = await pool.query(
    'SELECT contact_email FROM customer_contacts WHERE customer_id = ?',
    [customer_id]
  );

  if (!contactRecord[0] || !contactRecord[0].contact_email) {
    throw new Error('No se encontraron contactos para actualizar');
  }

  let contacts = [];
  try {
    if (typeof contactRecord[0].contact_email === 'object') {
      contacts = contactRecord[0].contact_email;
    } else {
      contacts = JSON.parse(contactRecord[0].contact_email);
    }
  } catch (error) {
    throw new Error('Error al parsear contactos existentes');
  }

  const idxNumeric = parseInt(contactIdx);
  const contactIndex = contacts.findIndex(contact => contact.idx === idxNumeric);
  if (contactIndex === -1) {
    throw new Error('Contacto no encontrado');
  }

  contacts[contactIndex] = {
    ...contacts[contactIndex],
    nombre: contactData.nombre ?? contacts[contactIndex].nombre,
    email: contactData.email ?? contacts[contactIndex].email,
    telefono: contactData.telefono ?? contacts[contactIndex].telefono,
    sh_documents: typeof contactData.sh_documents === 'boolean' ? contactData.sh_documents : contacts[contactIndex].sh_documents,
    reports: typeof contactData.reports === 'boolean' ? contactData.reports : contacts[contactIndex].reports,
    cco: typeof contactData.cco === 'boolean' ? contactData.cco : contacts[contactIndex].cco,
  };

  await pool.query(
    'UPDATE customer_contacts SET contact_email = ? WHERE customer_id = ?',
    [JSON.stringify(contacts), customer_id]
  );

  return contacts[contactIndex];
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
      await createOrUpdatePrimaryContact(uuid, updateData.email);
    } catch (error) {
      console.error('Error actualizando contacto principal:', error.message);
    }
  }

  // Retornar el cliente actualizado
  const updatedCustomer = await getCustomerByUUID(uuid);
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
  updateCustomerContact,
  createOrUpdatePrimaryContact,
  getCustomersWithoutAccount
};

