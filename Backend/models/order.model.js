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
    order_id,
    customer_uuid,
    files_count = 0,
    factura = null,
    fecha_factura = null,
    fecha_ingreso = null,
    fecha = null,
    fecha_etd = null,
    currency = null,
    medio_envio_factura = null
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
    this.order_id = order_id;
    this.files_count = files_count;
    this.factura = factura;
    this.fecha_factura = fecha_factura;
    this.fecha_ingreso = fecha_ingreso;
    this.fecha = fecha;
    this.fecha_etd = fecha_etd;
    this.currency = currency;
    this.medio_envio_factura = medio_envio_factura;
  }
}

module.exports = Order;
