class Vendedor {
  constructor({
    id,
    rut,
    email,
    full_name,
    phone,
    country,
    city,
    activo = 0,
    bloqueado = 0,
    role_id,
    online = 0,
    created_at,
    updated_at
  }) {
    this.id = id;
    this.rut = rut;
    this.email = email;
    this.full_name = full_name;
    this.phone = phone;
    this.country = country;
    this.city = city;
    this.activo = activo;
    this.bloqueado = bloqueado;
    this.role_id = role_id;
    this.online = online;
    this.created_at = created_at;
    this.updated_at = updated_at;
  }
}

module.exports = Vendedor;
