const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const userService = require('../services/user.service');
const customerService = require('../services/customer.service');
const { generateToken } = require('../utils/jwt.util');
const { sendEmail } = require('../utils/email.util');
const { logger } = require('../utils/logger');
const { normalizeRole } = require('../utils/role.util');

const verifyRecaptcha = async (token) => {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) {
    return true;
  }

  if (!token) {
    return false;
  }

  try {
    const params = new URLSearchParams();
    params.append('secret', secret);
    params.append('response', token);

    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const data = await response.json();

    return data.success === true;
  } catch (error) {
    logger.error(`Error verifying reCAPTCHA: ${error.message}`);
    return false;
  }
};

const extractTwoFAPayload = (req) => {
  const headerToken = req.headers['x-2fa-token'] || req.headers['authorization'];
  if (!headerToken) {
    return null;
  }

  const rawToken = headerToken.startsWith('Bearer ')
    ? headerToken.slice(7)
    : headerToken;

  try {
    const payload = jwt.verify(rawToken, process.env.JWT_SECRET);
    if (payload?.purpose === 'twofa' || payload?.role) {
      return payload;
    }
  } catch (error) {
    logger.warn(`Token 2FA inválido: ${error.message}`);
  }

  return null;
};


/**
 * @route POST /api/auth/login
 * @desc Login con 2FA opcional
 * @access Público
 */
