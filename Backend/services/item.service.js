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

    console.log(`Ejecutando INSERT en MySQL (items):`);
    console.log(`   Query: ${query}`);
    console.log(`   Params: [${params.map(p => `"${p}"`).join(', ')}]`);

    const [result] = await pool.query(query, params);
    
    console.log(`INSERT exitoso - ID insertado: ${result.insertId}`);
    
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

module.exports = {
  insertItem,
  getAllItems,
  getItemByCode,
  getAllItemCodes
}; 