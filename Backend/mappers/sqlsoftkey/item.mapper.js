const { normalizeValue, normalizeDate, normalizeDecimal, normalizeNumber } = require('./utils');

const mapItemRowToOrderItem = (row = {}) => ({
  pc: normalizeValue(row.Nro),
  linea: normalizeNumber(row.Linea),
  item_code: normalizeValue(row.Item),
  item_name: normalizeValue(row.Descripcion) || normalizeValue(row.Item),
  tipo: normalizeValue(row.Tipo),
  localizacion: normalizeValue(row.Localizacion),
  descripcion: normalizeValue(row.Descripcion),
  kg_solicitados: normalizeDecimal(row.Cant_ordenada, 4),
  kg_despachados: normalizeDecimal(row.Cant_enviada, 4),
  unit_price: normalizeDecimal(row.Precio_Unit, 4),
  observacion: normalizeValue(row.Comentario),
  mercado: normalizeValue(row.Mercado),
  embalaje: normalizeValue(row.Embalaje),
  volumen: normalizeDecimal(row.Volumen, 4),
  etiqueta: normalizeValue(row.Etiqueta),
  kto_etiqueta5: normalizeValue(row.Kto_Etiqueta5),
  fecha_etd: normalizeDate(row.ETD_Item_OV),
  fecha_eta: normalizeDate(row.ETA_Item_OV),
  fecha_etd_factura: normalizeDate(row.ETD_ENC_FA),
  fecha_eta_factura: normalizeDate(row.ETA_ENC_FA),
  kg_facturados: normalizeDecimal(row.KilosFacturados, 4),
  factura: normalizeValue(row.Factura),
});

module.exports = {
  mapItemRowToOrderItem,
};
