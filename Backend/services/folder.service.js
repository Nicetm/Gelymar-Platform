const { poolPromise } = require('../config/db');
const { getSqlPool } = require('../config/sqlserver');
const Folder = require('../models/folder.model');
const { logger } = require('../utils/logger');

/**
 * Retorna todas las carpetas asociadas a un cliente, incluyendo:
 * - UUID del cliente
 * - Cantidad de archivos por carpeta (fileCount)
 * @param {string} customerRut - RUT del cliente
 * @returns {Array<Folder>} Lista de carpetas con información extendida
 */
async function getFoldersByCustomerRut(customerRut) {
  const sqlPool = await getSqlPool();
  const mysqlPool = await poolPromise;

  logger.info(`[getFoldersByCustomerRut] SQL query start. rut=${customerRut}`);
  let sqlResult;
  try {
    sqlResult = await sqlPool.request()
      .input('rut', customerRut)
      .query(`
        SELECT
          hdr.Nro AS pc,
          hdr.OC AS oc,
          hdr.Rut AS customer_rut,
          hdr.Fecha AS fecha,
          hdr.Fecha_factura AS fecha_factura,
          hdr.Factura AS factura,
          hdr.IDNroOvMasFactura AS id_nro_ov_mas_factura,
          hdr.ETD_OV AS fecha_etd,
          hdr.ETA_OV AS fecha_eta,
          hdr.ETD_ENC_FA AS fecha_etd_factura,
          hdr.ETA_ENC_FA AS fecha_eta_factura,
          hdr.Job AS currency,
          hdr.MedioDeEnvioFact AS medio_envio_factura,
          hdr.MedioDeEnvioOV AS medio_envio_ov,
          hdr.Clausula AS incoterm,
          hdr.Puerto_Destino AS puerto_destino,
          hdr.Certificados AS certificados,
          cli.Nombre AS customer_name
        FROM jor_imp_HDR_90_softkey hdr
        LEFT JOIN jor_imp_CLI_01_softkey cli ON cli.Rut = hdr.Rut
        WHERE hdr.Rut = @rut
        ORDER BY CAST(hdr.Fecha AS date) DESC
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
    const [countRows] = await mysqlPool.query(
      `
        SELECT pc, oc, id_nro_ov_mas_factura, COUNT(*) AS fileCount
        FROM order_files
        WHERE pc IN (?)
        GROUP BY pc, oc, id_nro_ov_mas_factura
      `,
      [pcs]
    );
    countRows.forEach(row => {
      const key = `${row.pc}|${row.oc || ''}|${row.id_nro_ov_mas_factura || ''}`;
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
      id_nro_ov_mas_factura: r.id_nro_ov_mas_factura,
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
    const key = `${r.pc}|${r.oc || ''}|${r.id_nro_ov_mas_factura || ''}`;
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
    `);
  return result.recordset?.[0]?.total || 0;
}

module.exports = {
  getFoldersByCustomerRut,
  createSubfolder,
  deleteSubfolder,
  getCountDirectoryByCustomerRut,
};
