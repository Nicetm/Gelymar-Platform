// services/user.service.js
const { poolPromise } = require('../config/db');
const { getSqlPool, sql } = require('../config/sqlserver');
const Customer = require('../models/customer.model');
const { logger } = require('../utils/logger');
const { normalizeRut } = require('../utils/rut.util');

/**
 * Obtiene todos los clientes con un conteo de carpetas asociadas (folder_count)
 * @returns {Array<Customer>} Lista de clientes con propiedad adicional folder_count
 */
async function getAllCustomers(options = {}) {
  const { salesRut = null } = options;
  const pool = await poolPromise;
  const sqlPool = await getSqlPool();

  try {
    let sellerCodes = [];
    if (salesRut) {
      const rawRut = String(salesRut || '').trim();
      const [sellerRows] = await pool.query(
        'SELECT codigo FROM sellers WHERE rut = ?',
        [rawRut]
      );
      sellerCodes = sellerRows
        .map((row) => String(row.codigo || '').trim())
        .filter((code) => code.length > 0);
      if (sellerCodes.length === 0) {
        return [];
      }
    }

    const request = sqlPool.request();
    request.timeout = 60000;

    let query = `
      WITH hdr AS (
        SELECT
          Rut,
          COUNT(DISTINCT Nro) AS order_count
        FROM jor_imp_HDR_90_softkey
    `;

    if (sellerCodes.length > 0) {
      const placeholders = sellerCodes.map((_, idx) => `@sellerCode${idx}`);
      query += ` WHERE Vendedor IN (${placeholders.join(', ')})`;
      sellerCodes.forEach((code, idx) => {
        request.input(`sellerCode${idx}`, sql.VarChar, String(code).trim());
      });
    }

    query += `
        GROUP BY Rut
      )
      SELECT
        c.Rut,
        c.Nombre,
        c.Direccion,
        c.Direccion2,
        c.Ciudad,
        c.Pais,
        c.Contacto,
        c.Contacto2,
        c.Fax,
        c.Telefono,
        c.Correo,
        ISNULL(h.order_count, 0) AS order_count
      FROM jor_imp_CLI_01_softkey c
    `;

    if (sellerCodes.length > 0) {
      query += ` INNER JOIN hdr h ON h.Rut = c.Rut`;
    } else {
      query += ` LEFT JOIN hdr h ON h.Rut = c.Rut`;
    }

    logger.info(`[getAllCustomers] SQL query start. sellerCodes=${sellerCodes.length}`);
    const sqlStart = Date.now();
    const result = await request.query(query);
    logger.info(`[getAllCustomers] SQL query done in ${Date.now() - sqlStart}ms rows=${result.recordset?.length || 0}`);
    const rows = result.recordset || [];

    if (rows.length === 0) return [];

    const ruts = rows.map((row) => row.Rut).filter(Boolean);
    const normalizedRuts = ruts.map(normalizeRut).filter(Boolean);
    logger.info(`[getAllCustomers] MySQL contacts query start. ruts=${ruts.length}`);
    const mysqlStart = Date.now();
    const [contactRows] = await pool.query(
      `
        SELECT cc.rut, cc.primary_email, u.online
        FROM customer_contacts cc
        LEFT JOIN users u ON u.rut = cc.rut
        WHERE cc.rut IN (?)
      `,
      [normalizedRuts.length ? normalizedRuts : ruts]
    );
    logger.info(`[getAllCustomers] MySQL contacts query done in ${Date.now() - mysqlStart}ms rows=${contactRows.length}`);
    const contactMap = new Map();
    contactRows.forEach((row) => {
      contactMap.set(normalizeRut(row.rut), {
        primary_email: row.primary_email,
        online: row.online
      });
    });

    const [userRows] = normalizedRuts.length
      ? await pool.query(
        `SELECT rut, online FROM users WHERE rut IN (?)`,
        [normalizedRuts]
      )
      : [[]];
    const userOnlineMap = new Map();
    (userRows || []).forEach((row) => {
      userOnlineMap.set(normalizeRut(row.rut), row.online);
    });

    return rows.map((row) => {
      const normalizedRut = normalizeRut(row.Rut);
      const contact = contactMap.get(normalizedRut) || {};
      const userOnline = userOnlineMap.get(normalizedRut);
      const customer = new Customer({
        id: null,
        rut: row.Rut?.trim() || null,
        name: row.Nombre?.trim() || null,
        address: row.Direccion?.trim() || null,
        address_alt: row.Direccion2?.trim() || null,
        city: row.Ciudad?.trim() || null,
        country: row.Pais?.trim() || null,
        contact_name: row.Contacto?.trim() || null,
        contact_secondary: row.Contacto2?.trim() || null,
        fax: row.Fax?.trim() || null,
        phone: row.Telefono?.trim() || null,
        email: contact.primary_email || row.Contacto2?.trim() || null,
        order_count: row.order_count || 0,
        online: typeof userOnline !== 'undefined'
          ? userOnline
          : (typeof contact.online !== 'undefined' ? contact.online : 0)
      });
      return customer;
    });
  } catch (error) {
    logger.error(`[getAllCustomers] Error: ${error.message}`);
    throw error;
  }
}

