// models/order.model.js
class Order {
  constructor({
    id = null,
    rut = null,
    oc = null,
    path = '',
    created_at = null,
    updated_at = null,
    customer_name = null,
    customer_uuid = null,
    files_count = 0
  }) {
    this.id = id;
    this.rut = rut;
    this.oc = oc;
    this.path = path;
    this.created_at = created_at;
    this.updated_at = updated_at;
    this.customer_name = customer_name;
    this.customer_uuid = customer_uuid;
    this.files_count = files_count;
  }
}

module.exports = Order;
