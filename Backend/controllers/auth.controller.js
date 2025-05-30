const { generateToken } = require('../utils/jwt.util');
const users = require('../dummy/users.json');
const bcrypt = require('bcrypt');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');

/**
 * @route POST /api/auth/login
 * @desc Login con 2FA opcional
 * @access Público
 */
exports.login = async (req, res) => {
  const { email, password, otp } = req.body;

  const user = users.find(u => u.email === email);
  if (!user) {
    return res.status(401).json({ message: 'Usuario no encontrado' });
  }

  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) {
    return res.status(401).json({ message: 'Contraseña incorrecta' });
  }

  // Si el usuario tiene 2FA habilitado
  if (user.twoFASecret) {

    const verified = speakeasy.totp.verify({
      secret: user.twoFASecret,
      encoding: 'base32',
      token: otp,
      window: 1
    });

    if (!verified) {
      return res.status(401).json({ message: 'Código 2FA inválido o no enviado' });
    }
  }

  const token = generateToken({
    id: user.id,
    email: user.email,
    username: user.username || null,
    role: user.role,
    cardCode: user.cardCode || null
  });

  res.json({ token });
};

/**
 * @route GET /api/auth/2fa/setup?email=xxx
 * @desc Genera código secreto + QR para apps 2FA y lo guarda si no existe
 * @access Público (en producción, requiere autenticación)
 */
exports.setup2FA = (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ message: 'Email requerido' });

  const user = users.find(u => u.email === email);
  if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

  // Ya tiene secret → regenerar otpauthURL y QR
  if (user.twoFASecret) {
    const otpauthUrl = speakeasy.otpauthURL({
      secret: user.twoFASecret,
      label: `Gelymar:${user.email}`,
      issuer: 'Gelymar Panel',
      encoding: 'base32'
    });

    return qrcode.toDataURL(otpauthUrl, (err, dataURL) => {
      if (err) return res.status(500).json({ message: 'Error generando QR' });
      return res.json({ qr: dataURL });
    });
  }

  // No tiene: generar nuevo secret
  const secret = speakeasy.generateSecret({ name: `Gelymar:${email}`, length: 20 });

  user.twoFASecret = secret.base32;

  // Persistir en archivo
  const usersPath = path.join(__dirname, '..', 'dummy', 'users.json');
  fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));

  qrcode.toDataURL(secret.otpauth_url, (err, dataURL) => {
    if (err) return res.status(500).json({ message: 'Error generando QR' });
    return res.json({ qr: dataURL });
  });
};