/**
 * Obtiene un cliente por su ID interno
 * @param {number} id - ID numérico del cliente
 * @returns {Customer|null} Objeto Customer si existe, null si no encontrado
 */
async function getCustomerById(id) {
  if (!id) return null;
  return getCustomerByRut(String(id));
}


/**
 * Obtiene un cliente por su RUT (alias para compatibilidad)
 * @param {string} rut - RUT del cliente
 * @returns {Customer|null} Objeto Customer si existe, null si no encontrado
 */
async function getCustomerByUUID(rut) {
  if (!rut) return null;
  return getCustomerByRut(String(rut));
}


/**
 * Obtiene un cliente por su RUT
 * @param {string} rut - RUT del cliente
 * @returns {Customer|null} Objeto Customer si existe, null si no encontrado
 */
async function getCustomerByRut(rut) {
  try {
    if (!rut) return null;
    const normalizedRut = String(rut).trim().replace(/C$/i, '');
    const altRut = normalizedRut ? `${normalizedRut}C` : String(rut).trim();
    const sqlPool = await getSqlPool();
    const sqlResult = await sqlPool
      .request()
      .input('rut', sql.VarChar, rut)
      .query(`
        SELECT TOP 1
          Rut,
          Nombre,
          Direccion,
          Direccion2,
          Ciudad,
          Pais,
          Contacto,
          Contacto2,
          Fax,
          Telefono,
          Correo
        FROM jor_imp_CLI_01_softkey
        WHERE Rut = @rut
          AND LTRIM(RTRIM(EstadoCliente)) = 'Activo'
      `);

    const row = sqlResult.recordset?.[0];
    if (!row) return null;

    const pool = await poolPromise;
    let contactMeta = {};
    const [userRows] = await pool.query(
      `
        SELECT cc.primary_email, u.online
        FROM users u
        LEFT JOIN customer_contacts cc ON cc.rut = u.rut
        WHERE u.rut IN (?, ?)
        LIMIT 1
      `,
      [normalizedRut, altRut]
    );
    if (userRows && userRows.length) {
      contactMeta = userRows[0] || {};
    } else {
      const [contactRows] = await pool.query(
        `
          SELECT cc.primary_email
          FROM customer_contacts cc
          WHERE cc.rut IN (?, ?)
          LIMIT 1
        `,
        [normalizedRut, altRut]
      );
      contactMeta = contactRows[0] || {};
    }

    const customer = new Customer({
      id: null,
      rut: row.Rut?.trim() || null,
      name: row.Nombre?.trim() || null,
      address: row.Direccion?.trim() || null,
      address_alt: row.Direccion2?.trim() || null,
      city: row.Ciudad?.trim() || null,
      country: row.Pais?.trim() || null,
      contact_name: row.Contacto?.trim() || null,
      contact_secondary: row.Contacto2?.trim() || null,
      fax: row.Fax?.trim() || null,
      phone: row.Telefono?.trim() || null,
      email: (contactMeta.primary_email || row.Contacto2?.trim()) ?? null,
      online: typeof contactMeta.online !== 'undefined' ? contactMeta.online : 0
    });

    return customer;
  } catch (error) {
    logger.error(`[CustomerService] Error buscando cliente por RUT "${rut}": ${error.message}`);
    logger.error(`[CustomerService] SQL State: ${error.sqlState}, Error Code: ${error.errno}`);
    throw error;
  }
}

