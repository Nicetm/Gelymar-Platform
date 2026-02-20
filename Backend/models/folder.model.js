class Folder {
  constructor({
    id,
    customer_id,
    pc,
    oc,
    factura,
    id_nro_ov_mas_factura = null,
    name,
    path,
    created_at,
    customer_uuid,
    customer_name = null,
    fecha_cliente = null,
    currency = null,
    medio_envio = null,
    medio_envio_factura = null,
    medio_envio_ov = null,
    fecha = null,
    fecha_factura = null,
    fecha_etd = null,
    fecha_eta = null,
    fecha_etd_factura = null,
    fecha_eta_factura = null,
    incoterm = null,
    puerto_destino = null,
    certificados = null,
  }) {
    this.id = id;
    this.customer_id = customer_id;
    this.pc = pc;
    this.oc = oc;
    this.factura = factura;
    this.id_nro_ov_mas_factura = id_nro_ov_mas_factura;
    this.name = name;
    this.path = path;
    this.created_at = created_at;
    this.customer_uuid = customer_uuid;
    this.customer_name = customer_name;
    this.fecha_cliente = fecha_cliente;
    this.currency = currency;
    this.medio_envio = medio_envio;
    this.medio_envio_factura = medio_envio_factura;
    this.medio_envio_ov = medio_envio_ov;
    this.fecha = fecha;
    this.fecha_factura = fecha_factura;
    this.fecha_etd = fecha_etd;
    this.fecha_eta = fecha_eta;
    this.fecha_etd_factura = fecha_etd_factura;
    this.fecha_eta_factura = fecha_eta_factura;
    this.incoterm = incoterm;
    this.puerto_destino = puerto_destino;
    this.certificados = certificados;
  }
}

module.exports = Folder;
