/**
 * Auth2FA Service
 * Handles 2FA-specific database operations
 */
class Auth2FAService {
  constructor({ mysqlPoolPromise, logger }) {
    this.pool = mysqlPoolPromise;
    this.logger = logger;
  }

  /**
   * Gets 2FA configuration for user
   * @param {number} userId - User ID
   * @returns {Promise<Object>} { twoFAEnabled, twoFASecret }
   */
  async get2FAConfig(userId) {
    try {
      const pool = await this.pool;
      const [rows] = await pool.query(
        'SELECT twoFAEnabled, twoFASecret FROM users WHERE id = ?',
        [userId]
      );

      if (rows.length === 0) {
        return null;
      }

      return {
        twoFAEnabled: !!rows[0].twoFAEnabled,
        twoFASecret: rows[0].twoFASecret
      };
    } catch (error) {
      this.logger.error(`[Auth2FAService] Error getting 2FA config: ${error.message}`);
      throw error;
    }
  }

  /**
   * Updates 2FA secret
   * @param {number} userId - User ID
   * @param {string} secret - Base32 encoded secret
   * @returns {Promise<boolean>} Success status
   */
  async update2FASecret(userId, secret) {
    try {
      const pool = await this.pool;
      await pool.query(
        'UPDATE users SET twoFASecret = ?, updated_at = NOW() WHERE id = ?',
        [secret, userId]
      );
      this.logger.info(`[Auth2FAService] 2FA secret updated for userId=${userId}`);
      return true;
    } catch (error) {
      this.logger.error(`[Auth2FAService] Error updating 2FA secret: ${error.message}`);
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
      this.logger.info(`[Auth2FAService] 2FA enabled for userId=${userId}`);
      return true;
    } catch (error) {
      this.logger.error(`[Auth2FAService] Error enabling 2FA: ${error.message}`);
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
        'UPDATE users SET twoFAEnabled = 0, updated_at = NOW() WHERE id = ?',
        [userId]
      );
      this.logger.info(`[Auth2FAService] 2FA disabled for userId=${userId}`);
      return true;
    } catch (error) {
      this.logger.error(`[Auth2FAService] Error disabling 2FA: ${error.message}`);
      throw error;
    }
  }
}

module.exports = Auth2FAService;