/**
 * Obtiene un cliente por su RUT desde SQL Server (vista jor_imp_CLI_01_softkey)
 * @param {string} rut - RUT del cliente
 * @returns {object|null} Datos del cliente si existe, null si no encontrado
 */
async function getCustomerByRutFromSql(rut) {
  const pool = await getSqlPool();
  
  const searchRut = String(rut || '').trim()
    .replace(/[\u2010-\u2015\u2212]/g, '-');
  
  // Search with and without trailing 'C'
  const hasTrailingC = searchRut.toLowerCase().endsWith('c');
  const altRut = hasTrailingC ? searchRut.slice(0, -1) : `${searchRut}C`;

  const result = await pool
    .request()
    .input('rut', sql.VarChar, searchRut)
    .input('rutAlt', sql.VarChar, altRut)
    .query(`
      SELECT TOP 1
        Rut,
        Nombre,
        Direccion,
        Direccion2,
        Ciudad,
        Pais,
        Contacto,
        Contacto2,
        Fax,
        Telefono,
        Correo,
        EstadoCliente
      FROM jor_imp_CLI_01_softkey
      WHERE (LTRIM(RTRIM(Rut)) = @rut OR LTRIM(RTRIM(Rut)) = @rutAlt)
        AND LTRIM(RTRIM(EstadoCliente)) = 'Activo'
    `);

  const row = result.recordset?.[0];
  if (!row) {
    return null;
  }

  return {
    rut: row.Rut?.trim() || null,
    name: row.Nombre?.trim() || null,
    address: row.Direccion?.trim() || null,
    address_alt: row.Direccion2?.trim() || null,
    city: row.Ciudad?.trim() || null,
    country: row.Pais?.trim() || null,
    contact_name: row.Contacto?.trim() || null,
    contact_secondary: row.Contacto2?.trim() || null,
    fax: row.Fax?.trim() || null,
    phone: row.Telefono?.trim() || null,
    email: row.Contacto2?.trim() || null,
    mobile: null,
  };
}


async function getAllCustomerRuts() {
  const sqlPool = await getSqlPool();
  const result = await sqlPool.request().query(
    `SELECT Rut FROM jor_imp_CLI_01_softkey 
     WHERE Rut IS NOT NULL 
       AND LTRIM(RTRIM(EstadoCliente)) = 'Activo'`
  );
  return (result.recordset || []).map((row) => row.Rut);
}

/**
 * Obtiene un cliente por RUT con todos sus datos
 * @param {string} rut - RUT del cliente
 * @returns {Customer|null} Cliente encontrado o null
 */
async function getCustomerByRutForUpdate(rut) {
  const sqlPool = await getSqlPool();
  
  // Extraer solo los números del RUT para buscar
  const rutNumbers = rut.replace(/[^0-9]/g, '');
  
  const request = sqlPool.request();
  request.input('rutPattern', sql.VarChar, `%${rutNumbers}%`);
  
  const result = await request.query(`
    SELECT TOP 1
      Rut,
      Nombre,
      Direccion,
      Direccion2,
      Ciudad,
      Pais,
      Contacto,
      Contacto2,
      Fax,
      Telefono,
      Correo
    FROM jor_imp_CLI_01_softkey
    WHERE Rut LIKE @rutPattern
      AND LTRIM(RTRIM(EstadoCliente)) = 'Activo'
  `);
  const row = result.recordset?.[0];
  if (!row) return null;
  return {
    rut: row.Rut?.trim() || null,
    name: row.Nombre?.trim() || null,
    address: row.Direccion?.trim() || null,
    address_alt: row.Direccion2?.trim() || null,
    city: row.Ciudad?.trim() || null,
    country: row.Pais?.trim() || null,
    contact_name: row.Contacto?.trim() || null,
    contact_secondary: row.Contacto2?.trim() || null,
    fax: row.Fax?.trim() || null,
    phone: row.Telefono?.trim() || null,
    email: row.Contacto2?.trim() || null,
    mobile: null
  };
}

/**
 * Actualiza un cliente por RUT
 * @param {string} rut - RUT del cliente
 * @param {Object} updateData - Datos a actualizar
 * @returns {boolean} true si se actualizó, false si no
 */
