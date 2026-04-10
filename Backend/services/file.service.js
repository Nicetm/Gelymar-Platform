const { poolPromise } = require('../config/db');
const { getSqlPool, sql } = require('../config/sqlserver');
const File = require('../models/file');
const { logger } = require('../utils/logger');
const { createOrderService } = require('./order.service');
const { normalizeOc, normalizeOcForCompare } = require('../utils/oc.util');
const { getOrderByPc, getOrderByPcOc } = createOrderService();

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
      AND LTRIM(RTRIM(EstadoCliente)) = 'Activo'
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
  factura = null,
  rut = null,
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
  fecha_generacion = null,
}) => {
  
  const pool = await poolPromise;
  if (customer_id) {
    const customer = await getCustomerByRutSql(customer_id);
    if (!customer) {
      logger.warn(`[insertFile] Cliente no encontrado en SQL rut=${customer_id}. Continuando sin validar.`);
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
      pc, oc, factura, rut, name, path, file_identifier, file_id,
      created_at, updated_at, was_sent, 
      document_type, file_type, status_id, is_generated, is_visible_to_client, fecha_generacion
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), ?, ?, ?, ?, ?, ?, ?)`,
    [
      pc, oc, factura || null, rut || null, name, path, file_identifier, file_id,
      was_sent, document_type, file_type, status_id, is_generated, visibleValue, fecha_generacion
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
        logger.error(`[getFileById] Error parseando contact_email: ${error.message || error}`);
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

const getFileByPath = async (filePath) => {
  if (!filePath) return null;
  const pool = await poolPromise;
  const normalizedPath = String(filePath).replace(/\\/g, '/');
  const [rows] = await pool.query(
    'SELECT * FROM order_files WHERE path = ? LIMIT 1',
    [normalizedPath]
  );

  let file = rows[0];
  if (!file && normalizedPath.includes('/')) {
    const dirPath = normalizedPath.split('/').slice(0, -1).join('/');
    const [dirRows] = await pool.query(
      'SELECT * FROM order_files WHERE path = ? LIMIT 1',
      [dirPath]
    );
    file = dirRows[0];
  }

  if (!file) return null;

  const pc = file.pc;
  const oc = normalizeOc(file.oc);
  const order = oc ? await getOrderByPcOc(pc, oc) : await getOrderByPc(pc);
  const customerRut = order?.rut || order?.customer_uuid || null;

  return {
    ...file,
    customer_rut: customerRut
  };
};
  
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
  
  if (data.was_sent !== undefined) {
    fields.push('was_sent = ?');
    values.push(data.was_sent);
  }
  
  // Siempre establecer file_type como PDF si se está actualizando
  fields.push('file_type = ?');
  values.push('PDF');
  
  // Agregar el ID al final
  values.push(data.id);
  
  const query = `UPDATE order_files SET ${fields.join(', ')} WHERE id = ?`;
  logger.info(`[updateFile] Executing update for file`);
  const [result] = await pool.query(query, values);
  return result;
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
      pc, oc, factura, name, path, file_identifier, file_id,
      created_at, updated_at, was_sent, 
      document_type, file_type, status_id, is_visible_to_client,
      fecha_generacion, fecha_envio
    ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), ?, ?, ?, ?, ?, ?, ?)`,
    [
      file.pc, file.oc, file.factura || null, nameToUse, pathToUse, file.file_identifier, file.file_id,
      true, file.document_type, file.file_type, 4, file.is_visible_to_client,
      file.fecha_generacion, file.fecha_envio
    ]
  );

  return result.insertId;
};

/**
 * Obtiene todas las órdenes agrupadas por RUT
 * REFACTORING NOTE: Updated to use Vista_HDR and Vista_FACT separately
 * @returns {Promise<Object>} Objeto con RUT como clave y array de órdenes como valor
 */