exports.login = async (req, res) => {
  const { email, username, password, otp, captchaResponse } = req.body;

  const captchaValid = await verifyRecaptcha(captchaResponse);
  /*
  if (!captchaValid) {
    logger.warn(`Failed captcha verification for ${email || username}`);
    return res.status(400).json({ message: 'Captcha verification failed' });
  }*/

  logger.info(`Intento de login para: ${email || username}`);

  try {
    const user = await userService.findUserByEmailOrUsername(email || username);
    if (!user) {
      logger.warn(`Usuario no encontrado: ${email || username}`);
      return res.status(401).json({ message: 'Usuario o clave incorrecta' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      logger.warn(`Contraseña incorrecta para usuario: ${email || username}`);
      return res.status(401).json({ message: 'Usuario o clave incorrecta' });
    }

    if (user.twoFAEnabled) {
      if (!user.twoFASecret) {
        logger.warn(`Usuario ${email || username} no enrolado en 2FA`);
        return res.status(401).json({ message: 'Cuenta no enrolada en 2FA. Escanee el QR y configure su autenticación.' });
      }

      if (!otp) {
        logger.warn(`Código 2FA requerido para usuario ${email || username}`);
        const twoFAToken = jwt.sign(
          {
            id: user.id,
            email: user.email,
            purpose: 'twofa'
          },
          process.env.JWT_SECRET,
          { expiresIn: '5m' }
        );

        return res.status(401).json({
          message: 'twofa_required',
          requires2FA: true,
          twoFAToken
        });
      }

      const verified = speakeasy.totp.verify({
        secret: user.twoFASecret,
        encoding: 'base32',
        token: otp,
        window: 1
      });

      if (!verified) {
        logger.warn(`Código 2FA inválido para usuario ${email || username}`);
        return res.status(401).json({ message: 'Código de autenticación inválido' });
      }
    }

    const normalizedRole = normalizeRole(user.role, user.role_id);

    const token = generateToken({
      id: user.id,
      email: user.email,
      username: user.username || null,
      role: normalizedRole,
      roleId: user.role_id,
      cardCode: user.cardCode || null
    });

    // Actualizar campo online a 1
    await userService.updateUserOnlineStatus(user.id, 1);

    // Obtener clientes sin cuenta para notificaciones
    let customersWithoutAccount = 0;
    try {
      const customers = await customerService.getCustomersWithoutAccount();
      customersWithoutAccount = customers.length;
    } catch (error) {
      logger.error(`Error obteniendo clientes sin cuenta: ${error.message}`);
    }

    const cookieOptions = {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 1000,
    };

    res.cookie('token', token, cookieOptions);

    logger.info(`Login exitoso para usuario ${user.email || user.username || 'undefined'}`);
    logger.info(`Usuario encontrado:`, { id: user.id, email: user.email, username: user.username, role: user.role });
    res.json({ 
      token,
      customersWithoutAccount 
    });

  } catch (err) {
    logger.error(`Error en login: ${err.message}`);
    res.status(500).json({ message: 'Error interno' });
  }
}

/**
 * @route POST /api/auth/refresh
 * @desc Genera un nuevo token JWT si el token actual está por expirar
 * @access Privado (requiere token JWT válido en Authorization header)
 */
exports.refreshToken = async (req, res) => {
  try {
    // El middleware ya validó el token (incluso si está expirado)
    const decoded = req.user;
    
    if (!decoded || !decoded.email) {
      return res.status(400).json({ message: 'Token inválido - sin email' });
    }
    
    const user = await userService.findUserByEmailOrUsername(decoded.email);
    
    if (!user) {
      logger.warn(`Usuario no encontrado en refresh: ${decoded.email}`);
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    const normalizedRole = normalizeRole(user.role, user.role_id);

    const newToken = generateToken({
      id: user.id,
      email: user.email,
      username: user.username || null,
      role: normalizedRole,
      roleId: user.role_id,
      cardCode: user.cardCode || null
    });

    const cookieOptions = {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 1000,
    };

    res.cookie('token', newToken, cookieOptions);

    logger.info(`Token refrescado para ${decoded.email}`);
    res.status(200).json({ token: newToken });
  } catch (error) {
    logger.error(`Error en refreshToken: ${error.message}`);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

/**
 * @route GET /api/auth/2fa/setup?email=xxx o ?username=xxx
 * @desc Genera código secreto + QR para apps 2FA y lo guarda si no existe
 * @access Público (en producción, requiere autenticación)
 */
exports.setup2FA = async (req, res) => {
  const payload = extractTwoFAPayload(req);

  if (!payload) {
    logger.warn('Intento de acceso a setup2FA sin token válido');
    return res.status(401).json({ message: 'Autenticación 2FA requerida' });
  }

  try {
    const identifier = payload.email || payload.username;
    const user = await userService.findUserByEmailOrUsername(identifier);
    if (!user || user.id !== payload.id) {
      logger.warn(`Token 2FA no coincide con usuario solicitado: ${identifier}`);
      return res.status(403).json({ message: 'Token 2FA inválido' });
    }

    if (user.twoFASecret) {
      const otpauthUrl = speakeasy.otpauthURL({
        secret: user.twoFASecret,
        label: `Gelymar:${user.email}`,
        issuer: 'Gelymar Panel',
        encoding: 'base32'
      });

      logger.info(`QR regenerado para usuario ${user.email}`);
      return qrcode.toDataURL(otpauthUrl, (err, dataURL) => {
        if (err) {
          logger.error(`Error generando QR en setup2FA: ${err.message}`);
          return res.status(500).json({ message: 'Error generando QR' });
        }
        return res.json({ qr: dataURL });
      });
    }

    const secret = speakeasy.generateSecret({ name: `Gelymar:${user.email}`, length: 20 });
    await userService.updateUser2FASecret(user.id, secret.base32);

    qrcode.toDataURL(secret.otpauth_url, (err, dataURL) => {
      if (err) {
        logger.error(`Error generando QR nuevo en setup2FA: ${err.message}`);
        return res.status(500).json({ message: 'Error generando QR' });
      }
      logger.info(`Nuevo 2FA enrolado para usuario ${user.email}`);
      return res.json({ qr: dataURL, secret: secret.base32 });
    });

  } catch (err) {
    logger.error(`Error general en setup2FA: ${err.message}`);
    res.status(500).json({ message: 'Error interno' });
  }
};

/**
 * @route GET /api/auth/2fa/status?email=xxx o ?username=xxx
 * @desc Retorna si el usuario tiene 2FA activo
 */
exports.check2FAStatus = async (req, res) => {
  const payload = extractTwoFAPayload(req);

  if (!payload) {
    logger.warn('Intento de acceso a check2FAStatus sin token válido');
    return res.status(401).json({ message: 'Autenticación 2FA requerida' });
  }

  try {
    const user = await userService.findUserByEmailOrUsername(payload.email);
    if (!user || user.id !== payload.id) {
      logger.warn(`Token 2FA no coincide con usuario solicitado: ${payload.email}`);
      return res.status(403).json({ message: 'Token 2FA inválido' });
    }

    logger.info(`Consulta de 2FA para usuario ${payload.email}`);
    res.json({
      twoFAEnabled: !!user.twoFASecret,
      hasSecret: !!user.twoFASecret,
      isEnrolled: !!user.twoFASecret
    });

  } catch (err) {
    logger.error(`Error general en check2FAStatus: ${err.message}`);
    res.status(500).json({ message: 'Error interno' });
  }
};

/**
 * @route POST /api/auth/recover
 * @desc Envía un correo con enlace/token para recuperación de contraseña
 * @access Público
 */
exports.recoverPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await userService.findUserByEmailOrUsername(email);
    if (!user) {
      logger.warn(`Usuario no encontrado en recoverPassword: ${email}`);
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '15m' });
    const resetUrl = `${process.env.FRONTEND_BASE_URL || 'http://localhost:2121'}/authentication/reset-password?token=${token}`;

    await sendEmail({
      to: email,
      subject: 'Recuperación de contraseña',
      html: `<p>Haz clic <a href="${resetUrl}">aquí</a> para restablecer tu contraseña.</p>`
    });

    logger.info(`Correo de recuperación enviado a ${email}`);
    res.json({ message: 'Correo enviado con instrucciones' });

  } catch (err) {
    logger.error(`Error en recoverPassword: ${err.message}`);
    res.status(500).json({ message: 'Error interno' });
  }
};

/**
 * @route POST /api/auth/reset
 * @desc Cambia la contraseña usando el token de recuperación
 * @access Público
 */
exports.resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) {
    logger.warn('Faltan datos en resetPassword');
    return res.status(400).json({ message: 'Faltan datos' });
  }

  try {
    const { email } = jwt.verify(token, process.env.JWT_SECRET);
    const user = await userService.findUserByEmailOrUsername(email);
    if (!user) {
      logger.warn(`Usuario no encontrado en resetPassword: ${email}`);
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    const pool = await require('../config/db').poolPromise;
    await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashed, user.id]);

    logger.info(`Contraseña actualizada para ${email}`);
    res.json({ message: 'Contraseña actualizada correctamente' });

  } catch (err) {
    logger.error(`Error en resetPassword: ${err.message}`);
    res.status(400).json({ message: 'Token inválido o expirado' });
  }
};

