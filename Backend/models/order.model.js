// models/order.model.js
class Order {
  constructor({
    id,
    rut,
    oc,
    pc,
    path,
    created_at,
    updated_at,
    customer_name,
    customer_uuid,
    files_count = 0,
    fecha_cliente = null,
    currency = null,
    medio_envio = null,
    factura = null,
    fecha_factura = null
  }) {
    this.id = id;
    this.rut = rut;
    this.oc = oc;
    this.pc = pc;
    this.path = path;
    this.created_at = created_at;
    this.updated_at = updated_at;
    this.customer_name = customer_name;
    this.customer_uuid = customer_uuid;
    this.files_count = files_count;
    this.fecha_cliente = fecha_cliente;
    this.currency = currency;
    this.medio_envio = medio_envio;
    this.factura = factura;
    this.fecha_factura = fecha_factura;
  }
}

module.exports = Order;
