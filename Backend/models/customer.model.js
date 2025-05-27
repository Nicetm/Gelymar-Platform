/**
 * Modelo de Cliente
 * Representa los atributos clave de la tabla OCRD (Clientes) en SAP B1.
 */
class Customer {
    constructor(cardCode, cardName, balance, phone1, email) {
      this.cardCode = cardCode;
      this.cardName = cardName;
      this.balance = balance;
      this.phone1 = phone1;
      this.email = email;
    }
  }
  
  module.exports = Customer;
  