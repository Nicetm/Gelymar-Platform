// models/user.model.js

class User {
  constructor({
    id = null,
    rut,
    full_name,
    phone,
    country,
    city,
    password,
    role_id = 2,
    twoFASecret = null,
    twoFAEnabled = false,
    change_pw = 1
  }) {
    this.id = id;
    this.rut = rut;
    this.full_name = full_name;
    this.phone = phone;
    this.country = country;
    this.city = city;
    this.password = password;
    this.role_id = role_id;
    this.twoFASecret = twoFASecret;
    this.twoFAEnabled = twoFAEnabled;
    this.change_pw = change_pw;
  }
}

module.exports = User;
