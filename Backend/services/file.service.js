const { poolPromise } = require('../config/db');
const { getSqlPool, sql } = require('../config/sqlserver');
const File = require('../models/file');
const fs = require('fs').promises;
const path = require('path');
const { cleanDirectoryName } = require('../utils/directoryUtils');
const { createOrderService } = require('./order.service');
const { getOrderByIdSimple, getOrderByPc, getOrderByPcOc } = createOrderService();

const normalizeOc = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).trim().replace(/\s+/g, ' ');
};

const normalizeOcForCompare = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).toUpperCase().replace(/[\s()-]+/g, '');
};

const getCustomerByRutSql = async (rut) => {
  if (!rut) return null;
  const sqlPool = await getSqlPool();
  const request = sqlPool.request();
  request.input('rut', sql.VarChar, rut);
  const result = await request.query(`
    SELECT TOP 1
      Rut,
      Nombre,
      Pais,
      Correo
    FROM jor_imp_CLI_01_softkey
    WHERE Rut = @rut
  `);
  return result.recordset?.[0] || null;
};

/**
 * Inserta un nuevo archivo en la base de datos
 * @param {Object} fileData - Datos del archivo a insertar
 * @returns {Object} Resultado de la inserción
 */
const insertFile = async ({
  customer_id,
  order_id,
  pc,
  oc,
  name,
  path,
  file_identifier = null,
  file_id = null,
  was_sent = false,
  document_type = null,
  file_type = 'PDF',
  status_id = 1,
  is_generated = 1,
  is_visible_to_customer = null,
}) => {
  
  const pool = await poolPromise;
  if (customer_id) {
    const customer = await getCustomerByRutSql(customer_id);
    if (!customer) {
      console.warn(`Cliente no encontrado en SQL para rut=${customer_id}. Continuando sin validar.`);
    }
  }
  
  const visibleValue = (() => {
    if (is_visible_to_customer === null || is_visible_to_customer === undefined || is_visible_to_customer === '') {
      return null;
    }

    if (typeof is_visible_to_customer === 'boolean') {
      return is_visible_to_customer ? 1 : 0;
    }

    if (typeof is_visible_to_customer === 'number') {
      return is_visible_to_customer === 0 ? 0 : 1;
    }

  const normalized = String(is_visible_to_customer).trim().toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
    return 1;
  }
  if (normalized === 'false' || normalized === '0' || normalized === 'no') {
      return 0;
    }

    return null;
  })();

  const [result] = await pool.query(`
    INSERT INTO order_files (
      pc, oc, name, path, file_identifier, file_id,
      created_at, updated_at, was_sent, 
      document_type, file_type, status_id, is_generated, is_visible_to_client
    ) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW(), ?, ?, ?, ?, ?, ?)`,
    [
      pc, oc, name, path, file_identifier, file_id,
      was_sent, document_type, file_type, status_id, is_generated, visibleValue
    ]
  );
  return result;
};

/**
 * Renombra un archivo existente en la base de datos
 * @param {number} id 
 * @param {string} newName 
 * @returns 
 */
const RenameFile = async (id, newName, visible) => {
  const pool = await poolPromise;

  let sql = 'UPDATE order_files SET name = ?, updated_at = NOW()';
  const params = [newName];

  if (visible !== undefined && visible !== null && visible !== '') {
    sql += ', is_visible_to_client = ?';
    params.push(visible);
  }

  sql += ' WHERE id = ?';
  params.push(id);
  
  const [result] = await pool.query(sql, params);
  return result.affectedRows > 0;
}

/**
 * Elimina el archivo de la base de datos
 * @param {number} id
 * @returns {Promise<boolean>}
 */
const deleteFileById = async (id) => {
  const pool = await poolPromise;

  // Obtener la ruta del archivo antes de eliminar
  const [rows] = await pool.query('SELECT path FROM order_files WHERE id = ?', [id]);
  if (rows.length === 0) return false;

  // Eliminar de la BD
  await pool.query('DELETE FROM order_files WHERE id = ?', [id]);

  return true;
};

