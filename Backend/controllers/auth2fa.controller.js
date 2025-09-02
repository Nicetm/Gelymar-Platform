// controllers/auth2fa.controller.js
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const pool = require('../config/db').pool;
const { logger } = require('../utils/logger');

/**
 * @route POST /api/auth/2fa/generate
 * @desc Genera el secreto y código QR para enrolar el 2FA
 * @access Protegido (requiere JWT)
 */
exports.generate2FA = async (req, res) => {
  const userId = req.user.id;
  const secret = speakeasy.generateSecret({ name: `Gelymar (${req.user.email})` });

  logger.info(`Generando secreto 2FA para usuario ID: ${userId}`);

  try {
    await pool.query(
      `UPDATE users SET twoFASecret = ? WHERE id = ?`,
      [secret.base32, userId]
    );

    qrcode.toDataURL(secret.otpauth_url, (err, data_url) => {
      if (err) {
        logger.error(`Error generando QR para usuario ID ${userId}: ${err.message}`);
        return res.status(500).json({ message: 'Error generando QR' });
      }

      logger.info(`QR generado correctamente para usuario ID: ${userId}`);
      res.json({ qrCode: data_url, secret: secret.base32 });
    });

  } catch (error) {
    logger.error(`Error guardando el secreto 2FA para usuario ID ${userId}: ${error.message}`);
    res.status(500).json({ message: 'Error guardando el secreto en la base de datos' });
  }
};

/**
 * @route POST /api/auth/2fa/verify
 * @desc Verifica el código TOTP y activa el 2FA en la cuenta del usuario
 * @access Protegido (requiere JWT)
 */
exports.verify2FA = async (req, res) => {
  const userId = req.user.id;
  const { token } = req.body;
  const secret = req.user.twoFASecret;

  logger.info(`Verificando código 2FA para usuario ID: ${userId}`);

  const verified = speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token,
  });

  if (!verified) {
    logger.warn(`Código 2FA inválido para usuario ID: ${userId}`);
    return res.status(400).json({ message: 'Código inválido' });
  }

  try {
    await pool.query(
      'UPDATE users SET twoFAEnabled = ? WHERE id = ?',
      [true, userId]
    );

    logger.info(`2FA activado con éxito para usuario ID: ${userId}`);
    res.json({ success: true, message: '2FA verificado y activado con éxito' });
  } catch (error) {
    logger.error(`Error al activar 2FA para usuario ID ${userId}: ${error.message}`);
    res.status(500).json({ message: 'Error al activar 2FA' });
  }
};
