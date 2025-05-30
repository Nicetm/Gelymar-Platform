// src/routes/2fa.routes.js
const express = require('express');
const router = express.Router();
const { generate2FA, verify2FA } = require('../controllers/auth2fa.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.get('/generate', authenticate, generate2FA);
router.post('/verify', authenticate, verify2FA);

module.exports = router;

// src/controllers/auth2fa.controller.js
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');

exports.generate2FA = async (req, res) => {
  const secret = speakeasy.generateSecret({ name: 'Gelymar Panel' });
  req.user.tempSecret = secret;

  qrcode.toDataURL(secret.otpauth_url, (err, data_url) => {
    if (err) return res.status(500).json({ message: 'Error generating QR' });
    res.json({ qrCode: data_url, secret: secret.base32 });
  });
};

exports.verify2FA = (req, res) => {
  const { token } = req.body;
  const verified = speakeasy.totp.verify({
    secret: req.user.tempSecret.base32,
    encoding: 'base32',
    token,
  });

  if (!verified) return res.status(400).json({ message: 'Token inválido' });

  req.user.verified2FA = true;
  res.json({ message: '2FA verificado con éxito' });
};