/**
 * Obtiene todos los archivos de una carpeta específica para un cliente
 * @param {number} customerId - ID interno del cliente
 * @param {number} folderId - ID de la carpeta
 * @returns {Array<Object>} Lista de archivos
 */
const getFiles = async (customerId, folderId) => {
  const pool = await poolPromise;
  const [rows] = await pool.query(
    `SELECT 
        f.*, 
        os.id AS status_id, 
        os.name AS status_name,
        f.fecha_generacion,
        f.fecha_envio,
        f.fecha_reenvio
     FROM order_files f
     LEFT JOIN order_status os ON f.status_id = os.id
     WHERE f.pc = ?
     ORDER BY f.created_at DESC`,
    [folderId]
  );
  return rows.map(row => new File(row));
};

/**
 * Devuelve un mapa con el conteo de archivos por carpeta del cliente
 * @param {number} customerId - ID interno del cliente
 * @returns {Object} Mapa con folder_id como clave y cantidad de archivos como valor
 */

const getFileById = async(id) => {
  const pool = await poolPromise;
  const [rows] = await pool.query('SELECT * FROM order_files WHERE id = ?', [id]);
  if (rows.length === 0) return null;

  const file = rows[0];
  const pc = file.pc;
  const oc = normalizeOc(file.oc);
  const order = oc ? await getOrderByPcOc(pc, oc) : await getOrderByPc(pc);
  const customerRut = order?.rut || order?.customer_uuid || null;
  const customerSql = customerRut ? await getCustomerByRutSql(customerRut) : null;
  const customerName = order?.customer_name || customerSql?.Nombre || null;
  const customerCountry = customerSql?.Pais || null;
  const customerEmail = customerSql?.Correo || null;

  let customerLang = null;
  if (customerCountry) {
    const [langRows] = await pool.query(
      'SELECT lang FROM country_lang WHERE country = ? LIMIT 1',
      [customerCountry]
    );
    customerLang = langRows?.[0]?.lang || null;
  }

  let contactEmails = [];
  if (customerRut) {
    const [contactRows] = await pool.query(
      'SELECT contact_email FROM customer_contacts WHERE rut = ? LIMIT 1',
      [customerRut]
    );
    const contactEmailJson = contactRows?.[0]?.contact_email;
    if (contactEmailJson) {
      try {
        const contacts = typeof contactEmailJson === 'string'
          ? JSON.parse(contactEmailJson)
          : contactEmailJson;
        if (Array.isArray(contacts)) {
          contactEmails = contacts
            .map(contact => contact.email)
            .filter(email => email && email.trim());
        }
      } catch (error) {
        console.error('Error parseando contact_email:', error);
      }
    }
  }

  file.customer_id = null;
  file.customer_rut = customerRut;
  file.customer_name = customerName;
  file.country = customerCountry;
  file.customer_email = customerEmail;
  file.lang = customerLang;
  file.contact_emails = contactEmails.join(',');

  return file;
}
  
const updateFile = async(data) => {
  const pool = await poolPromise;
  
  // Construir la query dinámicamente basada en los campos proporcionados
  const fields = [];
  const values = [];
  
  if (data.status_id !== undefined) {
    fields.push('status_id = ?');
    values.push(data.status_id);
  }
  
  if (data.is_visible_to_client !== undefined) {
    fields.push('is_visible_to_client = ?');
    values.push(data.is_visible_to_client);
  }
  
  if (data.updated_at !== undefined) {
    fields.push('updated_at = ?');
    values.push(data.updated_at);
  }
  
  if (data.path !== undefined) {
    fields.push('path = ?');
    values.push(data.path);
  }

  if (data.name !== undefined) {
    fields.push('name = ?');
    values.push(data.name);
  }
  
  if (data.fecha_generacion !== undefined) {
    fields.push('fecha_generacion = ?');
    values.push(data.fecha_generacion);
  }
  
  if (data.fecha_envio !== undefined) {
    fields.push('fecha_envio = ?');
    values.push(data.fecha_envio);
  }
  
  if (data.fecha_reenvio !== undefined) {
    fields.push('fecha_reenvio = ?');
    values.push(data.fecha_reenvio);
  }
  
  // Siempre establecer file_type como PDF si se está actualizando
  fields.push('file_type = ?');
  values.push('PDF');
  
  // Agregar el ID al final
  values.push(data.id);
  
  const query = `UPDATE order_files SET ${fields.join(', ')} WHERE id = ?`;
  await pool.query(query, values);
}

