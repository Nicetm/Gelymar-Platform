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
    fecha_eta = null,
    currency = null,
    medio_envio_factura = null,
    medio_envio_ov = null,
    incoterm = null,
    puerto_destino = null,
    certificados = null,
    estado_ov = null,
    document_count = 0
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
    this.fecha_eta = fecha_eta;
    this.currency = currency;
    this.medio_envio_factura = medio_envio_factura;
    this.medio_envio_ov = medio_envio_ov;
    this.incoterm = incoterm;
    this.puerto_destino = puerto_destino;
    this.certificados = certificados;
    this.estado_ov = estado_ov;
    this.document_count = document_count;
  }
}

module.exports = Order;