/**
 * @route POST /api/auth/change-password
 * @desc Cambia la contraseña del usuario autenticado
 * @access Privado (requiere JWT)
 */
exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user.id;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Faltan datos requeridos' });
  }

  try {
    const user = await userService.findUserByEmailOrUsername(req.user.email);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    const validPassword = await bcrypt.compare(currentPassword, user.password);
    if (!validPassword) {
      return res.status(401).json({ message: 'Contraseña actual incorrecta' });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    const pool = await require('../config/db').poolPromise;
    await pool.query('UPDATE users SET password = ?, change_pw = 1 WHERE id = ?', [hashed, userId]);

    logger.info(`Contraseña cambiada para usuario ${user.email}`);
    res.json({ message: 'Contraseña actualizada correctamente' });

  } catch (err) {
    logger.error(`Error en changePassword: ${err.message}`);
    res.status(500).json({ message: 'Error interno' });
  }
};

/**
 * @route POST /api/auth/logout
 * @desc Cierra la sesión del usuario (solo limpia la cookie si se usa)
 * @access Público (o protegido si se quiere)
 */
exports.logout = async (req, res) => {
  try {
    // Si hay usuario autenticado, actualizar online a 0
    if (req.user && req.user.id) {
      await userService.updateUserOnlineStatus(req.user.id, 0);
      logger.info(`Usuario ${req.user.email} desconectado - online actualizado a 0`);
    }
  } catch (error) {
    logger.error(`Error actualizando estado online en logout: ${error.message}`);
  }
  
  res.clearCookie('token');
  logger.info('Sesión cerrada correctamente');
  res.status(200).json({ message: 'Sesión cerrada correctamente' });
};
