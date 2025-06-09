const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const userService = require('../services/user.services');
const { generateToken } = require('../utils/jwt.util');
const { sendEmail } = require('../utils/email.util');

/**
 * @route POST /api/auth/login
 * @desc Login con 2FA opcional
 * @access Público
 */
exports.login = async (req, res) => {
  const { email, username, password, otp } = req.body;

  const user = await userService.findUserByEmailOrUsername(email || username);
  if (!user) {
    return res.status(401).json({ message: 'Usuario no encontrado', user: user});
  }

  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) {
    return res.status(401).json({ message: 'Contraseña incorrecta' });
  }

  if (user.twoFAEnabled) {
    if (!user.twoFASecret) {
      return res.status(401).json({ message: 'Cuenta no enrolada en 2FA. Escanee el QR y configure su autenticación.' });
    }

    if (!otp) {
      return res.status(401).json({ message: 'Código 2FA requerido' });
    }

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
 * @route POST /api/auth/refresh
 * @desc Genera un nuevo token JWT si el token actual está por expirar
 * @access Privado (requiere token JWT válido en Authorization header)
 */
exports.refreshToken = async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: 'Token requerido' });

  const token = authHeader.split(' ')[1];

  jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
    if (err) return res.status(403).json({ message: 'Token inválido o expirado' });

    const user = await userService.findUserByEmailOrUsername(decoded.email);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

    const newToken = generateToken({
      id: user.id,
      email: user.email,
      username: user.username || null,
      role: user.role,
      cardCode: user.cardCode || null
    });

    res.status(200).json({ token: newToken });
  });
};

/**
 * @route GET /api/auth/2fa/setup?email=xxx
 * @desc Genera código secreto + QR para apps 2FA y lo guarda si no existe
 * @access Público (en producción, requiere autenticación)
 */
exports.setup2FA = async (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ message: 'Email requerido' });

  const user = await userService.findUserByEmailOrUsername(email);
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

  await userService.updateUser2FASecret(user.id, secret.base32);

  qrcode.toDataURL(secret.otpauth_url, (err, dataURL) => {
    if (err) return res.status(500).json({ message: 'Error generando QR' });
    return res.json({ qr: dataURL, secret: secret.base32 });
  });
};

/**
 * @route GET /api/auth/2fa/status?email=xxx
 * @desc Retorna si el usuario tiene 2FA activo
 */
exports.check2FAStatus = async (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ message: 'Email requerido' });

  const user = await userService.findUserByEmailOrUsername(email);
  if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

  res.json({ twoFAEnabled: !!user.twoFASecret });
};

/**
 * @route POST /api/auth/recover
 * @desc Envía un correo con enlace/token para recuperación de contraseña
 * @access Público
 */
exports.recoverPassword = async (req, res) => {
  const { email } = req.body;

  const user = await userService.findUserByEmailOrUsername(email);
  if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

  const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '15m' });
  const resetUrl = `http://localhost:2121/authentication/reset-password?token=${token}`;

  await sendEmail({
    to: email,
    subject: 'Recuperación de contraseña',
    html: `<p>Haz clic <a href="${resetUrl}">aquí</a> para restablecer tu contraseña.</p>`
  });

  res.json({ message: 'Correo enviado con instrucciones' });
};

/**
 * @route POST /api/auth/reset
 * @desc Cambia la contraseña usando el token de recuperación
 * @access Público
 */
exports.resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) return res.status(400).json({ message: 'Faltan datos' });

  try {
    const { email } = jwt.verify(token, process.env.JWT_SECRET);

    const user = await userService.findUserByEmailOrUsername(email);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

    const hashed = await bcrypt.hash(newPassword, 10);
    const pool = await require('../config/db').poolPromise;
    await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashed, user.id]);

    res.json({ message: 'Contraseña actualizada correctamente' });

  } catch (err) {
    res.status(400).json({ message: 'Token inválido o expirado' });
  }
};
