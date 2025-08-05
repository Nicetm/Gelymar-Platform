class Folder {
    constructor({ id, customer_id, pc, oc, factura, fec_factura, name, path, created_at, customer_uuid }) {
      this.id = id;
      this.customer_id = customer_id;
      this.pc = pc;
      this.oc = oc;
      this.factura = factura;
      this.fec_factura = fec_factura;
      this.name = name;
      this.path = path;
      this.created_at = created_at;
      this.customer_uuid = customer_uuid;
    }
  }
  
  module.exports = Folder;
  