const { normalizeValue, normalizeDate } = require('./utils');

const mapHdrRowToOrder = (row = {}) => ({
  pc: normalizeValue(row.Nro),
  oc: normalizeValue(row.OC),
  rut: normalizeValue(row.Rut),
  fecha: normalizeDate(row.Fecha),
  fecha_etd: normalizeDate(row.ETD_OV),
  fecha_eta: normalizeDate(row.ETA_OV),
  fecha_entrega: normalizeDate(row.FechaOriginalCompromisoCliente),
  currency: normalizeValue(row.Job),
  medio_envio_ov: normalizeValue(row.MedioDeEnvioOV),
  incoterm: normalizeValue(row.Clausula),
  puerto_destino: normalizeValue(row.Puerto_Destino),
  certificados: normalizeValue(row.Certificados),
  estado_ov: normalizeValue(row.EstadoOV),
  vendedor: normalizeValue(row.Vendedor),
});

module.exports = {
  mapHdrRowToOrder,
};