const duplicateFile = async (fileId, newPath = null, newName = null) => {

  const pool = await poolPromise;

  // Leer el registro original
  const [rows] = await pool.query(`SELECT * FROM order_files WHERE id = ?`, [fileId]);
  if (rows.length === 0) throw new Error('Archivo original no encontrado');

  const file = rows[0];

  // Usar el nuevo path si se proporciona, sino usar el original
  const pathToUse = newPath || file.path;
  const nameToUse = newName || file.name;

  // Insertar el nuevo registro duplicado
  const [result] = await pool.query(`
    INSERT INTO order_files (
      pc, oc, name, path, file_identifier, file_id,
      created_at, updated_at, was_sent, 
      document_type, file_type, status_id, is_visible_to_client,
      fecha_generacion, fecha_envio
    ) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW(), ?, ?, ?, ?, ?, ?, ?)`,
    [
      file.pc, file.oc, nameToUse, pathToUse, file.file_identifier, file.file_id,
      true, file.document_type, file.file_type, 4, file.is_visible_to_client,
      file.fecha_generacion, file.fecha_envio
    ]
  );

  return result.insertId;
};

/**
 * Obtiene todas las órdenes agrupadas por RUT
 * @returns {Promise<Object>} Objeto con RUT como clave y array de órdenes como valor
 */
const getAllOrdersGroupedByRut = async () => {
  const sqlPool = await getSqlPool();
  const result = await sqlPool.request().query(`
    SELECT
      h.Rut,
      h.Nro,
      h.OC,
      h.Factura,
      h.Fecha
    FROM jor_imp_HDR_90_softkey h
    WHERE h.Rut IS NOT NULL AND h.Nro IS NOT NULL AND h.OC IS NOT NULL
    ORDER BY h.Rut, h.Fecha
  `);

  const rows = result.recordset || [];
  
  // Agrupar por RUT
  const ordersByRut = {};
  rows.forEach(order => {
    const rut = order.Rut;
    if (!ordersByRut[rut]) {
      ordersByRut[rut] = [];
    }
    ordersByRut[rut].push({
      rut,
      pc: order.Nro,
      oc: order.OC,
      factura: order.Factura,
      created_at: order.Fecha
    });
  });
  
  return ordersByRut;
};

/**
 * Obtiene el siguiente order_id disponible
 * @returns {Promise<number>} El siguiente order_id
 */

/**
 * Obtiene todos los archivos
 * @returns {Promise<Array>}
 */
const getAllFiles = async () => {
  const pool = await poolPromise;
  const [rows] = await pool.query('SELECT * FROM order_files ORDER BY created_at DESC');
  return rows;
};

/**
 * Obtiene archivos por order_id
 * @param {number} orderId - ID del order
 * @returns {Promise<Array>}
 */
  const getFilesByPcOc = async (pc, oc) => {
    const pool = await poolPromise;
    const normalizedOc = oc ? normalizeOcForCompare(oc) : '';
    const [rows] = await pool.query(
      oc
        ? "SELECT * FROM order_files WHERE pc = ? AND REPLACE(REPLACE(REPLACE(REPLACE(UPPER(COALESCE(oc, '')), ' ', ''), '(', ''), ')', ''), '-', '') = ?"
        : 'SELECT * FROM order_files WHERE pc = ?',
      oc ? [pc, normalizedOc] : [pc]
    );
    return rows;
  };

  const getFilesByPc = async (pc) => {
    const pool = await poolPromise;
    const [rows] = await pool.query(
      `SELECT 
          f.*, 
          os.id AS status_id, 
          os.name AS status_name,
          f.fecha_generacion,
          f.fecha_envio,
          f.fecha_reenvio
       FROM order_files f
       LEFT JOIN order_status os ON f.status_id = os.id
       WHERE f.pc = ?
       ORDER BY f.created_at DESC`,
      [pc]
    );
    return rows.map(row => new File(row));
  };