async function updateCustomerByRut(rut, updateData) {
  logger.warn(`[updateCustomerByRut] Operación no soportada en vistas SQL. Rut=${rut}`);
  throw new Error('Actualización de clientes no disponible: datos se leen desde SQL');
}


async function createCustomerContacts(customer_rut, contacts) {
  const pool = await poolPromise;
  if (!customer_rut) throw new Error('RUT requerido');

  logger.info(`[createCustomerContacts] start rut=${customer_rut} contacts=${Array.isArray(contacts) ? contacts.length : 'N/A'}`);

  // Obtener (si existe) el registro de contactos para el cliente por RUT
  const [contactRows] = await pool.query(
    'SELECT id, contact_email, primary_email, role FROM customer_contacts WHERE rut = ?',
    [customer_rut]
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
      'UPDATE customer_contacts SET contact_email = ?, primary_email = ? WHERE rut = ?',
      [JSON.stringify(allContacts), contactRecord.primary_email || null, customer_rut]
    );
    logger.info(`[createCustomerContacts] updated rut=${customer_rut} total=${allContacts.length}`);
  } else {
    // Crear registro si no existe aún
    await pool.query(
      'INSERT INTO customer_contacts (rut, primary_email, contact_email, role) VALUES (?, ?, ?, ?)',
      [customer_rut, null, JSON.stringify(allContacts), '3']
    );
    logger.info(`[createCustomerContacts] inserted rut=${customer_rut} total=${allContacts.length}`);
  }
}

