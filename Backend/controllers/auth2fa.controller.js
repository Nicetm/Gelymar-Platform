// controllers/auth2fa.controller.js
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const pool = require('../config/db').pool;

exports.generate2FA = async (req, res) => {
  const userId = req.user.id;
  const secret = speakeasy.generateSecret({ name: `Gelymar (${req.user.email})` });

  try {
    await pool.query(
      `UPDATE users SET twoFASecret = ? WHERE id = ?`,
      [secret.base32, userId]
    );

    qrcode.toDataURL(secret.otpauth_url, (err, data_url) => {
      if (err) return res.status(500).json({ message: 'Error generando QR' });
      res.json({ qrCode: data_url, secret: secret.base32 });
    });

  } catch (error) {
    console.error('❌ Error guardando el secreto 2FA:', error);
    res.status(500).json({ message: 'Error guardando el secreto en la base de datos' });
  }
};

// Verificar token TOTP
exports.verify2FA = async (req, res) => {
  const userId = req.user.id;
  const { token } = req.body;
  const secret = req.user.twoFASecret;

  const verified = speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token,
  });

  if (!verified) return res.status(400).json({ message: 'Código inválido' });

  try {
    await pool.query(
      'UPDATE users SET twoFAEnabled = ? WHERE id = ?',
      [true, userId]
    );
    res.json({ success: true, message: '2FA verificado y activado con éxito' });
  } catch (error) {
    console.error('❌ Error al activar 2FA:', error);
    res.status(500).json({ message: 'Error al activar 2FA' });
  }
};