const { poolPromise } = require('../config/db');
const { logger } = require('../utils/logger');

async function logDocumentEvent({
  source,
  action,
  process,
  fileId = null,
  docType = null,
  pc,
  oc = null,
  factura = null,
  customerRut = null,
  userId = null,
  status = 'ok',
  message = null
}) {
  if (!pc) return;
  const pool = await poolPromise;
  try {
    await pool.query(
      `
      INSERT INTO document_events (
        source, action, process, file_id, doc_type, pc, oc, factura,
        customer_rut, user_id, status, message, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `,
      [
        source,
        action,
        process,
        fileId,
        docType,
        pc,
        oc,
        factura,
        customerRut,
        userId,
        status,
        message
      ]
    );
  } catch (error) {
    logger.error(`[documentEvent] Error insertando evento: ${error.message}`);
  }
}

module.exports = { logDocumentEvent };
