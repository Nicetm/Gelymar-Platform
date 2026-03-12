// controllers/auth2fa.controller.js
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const { container } = require('../config/container');
const auth2faService = container.resolve('auth2faService');
const { logger } = require('../utils/logger');
const { t } = require('../i18n');

/**
 * @route POST /api/auth/2fa/generate
 * @desc Genera el secreto y código QR para enrolar el 2FA
 * @access Protegido (requiere JWT)
 */
exports.generate2FA = async (req, res) => {
  const userId = req.user.id;
  const secret = speakeasy.generateSecret({ name: `Gelymar (${req.user.rut || req.user.email})` });

  logger.info(`Generando secreto 2FA para usuario ID: ${userId}`);

  try {
    await auth2faService.update2FASecret(userId, secret.base32);

    qrcode.toDataURL(secret.otpauth_url, (err, data_url) => {
      if (err) {
        logger.error(`Error generando QR para usuario ID ${userId}: ${err.message}`);
        return res.status(500).json({ message: t('auth.qr_generation_error', req.lang || 'es') });
      }

      logger.info(`QR generado correctamente para usuario ID: ${userId}`);
      res.json({ qrCode: data_url, secret: secret.base32 });
    });

  } catch (error) {
    logger.error(`Error guardando el secreto 2FA para usuario ID ${userId}: ${error.message}`);
    res.status(500).json({ message: t('auth.2fa_qr_error', req.lang || 'es') });
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
    return res.status(400).json({ message: t('auth.2fa_invalid_code', req.lang || 'es') });
  }

  try {
    await auth2faService.enable2FA(userId);

    logger.info(`2FA activado con éxito para usuario ID: ${userId}`);
    res.json({ success: true, message: t('auth.2fa_verified_success', req.lang || 'es') });
  } catch (error) {
    logger.error(`Error al activar 2FA para usuario ID ${userId}: ${error.message}`);
    res.status(500).json({ message: t('auth.2fa_activation_error', req.lang || 'es') });
  }
};
