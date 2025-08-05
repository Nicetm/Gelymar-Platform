const { poolPromise } = require('../config/db');

/**
 * Inserta una nueva línea de orden en la base de datos
 * @param {object} data - Datos de la línea de orden
 * @returns {Promise<void>}
 */
const insertOrderLine = async (data) => {
  try {
    const pool = await poolPromise;
    
    const query = `
      INSERT INTO order_items (
        order_id, pc, linea, factura, localizacion, item_id, descripcion, 
        kg_solicitados, kg_despachados, unit_price, observacion, 
        mercado, embalaje, volumen, etiqueta, kto_etiqueta5, 
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `;

    const params = [
      data.order_id,
      data.pc,
      data.linea,
      data.factura,
      data.localizacion,
      data.item_id,
      data.descripcion,
      data.kg_solicitados,
      data.kg_despachados,
      data.unit_price,
      data.observacion,
      data.mercado,
      data.embalaje,
      data.volumen,
      data.etiqueta,
      data.kto_etiqueta5
    ];

    console.log(`Ejecutando INSERT en MySQL (order_items):`);
    console.log(`   Query: ${query}`);
    console.log(`   Params: [${params.map(p => `"${p}"`).join(', ')}]`);

    const [result] = await pool.query(query, params);
    
    console.log(`INSERT exitoso - ID insertado: ${result.insertId}`);
    
  } catch (error) {
    console.error(`Error en INSERT MySQL (order_items):`);
    console.error(`   Error: ${error.message}`);
    console.error(`   SQL State: ${error.sqlState}`);
    console.error(`   Error Code: ${error.errno}`);
    throw error;
  }
};

/**
 * Obtiene todas las líneas de orden existentes
 * @returns {Promise<Array<string>>}
 */
const getAllExistingOrderLines = async () => {
  const pool = await poolPromise;
  const [rows] = await pool.query('SELECT pc, linea, factura FROM order_items WHERE pc IS NOT NULL AND linea IS NOT NULL AND factura IS NOT NULL');
  return rows.map(row => `${row.pc}-${row.linea}-${row.factura}`);
};

/**
 * Obtiene todas las líneas de orden
 * @returns {Promise<Array>}
 */
const getAllOrderLines = async () => {
  const pool = await poolPromise;
  const [rows] = await pool.query('SELECT * FROM order_items ORDER BY created_at DESC');
  return rows;
};

module.exports = {
  insertOrderLine,
  getAllExistingOrderLines,
  getAllOrderLines
}; 