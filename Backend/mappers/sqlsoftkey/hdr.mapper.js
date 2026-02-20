const { normalizeValue, normalizeDate } = require('./utils');

const mapHdrRowToOrder = (row = {}) => ({
  pc: normalizeValue(row.Nro),
  oc: normalizeValue(row.OC),
  rut: normalizeValue(row.Rut),
  fecha: normalizeDate(row.Fecha),
  factura: normalizeValue(row.Factura),
  fecha_factura: normalizeDate(row.Fecha_factura),
  fecha_etd: normalizeDate(row.ETD_OV),
  fecha_eta: normalizeDate(row.ETA_OV),
  fecha_etd_factura: normalizeDate(row.ETD_ENC_FA),
  fecha_eta_factura: normalizeDate(row.ETA_ENC_FA),
  currency: normalizeValue(row.Job),
  medio_envio_factura: normalizeValue(row.MedioDeEnvioFact),
  medio_envio_ov: normalizeValue(row.MedioDeEnvioOV),
  incoterm: normalizeValue(row.Clausula),
  puerto_destino: normalizeValue(row.Puerto_Destino),
  certificados: normalizeValue(row.Certificados),
  estado_ov: normalizeValue(row.EstadoOV),
  vendedor: normalizeValue(row.Vendedor),
  id_nro_ov_mas_factura: normalizeValue(row.IDNroOvMasFactura),
});

module.exports = {
  mapHdrRowToOrder,
};
