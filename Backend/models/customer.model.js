class Customer {
  constructor({
    id,
    uuid,
    name,
    email,
    phone,
    mobile,
    address,
    country,
    city,
    status,
    created_at,
    updated_at,
    contacts = [],
    order_count = 0
  }) {
    this.id = id;
    this.uuid = uuid;
    this.name = name;
    this.email = email;
    this.phone = phone;
    this.mobile = mobile;
    this.address = address;
    this.country = country;
    this.city = city;
    this.status = status;
    this.created_at = created_at;
    this.updated_at = updated_at;
    this.contacts = contacts;
    this.order_count = order_count;
  }
}

module.exports = Customer;
