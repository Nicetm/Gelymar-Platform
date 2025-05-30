// Archivo: Backend/controllers/auth2fa.controller.js
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');

// Generar secreto 2FA y retornar QR
exports.generate2FA = (req, res) => {
  const { username } = req.body; // Requiere login previo

  const secret = speakeasy.generateSecret({ name: `Gelymar (${username})` });

  // Guardar en la DB real en producción
  req.user.temp2FASecret = secret.base32;

  qrcode.toDataURL(secret.otpauth_url, (err, dataURL) => {
    if (err) return res.status(500).json({ message: 'Error generando QR' });
    res.json({ qr: dataURL, secret: secret.base32 });
  });
};

// Verificar token TOTP
exports.verify2FA = (req, res) => {
  const { token, secret } = req.body;

  const verified = speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token,
  });

  if (!verified) return res.status(401).json({ message: 'Código inválido' });
  res.json({ success: true });
};