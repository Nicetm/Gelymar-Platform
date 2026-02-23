const bcrypt = require('bcrypt');
const { t } = require('../i18n');

/**
 * Password Service
 * Handles password hashing, validation, and updates
 */
class PasswordService {
  constructor({ mysqlPoolPromise, logger }) {
    this.pool = mysqlPoolPromise;
    this.logger = logger;
    this.SALT_ROUNDS = 10;
  }

  /**
   * Validates password strength
   * @param {string} password - Password to validate
   * @param {string} lang - Language for error messages
   * @returns {Object} { valid: boolean, message?: string }
   */
  validatePasswordStrength(password, lang = 'es') {
    if (typeof password !== 'string') {
      return { valid: false, message: t('errors.password_must_be_string', lang) };
    }
    if (password.length < 8) {
      return { valid: false, message: t('errors.password_weak', lang) };
    }
    if (!/[A-Z]/.test(password)) {
      return { valid: false, message: t('errors.password_weak', lang) };
    }
    if (!/[a-z]/.test(password)) {
      return { valid: false, message: t('errors.password_weak', lang) };
    }
    if (!/[0-9]/.test(password)) {
      return { valid: false, message: t('errors.password_weak', lang) };
    }
    return { valid: true };
  }

  /**
   * Hashes a password using bcrypt
   * @param {string} password - Plain text password
   * @returns {Promise<string>} Hashed password
   */
  async hashPassword(password) {
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }

  /**
   * Verifies a password against a hash
   * @param {string} password - Plain text password
   * @param {string} hash - Hashed password
   * @returns {Promise<boolean>} True if password matches
   */
  async verifyPassword(password, hash) {
    return bcrypt.compare(password, hash);
  }

  /**
   * Changes user password (requires current password verification)
   * @param {number} userId - User ID
   * @param {string} currentPassword - Current password
   * @param {string} newPassword - New password
   * @param {string} lang - Language for messages
   * @returns {Promise<Object>} { success: boolean, message: string }
   */
  async changePassword(userId, currentPassword, newPassword, lang = 'es') {
    try {
      // Validate new password strength
      const validation = this.validatePasswordStrength(newPassword, lang);
      if (!validation.valid) {
        return { success: false, message: validation.message };
      }

      // Get current user
      const pool = await this.pool;
      const [users] = await pool.query(
        'SELECT password FROM users WHERE id = ?',
        [userId]
      );

      if (users.length === 0) {
        return { success: false, message: t('errors.user_not_found', lang) };
      }

      // Verify current password
      const validPassword = await this.verifyPassword(currentPassword, users[0].password);
      if (!validPassword) {
        return { success: false, message: t('errors.current_password_incorrect', lang) };
      }

      // Hash new password
      const hashedPassword = await this.hashPassword(newPassword);

      // Update database
      await pool.query(
        'UPDATE users SET password = ?, change_pw = 1, updated_at = NOW() WHERE id = ?',
        [hashedPassword, userId]
      );

      this.logger.info(`[PasswordService] Password changed for userId=${userId}`);
      return { success: true, message: t('success.password_updated', lang) };

    } catch (error) {
      this.logger.error(`[PasswordService] Error changing password: ${error.message}`);
      throw error;
    }
  }

  /**
   * Resets user password (no current password required)
   * @param {number} userId - User ID
   * @param {string} newPassword - New password
   * @param {string} lang - Language for messages
   * @returns {Promise<Object>} { success: boolean, message: string }
   */
  async resetPassword(userId, newPassword, lang = 'es') {
    try {
      // Validate new password strength
      const validation = this.validatePasswordStrength(newPassword, lang);
      if (!validation.valid) {
        return { success: false, message: validation.message };
      }

      // Hash new password
      const hashedPassword = await this.hashPassword(newPassword);

      // Update database
      const pool = await this.pool;
      const [result] = await pool.query(
        'UPDATE users SET password = ?, change_pw = 1, updated_at = NOW() WHERE id = ?',
        [hashedPassword, userId]
      );

      if (result.affectedRows === 0) {
        return { success: false, message: t('errors.user_not_found', lang) };
      }

      this.logger.info(`[PasswordService] Password reset for userId=${userId}`);
      return { success: true, message: t('success.password_updated', lang) };

    } catch (error) {
      this.logger.error(`[PasswordService] Error resetting password: ${error.message}`);
      throw error;
    }
  }
}

module.exports = PasswordService;
