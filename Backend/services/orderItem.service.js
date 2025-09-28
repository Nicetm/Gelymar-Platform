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
        order_id, pc, linea, sublinea, factura, localizacion, item_id, descripcion, 
        kg_solicitados, kg_despachados, unit_price, observacion, 
        mercado, embalaje, volumen, etiqueta, kto_etiqueta5, 
        tipo, fecha_etd, fecha_eta, kg_facturados, unique_key,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `;

    const params = [
      data.order_id,
      data.pc,
      data.linea,
      data.sublinea,
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
      data.kto_etiqueta5,
      data.tipo,
      data.fecha_etd,
      data.fecha_eta,
      data.kg_facturados,
      data.unique_key
    ];

    const [result] = await pool.query(query, params);
    return result.insertId;
    
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

/**
 * Obtiene una línea de orden por PC
 * @param {string} pc - Número de PC
 * @returns {Promise<object|null>} Línea de orden encontrada o null
 */
const getOrderLineByPc = async (pc) => {
  try {
    const pool = await poolPromise;
    
    const query = `
      SELECT oi.id, oi.order_id, oi.pc, oi.linea, oi.factura
      FROM order_items oi
      WHERE oi.pc = ?
      LIMIT 1
    `;
    
    const [rows] = await pool.query(query, [pc]);
    
    return rows.length > 0 ? rows[0] : null;
    
  } catch (error) {
    console.error('Error getting order line by PC:', error);
    throw error;
  }
};





/**
 * Actualiza el campo factura de una línea de orden
 * @param {number} orderLineId - ID de la línea de orden
 * @param {string} factura - Nueva factura
 * @returns {Promise<void>}
 */
const updateOrderLineFactura = async (orderLineId, factura) => {
  try {
    const pool = await poolPromise;
    
    const query = `
      UPDATE order_items 
      SET factura = ?, updated_at = NOW()
      WHERE id = ?
    `;
    
    const [result] = await pool.query(query, [factura, orderLineId]);
    
    if (result.affectedRows === 0) {
      throw new Error(`No se pudo actualizar la línea de orden con ID ${orderLineId}`);
    }
    
    console.log(`Línea de orden ${orderLineId} actualizada con factura: ${factura}`);
    
  } catch (error) {
    console.error('Error updating order line factura:', error);
    throw error;
  }
};

module.exports = {
  insertOrderLine,
  getAllExistingOrderLines,
  getAllOrderLines,
  getOrderLineByPc,
  updateOrderLineFactura
}; 