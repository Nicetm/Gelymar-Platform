const { poolPromise } = require('../config/db');
const { getSqlPool } = require('../config/sqlserver');
const Folder = require('../models/folder.model');
const { logger } = require('../utils/logger');

/**
 * Retorna todas las carpetas asociadas a un cliente, incluyendo:
 * - UUID del cliente
 * - Cantidad de archivos por carpeta (fileCount)
 * 
 * REFACTORING CHANGES:
 * - OLD: Queried Vista_HDR which contained invoice fields (had duplicity)
 * - NEW: LEFT JOIN Vista_HDR with Vista_FACT to get invoice data separately
 * - REASON: Vista_HDR now has one row per order, invoice data moved to Vista_FACT
 * - RESULT: Returns one row per order-invoice combination (orders without invoices have NULL invoice fields)
 * 
 * @param {string} customerRut - RUT del cliente
 * @returns {Array<Folder>} Lista de carpetas con información extendida
 */
async function getFoldersByCustomerRut(customerRut) {
  const sqlPool = await getSqlPool();
  const mysqlPool = await poolPromise;

  logger.info(`[getFoldersByCustomerRut] SQL query start. rut=${customerRut}`);
  let sqlResult;
  try {
    // REFACTORING NOTE: Vista_HDR no longer contains invoice fields
    // Invoice data now comes from Vista_FACT via LEFT JOIN
    // This query returns one row per order-invoice combination
    // Orders without invoices will have NULL invoice fields
    sqlResult = await sqlPool.request()
      .input('rut', customerRut)
      .query(`
        SELECT
          h.Nro AS pc,
          h.OC AS oc,
          h.Rut AS customer_rut,
          h.Fecha AS fecha,
          h.ETD_OV AS fecha_etd,
          h.ETA_OV AS fecha_eta,
          h.Job AS currency,
          h.MedioDeEnvioOV AS medio_envio_ov,
          h.Clausula AS incoterm,
          h.Puerto_Destino AS puerto_destino,
          h.Certificados AS certificados,
          f.Factura AS factura,
          f.Fecha_factura AS fecha_factura,
          f.ETD_ENC_FA AS fecha_etd_factura,
          f.ETA_ENC_FA AS fecha_eta_factura,
          f.MedioDeEnvioFact AS medio_envio_factura,
          cli.Nombre AS customer_name
        FROM jor_imp_HDR_90_softkey h
        LEFT JOIN jor_imp_CLI_01_softkey cli ON cli.Rut = h.Rut
        LEFT JOIN jor_imp_FACT_90_softkey f ON f.Nro = h.Nro
        WHERE h.Rut = @rut
        ORDER BY CAST(h.Fecha AS date) DESC, f.Factura ASC
      `);
  } catch (error) {
    logger.error(`[getFoldersByCustomerRut] SQL error: ${error.message}`);
    throw error;
  }
  const rows = sqlResult?.recordset || [];
  logger.info(`[getFoldersByCustomerRut] SQL rows=${rows.length}`);

  const pcs = rows.map(r => r.pc).filter(Boolean);
  const fileCountMap = {};
  if (pcs.length) {
    logger.info(`[getFoldersByCustomerRut] file counts start. pcCount=${pcs.length}`);
    // REFACTORING NOTE: File counts now grouped by (pc, oc) only
    // id_nro_ov_mas_factura field has been removed from order_files table
    const [countRows] = await mysqlPool.query(
      `
        SELECT pc, oc, COUNT(*) AS fileCount
        FROM order_files
        WHERE pc IN (?)
        GROUP BY pc, oc
      `,
      [pcs]
    );
    countRows.forEach(row => {
      const key = `${row.pc}|${row.oc || ''}`;
      fileCountMap[key] = Number(row.fileCount) || 0;
    });
  }

  return rows.map(r => {
    const folder = new Folder({
      id: r.pc,
      rut: r.customer_rut,
      oc: r.oc,
      pc: r.pc,
      customer_name: r.customer_name,
      customer_rut: r.customer_rut,
      factura: r.factura,
      fecha_factura: r.fecha_factura,
      fecha: r.fecha,
      fecha_etd: r.fecha_etd,
      fecha_eta: r.fecha_eta,
      fecha_etd_factura: r.fecha_etd_factura,
      fecha_eta_factura: r.fecha_eta_factura,
      currency: r.currency,
      medio_envio_factura: r.medio_envio_factura,
      medio_envio_ov: r.medio_envio_ov,
      incoterm: r.incoterm,
      puerto_destino: r.puerto_destino,
      certificados: r.certificados
    });
    folder.customer_uuid = r.customer_rut;
    const key = `${r.pc}|${r.oc || ''}`;
    folder.fileCount = fileCountMap[key] || 0;
    folder.document_count = folder.fileCount;
    return folder;
  });
}

/**
 * Crea una subcarpeta dentro de una carpeta existente
 * @param {Object} data - Datos de la subcarpeta
 * @param {number} data.folder_id - ID de la carpeta padre
 * @param {string} data.name - Nombre de la subcarpeta
 * @param {string} data.path - Ruta relativa
 * @returns {Object} Objeto con los datos de la subcarpeta creada
 */
async function createSubfolder({ folder_id, name, path }) {
  const pool = await poolPromise;
  const [result] = await pool.query(
    'INSERT INTO subfolders (folder_id, name, path) VALUES (?, ?, ?)',
    [folder_id, name, path]
  );
  return { id: result.insertId, folder_id, name, path };
}

/**
 * Obtiene todas las subcarpetas asociadas a una carpeta
 * @param {number} folderId - ID de la carpeta padre
 * @returns {Array<Subfolder>} Lista de subcarpetas
 */
/**
 * Elimina una subcarpeta específica por nombre dentro de una carpeta
 * @param {number} folderId - ID de la carpeta
 * @param {string} subfolderName - Nombre de la subcarpeta
 * @returns {boolean} true si se eliminó, false si no existía
 */
async function deleteSubfolder(folderId, subfolderName) {
  const pool = await poolPromise;
  const [result] = await pool.query(
    'DELETE FROM subfolders WHERE folder_id = ? AND name = ?',
    [folderId, subfolderName]
  );
  return result.affectedRows > 0;
}

/**
 * Retorna el número total de carpetas que tiene un cliente
 * @param {number} customer_id - ID del cliente
 * @returns {number} Total de carpetas
 */
async function getCountDirectoryByCustomerRut(customerRut) {
  const sqlPool = await getSqlPool();
  const result = await sqlPool.request()
    .input('rut', customerRut)
    .query(`
      SELECT COUNT(*) AS total
      FROM jor_imp_HDR_90_softkey
      WHERE Rut = @rut
        AND ISNULL(LTRIM(RTRIM(LOWER(EstadoOV))), '') <> 'cancelada'
    `);
  return result.recordset?.[0]?.total || 0;
}

module.exports = {
  getFoldersByCustomerRut,
  createSubfolder,
  deleteSubfolder,
  getCountDirectoryByCustomerRut,
};
