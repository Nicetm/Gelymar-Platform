class CustomerContact {
    constructor({
      id,
      rut,
      name,
      email,
      phone,
      role
    }) {
      this.id = id;
      this.rut = rut;
      this.name = name;
      this.email = email;
      this.phone = phone;
      this.role = role;
    }
  }
  
  module.exports = CustomerContact;
  
