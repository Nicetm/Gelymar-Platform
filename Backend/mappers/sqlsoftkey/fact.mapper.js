const { normalizeValue, normalizeDate, normalizeDecimal } = require('./utils');

/**
 * Maps a Vista_FACT row to an invoice object
 * 
 * NOTE: Vista_FACT does NOT contain the Clausula (Incoterm) field.
 * Incoterm is an order-level attribute and only exists in Vista_HDR.
 * 
 * @param {Object} row - Raw row from jor_imp_FACT_90_softkey
 * @returns {Object} Normalized invoice object
 */
const mapFactRowToInvoice = (row = {}) => ({
  pc: normalizeValue(row.Nro),
  factura: normalizeValue(row.Factura),
  fecha_factura: normalizeDate(row.Fecha_factura),
  fecha_etd_factura: normalizeDate(row.ETD_ENC_FA),
  fecha_eta_factura: normalizeDate(row.ETA_ENC_FA),
  // NOTE: incoterm removed - Clausula field does not exist in Vista_FACT
  // Incoterm must be obtained from Vista_HDR (order level)
  medio_envio_factura: normalizeValue(row.MedioDeEnvioFact),
  gasto_adicional_flete: normalizeDecimal(row.GtoAdicFleteFactura, 2),
});

module.exports = {
  mapFactRowToInvoice,
};
