/**
 * Auth Service
 * Handles authentication database operations
 */
class AuthService {
  constructor({ mysqlPoolPromise, logger }) {
    this.pool = mysqlPoolPromise;
    this.logger = logger;
    this.MAX_LOGIN_ATTEMPTS = 5;
  }

  /**
   * Updates login attempt counter and blocks account if needed
   * @param {number} userId - User ID
   * @param {boolean} success - Whether login was successful
   * @returns {Promise<Object>} { blocked: boolean, remainingAttempts: number }
   */
  async updateLoginAttempts(userId, success) {
    try {
      const pool = await this.pool;

      if (success) {
        // Reset attempts on successful login
        await pool.query(
          'UPDATE users SET intentos_fallidos = 0, updated_at = NOW() WHERE id = ?',
          [userId]
        );
        this.logger.info(`[AuthService] Login attempts reset for userId=${userId}`);
        return { blocked: false, remainingAttempts: this.MAX_LOGIN_ATTEMPTS };
      }

      // Increment failed attempts
      await pool.query(
        `UPDATE users
         SET intentos_fallidos = LEAST(COALESCE(intentos_fallidos, 0) + 1, 999),
             bloqueado = CASE
               WHEN COALESCE(intentos_fallidos, 0) + 1 >= ? THEN 1
               ELSE bloqueado
             END,
             updated_at = NOW()
         WHERE id = ?`,
        [this.MAX_LOGIN_ATTEMPTS, userId]
      );

      // Check if account is now blocked
      const [rows] = await pool.query(
        'SELECT intentos_fallidos, bloqueado FROM users WHERE id = ?',
        [userId]
      );

      if (rows.length === 0) {
        return { blocked: false, remainingAttempts: 0 };
      }

      const blocked = Number(rows[0].bloqueado) === 1;
      const remainingAttempts = Math.max(
        0,
        this.MAX_LOGIN_ATTEMPTS - Number(rows[0].intentos_fallidos || 0)
      );

      this.logger.info(
        `[AuthService] Login attempt failed for userId=${userId}, ` +
        `blocked=${blocked}, remainingAttempts=${remainingAttempts}`
      );

      return { blocked, remainingAttempts };

    } catch (error) {
      this.logger.error(`[AuthService] Error updating login attempts: ${error.message}`);
      throw error;
    }
  }

  /**
   * Resets login attempts counter
   * @param {number} userId - User ID
   * @returns {Promise<boolean>} Success status
   */
  async resetLoginAttempts(userId) {
    try {
      const pool = await this.pool;
      await pool.query(
        'UPDATE users SET intentos_fallidos = 0, updated_at = NOW() WHERE id = ?',
        [userId]
      );
      this.logger.info(`[AuthService] Login attempts reset for userId=${userId}`);
      return true;
    } catch (error) {
      this.logger.error(`[AuthService] Error resetting login attempts: ${error.message}`);
      throw error;
    }
  }

  /**
   * Checks if account is blocked
   * @param {number} userId - User ID
   * @returns {Promise<boolean>} True if account is blocked
   */
  async checkAccountBlocked(userId) {
    try {
      const pool = await this.pool;
      const [rows] = await pool.query(
        'SELECT bloqueado FROM users WHERE id = ?',
        [userId]
      );

      if (rows.length === 0) {
        return false;
      }

      return Number(rows[0].bloqueado) === 1;
    } catch (error) {
      this.logger.error(`[AuthService] Error checking account blocked: ${error.message}`);
      throw error;
    }
  }

  /**
   * Updates 2FA secret for user
   * @param {number} userId - User ID
   * @param {string} secret - 2FA secret (base32)
   * @returns {Promise<boolean>} Success status
   */
  async update2FASecret(userId, secret) {
    try {
      const pool = await this.pool;
      await pool.query(
        'UPDATE users SET twoFASecret = ?, updated_at = NOW() WHERE id = ?',
        [secret, userId]
      );
      this.logger.info(`[AuthService] 2FA secret updated for userId=${userId}`);
      return true;
    } catch (error) {
      this.logger.error(`[AuthService] Error updating 2FA secret: ${error.message}`);
      throw error;
    }
  }

  /**
   * Enables 2FA for user
   * @param {number} userId - User ID
   * @returns {Promise<boolean>} Success status
   */
  async enable2FA(userId) {
    try {
      const pool = await this.pool;
      await pool.query(
        'UPDATE users SET twoFAEnabled = 1, updated_at = NOW() WHERE id = ?',
        [userId]
      );
      this.logger.info(`[AuthService] 2FA enabled for userId=${userId}`);
      return true;
    } catch (error) {
      this.logger.error(`[AuthService] Error enabling 2FA: ${error.message}`);
      throw error;
    }
  }

  /**
   * Disables 2FA for user
   * @param {number} userId - User ID
   * @returns {Promise<boolean>} Success status
   */
  async disable2FA(userId) {
    try {
      const pool = await this.pool;
      await pool.query(
        'UPDATE users SET twoFAEnabled = 0, twoFASecret = NULL, updated_at = NOW() WHERE id = ?',
        [userId]
      );
      this.logger.info(`[AuthService] 2FA disabled for userId=${userId}`);
      return true;
    } catch (error) {
      this.logger.error(`[AuthService] Error disabling 2FA: ${error.message}`);
      throw error;
    }
  }
}

module.exports = AuthService;
