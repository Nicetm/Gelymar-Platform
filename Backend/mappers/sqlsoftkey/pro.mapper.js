const { normalizeValue } = require('./utils');

const mapProRowToItem = (row = {}) => ({
  item_code: normalizeValue(row.Item),
  item_name: normalizeValue(row.Descripcion_1),
  item_name_extra: normalizeValue(row.Descripcion_2),
  unidad_medida: normalizeValue(row.Unidad_medida),
});

module.exports = {
  mapProRowToItem,
};
