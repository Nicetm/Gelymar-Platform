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
        tipo, fecha_etd, fecha_eta, kg_facturados,
        csv_row_hash, csv_file_timestamp, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
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
      data.kto_etiqueta5,
      data.tipo,
      data.fecha_etd,
      data.fecha_eta,
      data.kg_facturados,
      data.csv_row_hash || null,
      data.csv_file_timestamp || null
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
 * Obtiene todas las líneas de orden existentes con hashes para comparación
 * @returns {Promise<Array<Object>>}
 */
const getAllExistingOrderLinesWithHashes = async () => {
  const pool = await poolPromise;
  const [rows] = await pool.query(`
    SELECT 
      id, pc, linea, factura, csv_row_hash, csv_file_timestamp
    FROM order_items 
    WHERE pc IS NOT NULL AND linea IS NOT NULL AND factura IS NOT NULL
  `);
  return rows.map(row => ({
    id: row.id,
    key: `${row.pc}-${row.linea}-${row.factura}`,
    pc: row.pc,
    linea: row.linea,
    factura: row.factura,
    csv_row_hash: row.csv_row_hash,
    csv_file_timestamp: row.csv_file_timestamp
  }));
};

/**
 * Actualiza una línea de orden existente por clave compuesta
 * @param {string} lineKey - Clave compuesta (pc-linea-factura)
 * @param {Object} data - Datos a actualizar
 * @returns {Promise<void>}
 */
const updateOrderLineByKey = async (lineKey, data) => {
  const pool = await poolPromise;
  const [pc, linea, factura] = lineKey.split('-');
  
  const updateFields = [];
  const updateValues = [];
  
  // Construir campos dinámicamente
  if (data.descripcion !== undefined) updateFields.push('descripcion = ?'), updateValues.push(data.descripcion);
  if (data.localizacion !== undefined) updateFields.push('localizacion = ?'), updateValues.push(data.localizacion);
  if (data.kg_solicitados !== undefined) updateFields.push('kg_solicitados = ?'), updateValues.push(data.kg_solicitados);
  if (data.kg_despachados !== undefined) updateFields.push('kg_despachados = ?'), updateValues.push(data.kg_despachados);
  if (data.unit_price !== undefined) updateFields.push('unit_price = ?'), updateValues.push(data.unit_price);
  if (data.observacion !== undefined) updateFields.push('observacion = ?'), updateValues.push(data.observacion);
  if (data.mercado !== undefined) updateFields.push('mercado = ?'), updateValues.push(data.mercado);
  if (data.embalaje !== undefined) updateFields.push('embalaje = ?'), updateValues.push(data.embalaje);
  if (data.volumen !== undefined) updateFields.push('volumen = ?'), updateValues.push(data.volumen);
  if (data.etiqueta !== undefined) updateFields.push('etiqueta = ?'), updateValues.push(data.etiqueta);
  if (data.kto_etiqueta5 !== undefined) updateFields.push('kto_etiqueta5 = ?'), updateValues.push(data.kto_etiqueta5);
  if (data.tipo !== undefined) updateFields.push('tipo = ?'), updateValues.push(data.tipo);
  if (data.fecha_etd !== undefined) updateFields.push('fecha_etd = ?'), updateValues.push(data.fecha_etd);
  if (data.fecha_eta !== undefined) updateFields.push('fecha_eta = ?'), updateValues.push(data.fecha_eta);
  if (data.kg_facturados !== undefined) updateFields.push('kg_facturados = ?'), updateValues.push(data.kg_facturados);
  if (data.csv_row_hash !== undefined) updateFields.push('csv_row_hash = ?'), updateValues.push(data.csv_row_hash);
  if (data.csv_file_timestamp !== undefined) updateFields.push('csv_file_timestamp = ?'), updateValues.push(data.csv_file_timestamp);
  
  updateFields.push('updated_at = NOW()');
  
  const query = `UPDATE order_items SET ${updateFields.join(', ')} WHERE pc = ? AND linea = ? AND factura = ?`;
  updateValues.push(pc, linea, factura);
  
  await pool.query(query, updateValues);
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
  getAllExistingOrderLinesWithHashes,
  getAllOrderLines,
  getOrderLineByPc,
  updateOrderLineFactura,
  updateOrderLineByKey
}; 