/**
 * Crea archivos por defecto para una orden específica
 * @param {number} orderId - ID de la orden
 * @param {string} customerName - Nombre del cliente
 * @param {string} pc - Número PC
 * @param {string} oc - Número OC
 * @returns {Promise<Object>} Resultado de la operación
 */
const createDefaultFilesForOrder = async (orderId, customerName, pc, oc) => {
  try {
    const FILE_ID_MAP = {
      'Order Receipt Notice': 9,
      'Shipment Notice': 19,
      'Order Delivery Notice': 15,
      'Availability Notice': 6
    };

    // Traer la orden para revisar la factura
    const orderData = await getOrderByIdSimple(orderId);
    const hasFactura = orderData && orderData.factura !== null && orderData.factura !== undefined && orderData.factura !== '' && orderData.factura !== 0 && orderData.factura !== '0';

    // Verificar si ya existen archivos para esta orden
      const existingFiles = await getFilesByPcOc(pc, oc);
      const existingFileIds = new Set(existingFiles.map(f => f.file_id).filter(Boolean));

    // Documentos requeridos según factura
    const requiredDocs = hasFactura
      ? ['Shipment Notice', 'Order Delivery Notice', 'Availability Notice']
      : ['Order Receipt Notice'];

    // Determinar cuáles faltan
      const missingDocs = requiredDocs.filter(
        name => !existingFileIds.has(FILE_ID_MAP[name])
      );

    if (missingDocs.length === 0) {
      const err = new Error('FILES_ALREADY_EXIST');
      err.code = 'FILES_ALREADY_EXIST';
      err.status = 409;
      throw err;
    }

    // Usar path/identificador existente si ya había algún archivo, de lo contrario crear nuevos
    let directoryPath;
    let fileIdentifier;
    if (existingFiles.length > 0) {
      directoryPath = existingFiles[0].path;
      fileIdentifier = existingFiles[0].file_identifier || await getNextFileIdentifier(pc);
    } else {
      fileIdentifier = await getNextFileIdentifier(pc);
      directoryPath = await createClientDirectory(customerName, pc, fileIdentifier);
      if (!directoryPath) {
        throw new Error('Error creando directorio físico');
      }
    }

    const defaultDocuments = missingDocs.map(name => ({
      name,
      pc,
      oc,
      path: directoryPath,
      file_identifier: fileIdentifier,
      file_id: FILE_ID_MAP[name]
    }));

    // Insertar los archivos en la base de datos
    const createdFiles = [];
    for (const doc of defaultDocuments) {
      const result = await insertDefaultFile(doc);
      createdFiles.push({
        id: result.insertId,
        name: doc.name,
        path: doc.path
      });
    }

    return {
      success: true,
      message: 'Archivos por defecto creados exitosamente',
      filesCreated: createdFiles.length,
      directoryPath: directoryPath,
      files: createdFiles
    };

  } catch (error) {
    console.error(`Error creando archivos por defecto para orden ${orderId}:`, error.message);
    throw error;
  }
};

