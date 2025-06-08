class CustomerContact {
    constructor({
      id,
      customer_id,
      name,
      email,
      phone,
      role
    }) {
      this.id = id;
      this.customer_id = customer_id;
      this.name = name;
      this.email = email;
      this.phone = phone;
      this.role = role;
    }
  }
  
  module.exports = CustomerContact;
  