const getAllOrdersGroupedByRut = async (sendFrom = null, filters = {}) => {
  const sqlPool = await getSqlPool();
  const { pc, factura } = filters;

  const request = sqlPool.request();

  let query = `
    SELECT
      h.Rut,
      h.Nro,
      h.OC,
      h.Fecha,
      h.Clausula,
      f.Factura,
      f.ETD_ENC_FA,
      f.ETA_ENC_FA
    FROM jor_imp_HDR_90_softkey h
    LEFT JOIN jor_imp_FACT_90_softkey f ON f.Nro = h.Nro
    WHERE h.Rut IS NOT NULL AND h.Nro IS NOT NULL AND h.OC IS NOT NULL
  `;

  // Agregar filtro de fecha si se proporciona sendFrom
  if (sendFrom) {
    request.input('sendFrom', sql.Date, sendFrom);
    query += ` AND CAST(h.Fecha AS date) >= @sendFrom`;
  }

  // Agregar filtro de PC si se proporciona
  if (pc) {
    request.input('pc', sql.VarChar, String(pc).trim());
    query += ` AND h.Nro = @pc`;
  }

  // Agregar filtro de factura si se proporciona
  if (factura) {
    request.input('factura', sql.VarChar, String(factura).trim());
    query += ` AND f.Factura = @factura`;
  }

  query += ` ORDER BY h.Rut, h.Fecha`;

  const result = await request.query(query);

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
      created_at: order.Fecha,
      incoterm: order.Clausula,
      fecha_etd_factura: order.ETD_ENC_FA,
      fecha_eta_factura: order.ETA_ENC_FA
    });
  });

  return ordersByRut;
}

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
  const getFilesByPcOc = async (pc, oc, factura = null) => {
    const pool = await poolPromise;
    const normalizedFactura = factura !== null && factura !== undefined && factura !== '' && factura !== 0 && factura !== '0'
      ? String(factura).trim()
      : null;
    
    // Usar PC + Factura como clave única (no OC)
    const facturaClause = normalizedFactura 
      ? ' AND factura = ?' 
      : " AND (factura IS NULL OR factura = '' OR factura = 0 OR factura = '0')";
    
    const baseParams = normalizedFactura ? [pc, normalizedFactura] : [pc];
    
    const query = `SELECT * FROM order_files WHERE pc = ?${facturaClause}`;
    
    const [rows] = await pool.query(query, baseParams);
    return rows;
  };

  const getFilesByPc = async (pc, factura = null) => {
    const pool = await poolPromise;
    const normalizedFactura = factura !== null && factura !== undefined && factura !== '' && factura !== 0 && factura !== '0'
      ? String(factura).trim()
      : null;
    const queryBase = `
      SELECT 
        f.*, 
        os.id AS status_id, 
        os.name AS status_name,
        f.fecha_generacion,
        f.fecha_envio,
        f.fecha_reenvio
      FROM order_files f
      LEFT JOIN order_status os ON f.status_id = os.id
    `;

    const orderClause = `ORDER BY 
      CASE f.file_id 
        WHEN 9 THEN 1 
        WHEN 6 THEN 2 
        WHEN 15 THEN 3 
        WHEN 19 THEN 4 
        ELSE 5 
      END, f.created_at DESC`;

    if (normalizedFactura) {
      const [rows] = await pool.query(
        `${queryBase} WHERE f.pc = ? AND f.factura = ? ${orderClause}`,
        [pc, normalizedFactura]
      );
      return rows.map(row => new File(row));
    }

    const [fallbackRows] = await pool.query(
      `${queryBase} WHERE f.pc = ? ${orderClause}`,
      [pc]
    );
    return fallbackRows.map(row => new File(row));
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
    logger.error(`[getNextFileIdentifier] Error obteniendo siguiente identificador pc=${pc || 'N/A'}: ${error.message}`);
    // En caso de error, usar 1 como fallback
    return 1;
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
    logger.error(`[markFileAsVisibleToClient] Error marcando archivo como visible id=${fileId || 'N/A'}: ${error.message || error}`);
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
      WHERE h.Nro = @pc
      ORDER BY ISNULL(h.Fecha, f.Fecha_factura) DESC
    `);

    return result.recordset?.[0] || null;
  } catch (error) {
    logger.error(`[getOrderDataForPDF] Error obteniendo datos de la orden para PDF pc=${pc || 'N/A'} oc=${oc || 'N/A'}: ${error.message || error}`);
    return null;
  }
};

module.exports = {
  RenameFile,
  getFileById,
  getFileByPath,
  insertFile,
  getFiles,
  updateFile,
  duplicateFile,
  deleteFileById,
  getAllOrdersGroupedByRut,
  getAllFiles,
  getFilesByPcOc,
  getFilesByPc,
  getNextFileIdentifier,
  markFileAsVisibleToClient,
  getOrderDataForPDF
};
