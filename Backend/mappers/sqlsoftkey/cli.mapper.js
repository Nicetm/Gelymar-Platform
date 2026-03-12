const { normalizeValue } = require('./utils');

const mapCliRowToCustomer = (row = {}) => ({
  rut: normalizeValue(row.Rut),
  name: normalizeValue(row.Nombre),
  address: normalizeValue(row.Direccion),
  address_alt: normalizeValue(row.Direccion2),
  city: normalizeValue(row.Ciudad),
  country: normalizeValue(row.Pais),
  contact_name: normalizeValue(row.Contacto),
  contact_secondary: normalizeValue(row.Contacto2),
  fax: normalizeValue(row.Fax),
  phone: normalizeValue(row.Telefono),
  email: normalizeValue(row.Correo),
  mobile: normalizeValue(row.Mobile),
});

module.exports = {
  mapCliRowToCustomer,
};