const createDefaultFilesForPcOc = async (pc, oc, customerName, factura) => {
  try {
    const FILE_ID_MAP = {
      'Order Receipt Notice': 9,
      'Shipment Notice': 19,
      'Order Delivery Notice': 15,
      'Availability Notice': 6
    };

    const hasFactura =
      factura !== null && factura !== undefined && factura !== '' && factura !== 0 && factura !== '0';

      const existingFiles = await getFilesByPcOc(pc, oc);
      const existingFileIds = new Set(existingFiles.map(f => f.file_id).filter(Boolean));

    const requiredDocs = hasFactura
      ? ['Shipment Notice', 'Order Delivery Notice', 'Availability Notice']
      : ['Order Receipt Notice'];

      const missingDocs = requiredDocs.filter(
        name => !existingFileIds.has(FILE_ID_MAP[name])
      );

    if (missingDocs.length === 0) {
      const err = new Error('FILES_ALREADY_EXIST');
      err.code = 'FILES_ALREADY_EXIST';
      err.status = 409;
      throw err;
    }

    let directoryPath;
    let fileIdentifier;
    if (existingFiles.length > 0) {
      directoryPath = existingFiles[0].path;
      fileIdentifier = existingFiles[0].file_identifier || await getNextFileIdentifier(pc);
    } else {
      fileIdentifier = await getNextFileIdentifier(pc);
      directoryPath = await createClientDirectory(customerName, pc, fileIdentifier);
      if (!directoryPath) {
        throw new Error('Error creando directorio físico');
      }
    }

    const defaultDocuments = missingDocs.map(name => ({
      name,
      pc,
      oc,
      path: directoryPath,
      file_identifier: fileIdentifier,
      file_id: FILE_ID_MAP[name]
    }));

    const createdFiles = [];
    for (const doc of defaultDocuments) {
      const result = await insertDefaultFile(doc);
      createdFiles.push({
        id: result.insertId,
        name: doc.name,
        path: doc.path
      });
    }

    return {
      success: true,
      message: 'Archivos por defecto creados exitosamente',
      filesCreated: createdFiles.length,
      directoryPath: directoryPath,
      files: createdFiles
    };
  } catch (error) {
    console.error(`Error creando archivos por defecto para PC ${pc}:`, error.message);
    throw error;
  }
};

/**
 * Obtiene el siguiente identificador único para un PC
 * @param {string} pc - Número PC
 * @returns {Promise<number>} Identificador único (ej: 1, 2, 3)
 */
const getNextFileIdentifier = async (pc) => {
  const pool = await poolPromise;
  
  try {
    // Buscar el último identificador usado para este PC
    const [rows] = await pool.query(`
      SELECT file_identifier 
      FROM order_files 
      WHERE pc = ? AND file_identifier IS NOT NULL
      ORDER BY file_identifier DESC 
      LIMIT 1
    `, [pc]);

    if (rows.length === 0) {
      // Si no hay archivos para este PC, empezar con 1
      return 1;
    }

    // El último identificador es un número, solo incrementarlo
    const lastIdentifier = rows[0].file_identifier;
    return lastIdentifier + 1;
    
  } catch (error) {
    console.error(`Error obteniendo siguiente identificador para PC ${pc}:`, error.message);
    // En caso de error, usar 1 como fallback
    return 1;
  }
};

/**
 * Inserta un archivo por defecto en la base de datos
 * @param {Object} fileData - Datos del archivo
 * @returns {Promise<Object>} Resultado de la inserción
 */
const insertDefaultFile = async (fileData) => {
  const pool = await poolPromise;
  
  try {
    const query = `
      INSERT INTO order_files (
        pc, oc, name, path, file_identifier, file_id, was_sent, 
        document_type, file_type, status_id, is_visible_to_client, 
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, 'PDF', 1, 0, NOW(), NOW())
    `;

    const params = [
      fileData.pc,
      fileData.oc,
      fileData.name,
      fileData.path,
      fileData.file_identifier,
      fileData.file_id || null
    ];

    const [result] = await pool.query(query, params);
    return result;
    
  } catch (error) {
    console.error(`Error insertando archivo por defecto ${fileData.name}:`, error.message);
    throw error;
  }
};

/**
 * Crea el directorio físico para el cliente y orden
 * @param {string} customerName - Nombre del cliente
 * @param {string} pc - Número PC de la orden
 * @param {string} fileIdentifier - Identificador único para diferenciar filas
 * @returns {Promise<string|null>} Ruta del directorio creado o null si hay error
 */
