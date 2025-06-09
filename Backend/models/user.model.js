// models/user.model.js

class User {
  constructor({
    id = null,
    email,
    username,
    password,
    role = 'user',
    cardCode = null,
    twoFASecret = null,
    twoFAEnabled = false
  }) {
    this.id = id;
    this.email = email;
    this.username = username;
    this.password = password;
    this.role = role;
    this.cardCode = cardCode;
    this.twoFASecret = twoFASecret;
    this.twoFAEnabled = twoFAEnabled;
  }
}

module.exports = User;