async function getContactsByCustomerRut(rut) {
  const pool = await poolPromise;
  
  // Buscar en la tabla de contactos
  const [contactRows] = await pool.query(
    'SELECT id, primary_email, contact_email, role FROM customer_contacts WHERE rut = ?', 
    [rut]
  );
  const contactRecord = contactRows[0];
  
  const result = {
    id: contactRecord ? contactRecord.id : null,
    primary_email: contactRecord ? contactRecord.primary_email : null,
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
 * @param {string} customer_rut - RUT del cliente
 * @param {string} primary_email - Email principal del cliente
 * @returns {void}
 */
async function createOrUpdatePrimaryContact(customer_rut, primary_email) {
  const pool = await poolPromise;
  
  // Verificar si ya existe un registro
  const [existingRecord] = await pool.query(
    'SELECT id FROM customer_contacts WHERE rut = ?', 
    [customer_rut]
  );
  
  if (existingRecord[0]) {
    // Actualizar registro existente
    await pool.query(
      'UPDATE customer_contacts SET primary_email = ? WHERE rut = ?',
      [primary_email, customer_rut]
    );
  } else {
    // Crear nuevo registro
    await pool.query(
      'INSERT INTO customer_contacts (rut, primary_email, role) VALUES (?, ?, ?)',
      [customer_rut, primary_email, '3']
    );
  }
}

/**
 * Obtiene clientes que no tienen cuenta de usuario
 * @returns {Array<Customer>} Lista de clientes sin cuenta
 */
async function getCustomersWithoutAccount() {
  const sqlPool = await getSqlPool();
  const sqlResult = await sqlPool.request().query(`
    SELECT
      Rut,
      Nombre,
      Direccion,
      Direccion2,
      Ciudad,
      Pais,
      Contacto,
      Contacto2,
      Fax,
      Telefono,
      Correo,
      EstadoCliente
    FROM jor_imp_CLI_01_softkey
    WHERE Rut IS NOT NULL
      AND LTRIM(RTRIM(EstadoCliente)) = 'Activo'
  `);

  const rows = sqlResult.recordset || [];
  if (rows.length === 0) return [];

  const pool = await poolPromise;
  const [userRows] = await pool.query('SELECT rut FROM users');

  // Normalize removing trailing 'C' for comparison (SQL Server RUTs may have 'C' suffix)
  const stripTrailingC = (rut) => {
    const n = normalizeRut(rut).toLowerCase();
    return n.endsWith('c') ? n.slice(0, -1) : n;
  };

  const userRuts = new Set(userRows.map((row) => stripTrailingC(row.rut)));
  const missing = rows.filter((row) => !userRuts.has(stripTrailingC(row.Rut)));
  
  logger.info(`[getCustomersWithoutAccount] customers=${rows.length} users=${userRows.length} missing=${missing.length}`);

  return rows
    .filter((row) => !userRuts.has(stripTrailingC(row.Rut)))
    .map((row) => new Customer({
      id: null,
      rut: row.Rut?.trim() || null,
      name: row.Nombre?.trim() || null,
      address: row.Direccion?.trim() || null,
      address_alt: row.Direccion2?.trim() || null,
      city: row.Ciudad?.trim() || null,
      country: row.Pais?.trim() || null,
      contact_name: row.Contacto?.trim() || null,
      contact_secondary: row.Contacto2?.trim() || null,
      fax: row.Fax?.trim() || null,
      phone: row.Telefono?.trim() || null,
      email: row.Contacto2?.trim() || null
    }));
}

/**
 * Elimina un contacto de un cliente
 * @param {number} contactId - ID del contacto a eliminar
 * @returns {boolean} true si se eliminó, false si no se encontró
 */
async function deleteCustomerContact(customer_rut, contactIdx) {
  const pool = await poolPromise;
  
  // Obtener el registro de contactos
  const [contactRecord] = await pool.query(
    'SELECT contact_email FROM customer_contacts WHERE rut = ?', 
    [customer_rut]
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
    'UPDATE customer_contacts SET contact_email = ? WHERE rut = ?',
    [JSON.stringify(updatedContacts), customer_rut]
  );
  
  return true;
}

async function updateCustomerContact(customer_rut, contactIdx, contactData) {
  const pool = await poolPromise;

  const [contactRecord] = await pool.query(
    'SELECT contact_email FROM customer_contacts WHERE rut = ?',
    [customer_rut]
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
    'UPDATE customer_contacts SET contact_email = ? WHERE rut = ?',
    [JSON.stringify(contacts), customer_rut]
  );

  return contacts[contactIndex];
}

async function sellerHasAccessToCustomerRut(sellerRut, customerRut) {
  const rawSellerRut = String(sellerRut || '').trim();
  const rawCustomerRut = String(customerRut || '').trim();
  if (!rawSellerRut || !rawCustomerRut) {
    return false;
  }

  const pool = await poolPromise;
  const [sellerRows] = await pool.query(
    'SELECT codigo FROM sellers WHERE rut = ?',
    [rawSellerRut]
  );
  const sellerCodes = sellerRows
    .map((row) => String(row.codigo || '').trim())
    .filter((code) => code.length > 0);

  if (!sellerCodes.length) {
    return false;
  }

  const normalizedRut = rawCustomerRut.replace(/C$/i, '');
  const alternateRut = rawCustomerRut.toUpperCase().endsWith('C')
    ? normalizedRut
    : `${normalizedRut}C`;

  try {
    const sqlPool = await getSqlPool();
    const request = sqlPool.request();
    request.input('rut1', sql.VarChar, rawCustomerRut);
    request.input('rut2', sql.VarChar, alternateRut);
    sellerCodes.forEach((code, idx) => {
      request.input(`sellerCode${idx}`, sql.VarChar, String(code).trim());
    });
    const placeholders = sellerCodes.map((_, idx) => `@sellerCode${idx}`).join(', ');
    const query = `
      SELECT TOP 1 h.Rut
      FROM jor_imp_HDR_90_softkey h
      WHERE (h.Rut = @rut1 OR h.Rut = @rut2)
        AND h.Vendedor IN (${placeholders})
    `;
    const result = await request.query(query);
    return (result.recordset || []).length > 0;
  } catch (error) {
    logger.error(`[sellerHasAccessToCustomerRut] Error validando acceso seller=${rawSellerRut} rut=${rawCustomerRut}: ${error.message}`);
    return false;
  }
}

/**
 * Get orders for a customer (with invoice counts)
 * 
 * REFACTORING CHANGES:
 * - NEW: Function created as part of Vista refactoring
 * - Queries Vista_HDR for orders, LEFT JOIN with Vista_FACT to count invoices
 * - Uses COUNT(DISTINCT f.Factura) to get accurate invoice count per order
 * 
 * @param {string} customerRut - RUT of the customer
 * @returns {Promise<Array>} Array of orders with invoice counts
 */
async function getCustomerOrders(customerRut) {
  try {
    if (!customerRut) {
      return [];
    }

    const sqlPool = await getSqlPool();
    const request = sqlPool.request();
    request.input('customerRut', sql.VarChar, customerRut);

    // REFACTORING NOTE: LEFT JOIN Vista_HDR with Vista_FACT
    // COUNT(DISTINCT f.Factura) gives accurate invoice count per order
    // GROUP BY order fields to aggregate invoice counts
    const result = await request.query(`
      SELECT 
        h.Nro AS pc,
        h.OC AS oc,
        h.Fecha AS fecha,
        h.EstadoOV AS estado_ov,
        h.ETD_OV AS fecha_etd,
        h.ETA_OV AS fecha_eta,
        h.Clausula AS incoterm,
        h.Puerto_Destino AS puerto_destino,
        COUNT(DISTINCT f.Factura) AS invoice_count
      FROM jor_imp_HDR_90_softkey h
      LEFT JOIN jor_imp_FACT_90_softkey f ON f.Nro = h.Nro
        AND f.Factura IS NOT NULL
        AND LTRIM(RTRIM(f.Factura)) <> ''
        AND f.Factura <> 0
      WHERE h.Rut = @customerRut
      GROUP BY h.Nro, h.OC, h.Fecha, h.EstadoOV, h.ETD_OV, h.ETA_OV, h.Clausula, h.Puerto_Destino
      ORDER BY CAST(h.Fecha AS date) DESC
    `);

    return result.recordset || [];
  } catch (error) {
    logger.error(`Error obteniendo órdenes del cliente ${customerRut}: ${error.message}`);
    throw error;
  }
}

/**
 * Get invoices for a customer
 * 
 * REFACTORING CHANGES:
 * - NEW: Function created as part of Vista refactoring
 * - Queries Vista_FACT as primary table (invoices)
 * - INNER JOIN with Vista_HDR to get order data (OC, order date)
 * - Filters for valid invoices only
 * 
 * @param {string} customerRut - RUT of the customer
 * @returns {Promise<Array>} Array of invoices for the customer
 */
async function getCustomerInvoices(customerRut) {
  try {
    if (!customerRut) {
      return [];
    }

    const sqlPool = await getSqlPool();
    const request = sqlPool.request();
    request.input('customerRut', sql.VarChar, customerRut);

    // REFACTORING NOTE: Query Vista_FACT as primary table
    // INNER JOIN with Vista_HDR to get order data
    // Filter for valid invoices only
    // NOTE: Clausula (Incoterm) field does NOT exist in Vista_FACT, only in Vista_HDR
    // Incoterm is an order-level attribute, so we use h.Clausula
    const result = await request.query(`
      SELECT 
        f.Nro AS pc,
        f.Factura AS factura,
        f.Fecha_factura AS fecha_factura,
        f.ETD_ENC_FA AS fecha_etd_factura,
        f.ETA_ENC_FA AS fecha_eta_factura,
        h.Clausula AS incoterm,
        f.MedioDeEnvioFact AS medio_envio_factura,
        h.OC AS oc,
        h.Fecha AS order_date
      FROM jor_imp_FACT_90_softkey f
      INNER JOIN jor_imp_HDR_90_softkey h ON h.Nro = f.Nro
      WHERE h.Rut = @customerRut
        AND f.Factura IS NOT NULL
        AND LTRIM(RTRIM(f.Factura)) <> ''
        AND f.Factura <> 0
      ORDER BY CAST(f.Fecha_factura AS date) DESC
    `);

    return result.recordset || [];
  } catch (error) {
    logger.error(`Error obteniendo facturas del cliente ${customerRut}: ${error.message}`);
    throw error;
  }
}

module.exports = {
  getAllCustomerRuts,
  getCustomerByRutForUpdate,
  updateCustomerByRut,
  getAllCustomers,
  getCustomerById,  
  getCustomerByUUID,
  getCustomerByRut,
  getCustomerByRutFromSql,
  createCustomerContacts,
  getContactsByCustomerRut,
  deleteCustomerContact,
  updateCustomerContact,
  createOrUpdatePrimaryContact,
  getCustomersWithoutAccount,
  sellerHasAccessToCustomerRut,
  getCustomerOrders,
  getCustomerInvoices
};

