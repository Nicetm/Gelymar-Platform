const { poolPromise } = require('../config/db');

/**
 * Inserta un nuevo item en la base de datos
 * @param {object} data - Datos del item
 * @returns {Promise<void>}
 */
const insertItem = async (data) => {
  try {
    const pool = await poolPromise;
    
    const query = `
      INSERT INTO items (
        item_code, unique_key, item_name, item_name_extra, unidad_medida, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, NOW(), NOW())
    `;

    const params = [
      data.item_code,
      data.unique_key,
      data.item_name,
      data.item_name_extra,
      data.unidad_medida
    ];

    const [result] = await pool.query(query, params);
    
  } catch (error) {
    console.error(`Error en INSERT MySQL (items):`);
    console.error(`   Error: ${error.message}`);
    console.error(`   SQL State: ${error.sqlState}`);
    console.error(`   Error Code: ${error.errno}`);
    throw error;
  }
};

/**
 * Obtiene todos los items
 * @returns {Promise<Array>}
 */
const getAllItems = async () => {
  const pool = await poolPromise;
  const [rows] = await pool.query('SELECT * FROM items ORDER BY created_at DESC');
  return rows;
};

/**
 * Obtiene un item por su código
 * @param {string} itemCode - Código del item
 * @returns {Promise<Object|null>}
 */
const getItemByCode = async (itemCode) => {
  const pool = await poolPromise;
  const [rows] = await pool.query('SELECT * FROM items WHERE item_code = ?', [itemCode]);
  return rows.length > 0 ? rows[0] : null;
};

/**
 * Obtiene todos los códigos de items existentes
 * @returns {Promise<Array<string>>}
 */
const getAllItemCodes = async () => {
  const pool = await poolPromise;
  const [rows] = await pool.query('SELECT item_code FROM items');
  return rows.map(row => row.item_code);
};

/**
 * Obtener items por orden con validación de permisos
 * @param {number} orderId - ID de la orden
 * @param {object} user - Usuario autenticado
 * @returns {Promise<array|null>} Items de la orden o null
 */
async function getItemsByOrder(orderId, user) {
  try {
    const pool = await poolPromise;
    let query = `
      SELECT oi.*, i.item_name, i.item_code, i.unidad_medida
      FROM order_items oi
      JOIN items i ON oi.item_id = i.id
      JOIN orders o ON oi.order_id = o.id
      JOIN customers c ON o.customer_id = c.id
      WHERE o.id = ?
    `;
    let params = [orderId];

    // Si es cliente, verificar que la orden pertenezca al cliente
    if (user.role === 'client') {
      query += ' AND c.uuid = ?';
      params.push(user.uuid);
    }

    const [rows] = await pool.query(query, params);
    return rows.length > 0 ? rows : null;
  } catch (error) {
    console.error('Error en getItemsByOrder:', error.message);
    throw error;
  }
}

/**
 * Busca item por unique_key
 * @param {string} uniqueKey - Unique key del item
 * @returns {Promise<Object|null>}
 */
const getItemByUniqueKey = async (uniqueKey) => {
  const pool = await poolPromise;
  
  try {
    const [rows] = await pool.query(
      'SELECT * FROM items WHERE unique_key = ?',
      [uniqueKey]
    );
    return rows[0] || null;
  } catch (error) {
    console.error('Error buscando item por unique_key:', error);
    return null;
  }
};

/**
 * Compara campos de item para detectar cambios
 * @param {Object} existingItem - Item existente en BD
 * @param {Object} newRecord - Nuevo registro del CSV
 * @returns {Promise<boolean>} true si hay cambios
 */
// Función para normalizar valores existentes de la BD
const normalizeExistingValue = (value) => {
  if (!value || value === '' || value === 'null' || value === 'NULL') {
    return null;
  }
  return value;
};

const compareItemFields = async (existingItem, newRecord) => {
  const fieldsToCompare = [
    'item_name', 'item_name_extra', 'unidad_medida'
  ];
  
  for (const field of fieldsToCompare) {
    const existingValue = existingItem[field];
    let newValue;
    
    // Mapear campos del CSV a campos de BD
    if (field === 'item_name') {
      newValue = newRecord.Descripcion_1?.trim() || null;
    } else if (field === 'item_name_extra') {
      newValue = newRecord.Descripcion_2?.trim() || null;
    } else if (field === 'unidad_medida') {
      newValue = newRecord.Unidad_medida?.trim() || null;
    }
    
    // Normalizar el valor existente también para comparación
    const normalizedExistingValue = normalizeExistingValue(existingValue);
    
    if (normalizedExistingValue !== newValue) {
      return true;
    }
  }
  
  return false;
};

/**
 * Actualiza un item existente
 * @param {number} itemId - ID del item
 * @param {Object} itemData - Datos a actualizar
 * @returns {Promise<void>}
 */
const updateItem = async (itemId, itemData) => {
  const pool = await poolPromise;
  
  try {
    const fields = Object.keys(itemData).map(key => `${key} = ?`).join(', ');
    const values = Object.values(itemData);
    values.push(itemId);
    
    await pool.query(
      `UPDATE items SET ${fields} WHERE id = ?`,
      values
    );
  } catch (error) {
    console.error('Error actualizando item:', error);
    throw error;
  }
};

module.exports = {
  insertItem,
  getAllItems,
  getItemByCode,
  getAllItemCodes,
  getItemsByOrder,
  getItemByUniqueKey,
  compareItemFields,
  updateItem
}; 