const createClientDirectory = async (customerName, pc, fileIdentifier) => {
  try {
    // Limpiar nombre del cliente para usar como nombre de directorio
    const cleanCustomerName = cleanDirectoryName(customerName);

    // Crear ruta del directorio: uploads/CLIENTE_NOMBRE/Numero PC_Identificador
    const directoryPath = path.join('uploads', cleanCustomerName, `${pc}_${fileIdentifier}`);
    
    // Verificar si el directorio ya existe
    try {
      await fs.access(directoryPath);
      return directoryPath;
    } catch (accessError) {
      // El directorio no existe, crearlo
    }
    
    // Crear directorio y subdirectorios si no existen
    await fs.mkdir(directoryPath, { recursive: true });
    return directoryPath;
    
  } catch (error) {
    console.error(`Error creando directorio para cliente ${customerName}, PC ${pc}:`, error.message);
    return null;
  }
};

// Función para marcar archivo como visible al cliente
const markFileAsVisibleToClient = async (fileId) => {
  try {
    const pool = await poolPromise;
    await pool.query(
      'UPDATE order_files SET is_visible_to_client = 1 WHERE id = ?',
      [fileId]
    );
  } catch (error) {
    console.error('Error marcando archivo como visible:', error);
    throw error;
  }
};

// Función para obtener datos completos de la orden para PDF
const getOrderDataForPDF = async (orderId) => {
  try {
    const key = String(orderId || '');
    let pc = key;
    let oc = '';
    if (key.includes('|')) {
      const parts = key.split('|');
      pc = parts[0] || '';
      oc = normalizeOcForCompare(parts[1] || '');
    }

    const sqlPool = await getSqlPool();
    const request = sqlPool.request();
    request.input('pc', sql.VarChar, pc);
    if (oc) request.input('oc', sql.VarChar, oc);

    const result = await request.query(`
      SELECT TOP 1
        h.*,
        c.Nombre AS customer_name,
        c.Correo AS customer_email,
        c.Rut AS customer_rut,
        c.Direccion AS customer_address,
        c.Ciudad AS customer_city,
        c.Pais AS customer_country
      FROM jor_imp_HDR_90_softkey h
      LEFT JOIN jor_imp_CLI_01_softkey c ON c.Rut = h.Rut
      WHERE h.Nro = @pc ${oc ? "AND REPLACE(REPLACE(REPLACE(REPLACE(UPPER(h.OC), ' ', ''), '(', ''), ')', ''), '-', '') = @oc" : ''}
      ORDER BY ISNULL(h.Fecha, h.Fecha_factura) DESC
    `);

    return result.recordset?.[0] || null;
  } catch (error) {
    console.error('Error obteniendo datos de la orden para PDF:', error);
    return null;
  }
};

// Función para crear archivos por defecto si no existen
const createDefaultFilesIfNotExist = async (orderId) => {
  try {
    // Verificar si ya existen archivos para esta orden
    const existingFiles = await getFilesByPc(orderId);
    if (existingFiles.length > 0) {
      return existingFiles;
    }

    // Obtener información de la orden y cliente
    const order = await getOrderByPc(orderId);

    if (!order) {
      throw new Error('Orden no encontrada');
    }

    // Crear archivos por defecto usando la función existente
    const result = await createDefaultFilesForPcOc(
      order.pc,
      order.oc,
      order.customer_name,
      order.factura
    );

    return result.files;
  } catch (error) {
    console.error(`Error creando archivos por defecto para orden ${orderId}:`, error.message);
    throw error;
  }
};

module.exports = {
  RenameFile,
  getFileById,
  insertFile,
    getFiles,
    updateFile,
    duplicateFile,
    deleteFileById,
    getAllOrdersGroupedByRut,
    getAllFiles,
    getFilesByPcOc,
    getFilesByPc,
    createDefaultFilesForOrder,
    createDefaultFilesForPcOc,
    insertDefaultFile,
  createClientDirectory,
  getNextFileIdentifier,
  markFileAsVisibleToClient,
  getOrderDataForPDF,
  createDefaultFilesIfNotExist
};
