const CryptoJS = require('crypto-js');

// Clave secreta para encriptación - en producción debería estar en variables de entorno
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'gelymar-chat-encryption-key-2024-secure';

class EncryptionService {
  /**
   * Encripta un mensaje usando AES-256
   * @param {string} message - El mensaje a encriptar
   * @returns {string} - El mensaje encriptado en base64
   */
  static encrypt(message) {
    try {
      const encrypted = CryptoJS.AES.encrypt(message, ENCRYPTION_KEY).toString();
      return encrypted;
    } catch (error) {
      console.error('Error encriptando mensaje:', error);
      throw new Error('Error al encriptar el mensaje');
    }
  }

  /**
   * Desencripta un mensaje usando AES-256
   * @param {string} encryptedMessage - El mensaje encriptado en base64
   * @returns {string} - El mensaje desencriptado
   */
  static decrypt(encryptedMessage) {
    try {
      const decrypted = CryptoJS.AES.decrypt(encryptedMessage, ENCRYPTION_KEY);
      const message = decrypted.toString(CryptoJS.enc.Utf8);
      
      if (!message) {
        throw new Error('Mensaje no válido o clave incorrecta');
      }
      
      return message;
    } catch (error) {
      console.error('Error desencriptando mensaje:', error);
      throw new Error('Error al desencriptar el mensaje');
    }
  }

  /**
   * Verifica si un string está encriptado
   * @param {string} message - El mensaje a verificar
   * @returns {boolean} - True si está encriptado
   */
  static isEncrypted(message) {
    try {
      // Intentar desencriptar, si funciona está encriptado
      const decrypted = CryptoJS.AES.decrypt(message, ENCRYPTION_KEY);
      return decrypted.toString(CryptoJS.enc.Utf8) !== '';
    } catch (error) {
      return false;
    }
  }
}

module.exports = EncryptionService;
