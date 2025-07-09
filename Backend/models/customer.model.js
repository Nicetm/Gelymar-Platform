class Customer {
  constructor({
    id,
    uuid,
    rut,
    name,
    email,
    phone,
    fax,
    mobile,
    address,
    address_alt,
    contact_name,
    contact_secondary,
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
    this.rut = rut;
    this.name = name;
    this.email = email;
    this.phone = phone;
    this.fax = fax;
    this.mobile = mobile;
    this.address = address;
    this.address_alt = address_alt;
    this.contact_name = contact_name;
    this.contact_secondary = contact_secondary;
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
