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
        item_code, item_name, item_name_extra, unidad_medida, created_at, updated_at
      ) VALUES (?, ?, ?, ?, NOW(), NOW())
    `;

    const params = [
      data.item_code,
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

module.exports = {
  insertItem,
  getAllItems,
  getItemByCode,
  getAllItemCodes,
  getItemsByOrder
}; 