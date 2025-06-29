// models/order.model.js
class Order {
  constructor({
    id = null,
    customer_id,
    name,
    path = '',
    created_at = null,
    updated_at = null,
    date_etd = null,
    date_eta = null
  }) {
    this.id = id;
    this.customer_id = customer_id;
    this.name = name;
    this.path = path;
    this.created_at = created_at;
    this.updated_at = updated_at;
    this.date_etd = date_etd;
    this.date_eta = date_eta;
  }
}

module.exports = Order;
