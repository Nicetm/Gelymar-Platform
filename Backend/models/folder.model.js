class Folder {
    constructor({ 
      id, 
      customer_id, 
      pc, 
      oc, 
      factura, 
      name, 
      path, 
      created_at, 
      customer_uuid,
      fecha_cliente = null,
      currency = null,
      medio_envio = null,
      fecha_factura = null
    }) {
      this.id = id;
      this.customer_id = customer_id;
      this.pc = pc;
      this.oc = oc;
      this.factura = factura;
      this.name = name;
      this.path = path;
      this.created_at = created_at;
      this.customer_uuid = customer_uuid;
      this.fecha_cliente = fecha_cliente;
      this.currency = currency;
      this.medio_envio = medio_envio;
      this.fecha_factura = fecha_factura
    }
  }
  
  module.exports = Folder;
  