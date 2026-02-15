const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const { container } = require('../config/container');
const userService = container.resolve('userService');
const fs = require('fs');
const path = require('path');
const Handlebars = require('handlebars');
const customerService = container.resolve('customerService');
const { generateToken } = require('../utils/jwt.util');
const { sendEmail } = require('../utils/email.util');
const { logger } = require('../utils/logger');
const { normalizeRole } = require('../utils/role.util');
const mysqlPoolPromise = container.resolve('mysqlPoolPromise');
const MAX_LOGIN_ATTEMPTS = 5;

const isStrongPassword = (value) => {
  if (typeof value !== 'string') return false;
  if (value.length < 8) return false;
  if (!/[A-Z]/.test(value)) return false;
  if (!/[a-z]/.test(value)) return false;
  if (!/[0-9]/.test(value)) return false;
  return true;
};

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

const renderPasswordResetEmail = ({ userName, resetUrl }) => {
  const templatePath = path.join(__dirname, '../mail-generator/template/password-reset.hbs');
  const templateContent = fs.readFileSync(templatePath, 'utf8');
  const template = Handlebars.compile(templateContent);

  return template({
    subject: 'Reestablece tu contraseña',
    title: 'Reestablece tu contraseña',
    userName: userName || 'Usuario',
    resetUrl,
    logoUrl: 'https://www.gelymar.com/wp-content/uploads/2014/08/gelymar-logo.jpg',
    supportEmail: 'carla.torres@gelymar.com',
    disclaimer: 'Este es un correo automático. No respondas directamente a este mensaje.'
  });
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
    const identifier = email || username;

  const captchaValid = await verifyRecaptcha(captchaResponse);
  /*
  if (!captchaValid) {
      logger.warn(`Failed captcha verification for ${identifier}`);
    return res.status(400).json({ message: 'Captcha verification failed' });
  }*/

    logger.info(`Intento de login para: ${identifier}`);

  try {
    const user = await userService.findUserByEmailOrUsername(identifier);
    if (!user) {
      logger.warn(`Usuario no encontrado: ${identifier}`);
      return res.status(401).json({ message: 'Usuario o clave incorrecta' });
    }

    if (Number(user.bloqueado) === 1) {
      logger.warn(`Usuario bloqueado: ${identifier}`);
      return res.status(403).json({
        message: 'Tu cuenta ha sido bloqueada por intentos fallidos. Por favor contacta con un administrador',
        error: 'ACCOUNT_BLOCKED'
      });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      logger.warn(`Contraseña incorrecta para usuario: ${identifier}`);
      try {
        const pool = await mysqlPoolPromise;
        await pool.query(
          `
            UPDATE users
            SET
              intentos_fallidos = LEAST(COALESCE(intentos_fallidos, 0) + 1, 999),
              bloqueado = CASE
                WHEN COALESCE(intentos_fallidos, 0) + 1 >= ? THEN 1
                ELSE bloqueado
              END
            WHERE id = ?
          `,
          [MAX_LOGIN_ATTEMPTS, user.id]
        );
          const [rows] = await pool.query(
            'SELECT intentos_fallidos, bloqueado FROM users WHERE id = ?',
            [user.id]
          );
          if (rows.length && Number(rows[0].bloqueado) === 1) {
            return res.status(403).json({
              message: 'Tu cuenta ha sido bloqueada por intentos fallidos. Por favor contacta con un administrador',
              error: 'ACCOUNT_BLOCKED'
            });
          }
          if (rows.length) {
            const remainingAttempts = Math.max(
              0,
              MAX_LOGIN_ATTEMPTS - Number(rows[0].intentos_fallidos || 0)
            );
            return res.status(401).json({
              message: 'Usuario o clave incorrecta',
              remainingAttempts
            });
          }
        } catch (updateError) {
          logger.error(`Error actualizando intentos fallidos para ${identifier}: ${updateError.message}`);
        }

        return res.status(401).json({ message: 'Usuario o clave incorrecta' });
    }
    try {
    const pool = await mysqlPoolPromise;
      await pool.query('UPDATE users SET intentos_fallidos = 0 WHERE id = ?', [user.id]);
    } catch (resetError) {
      logger.error(`Error reseteando intentos fallidos para ${identifier}: ${resetError.message}`);
    }

      if (user.twoFAEnabled) {
        if (!user.twoFASecret) {
          logger.warn(`Usuario ${identifier} no enrolado en 2FA`);
          return res.status(401).json({ message: 'Cuenta no enrolada en 2FA. Escanee el QR y configure su autenticación.' });
        }

        if (!otp) {
          logger.warn(`Código 2FA requerido para usuario ${identifier}`);
          const twoFAToken = jwt.sign(
            {
              id: user.id,
              rut: user.rut,
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
          logger.warn(`Código 2FA inválido para usuario ${identifier}`);
          return res.status(401).json({ message: 'Código de autenticación inválido' });
        }
      }

    const normalizedRole = normalizeRole(user.role, user.role_id);

      const token = generateToken({
        id: user.id,
        rut: user.rut,
        username: user.username || null,
        role: normalizedRole,
        roleId: user.role_id,
      cardCode: user.cardCode || null
    });

    // Actualizar campo online a 1
    try {
      await userService.updateUserOnlineStatus(user.id, 1);
    } catch (error) {
      logger.error(`Error actualizando online=1 para usuario ${user.id}: ${error.message}`);
    }

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

      logger.info(`Login exitoso para usuario ${user.rut || user.username || 'undefined'}`);
      logger.info(`Usuario encontrado:`, { id: user.id, rut: user.rut, username: user.username, role: user.role });
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
    
      const decodedRut = decoded?.rut || decoded?.email;
      if (!decoded || !decodedRut) {
        return res.status(400).json({ message: 'Token inválido - sin rut' });
      }
      
      const user = await userService.findUserByEmailOrUsername(decodedRut);
    
      if (!user) {
        logger.warn(`Usuario no encontrado en refresh: ${decodedRut}`);
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }

    const normalizedRole = normalizeRole(user.role, user.role_id);

      const newToken = generateToken({
        id: user.id,
        rut: user.rut,
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

      logger.info(`Token refrescado para ${decodedRut}`);
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
      const identifier = payload.rut || payload.email || payload.username;
    const user = await userService.findUserByEmailOrUsername(identifier);
    if (!user || user.id !== payload.id) {
      logger.warn(`Token 2FA no coincide con usuario solicitado: ${identifier}`);
      return res.status(403).json({ message: 'Token 2FA inválido' });
    }

    if (user.twoFASecret) {
      const otpauthUrl = speakeasy.otpauthURL({
        secret: user.twoFASecret,
          label: `Gelymar:${user.rut}`,
        issuer: 'Gelymar Panel',
        encoding: 'base32'
      });

        logger.info(`QR regenerado para usuario ${user.rut}`);
      return qrcode.toDataURL(otpauthUrl, (err, dataURL) => {
        if (err) {
          logger.error(`Error generando QR en setup2FA: ${err.message}`);
          return res.status(500).json({ message: 'Error generando QR' });
        }
        return res.json({ qr: dataURL });
      });
    }

      const secret = speakeasy.generateSecret({ name: `Gelymar:${user.rut}`, length: 20 });
    await userService.updateUser2FASecret(user.id, secret.base32);

    qrcode.toDataURL(secret.otpauth_url, (err, dataURL) => {
      if (err) {
        logger.error(`Error generando QR nuevo en setup2FA: ${err.message}`);
        return res.status(500).json({ message: 'Error generando QR' });
      }
        logger.info(`Nuevo 2FA enrolado para usuario ${user.rut}`);
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
      const identifier = payload.rut || payload.email;
      const user = await userService.findUserByEmailOrUsername(identifier);
      if (!user || user.id !== payload.id) {
        logger.warn(`Token 2FA no coincide con usuario solicitado: ${identifier}`);
        return res.status(403).json({ message: 'Token 2FA inválido' });
      }

      logger.info(`Consulta de 2FA para usuario ${identifier}`);
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
    const { email, captchaResponse } = req.body;
  
    try {
      logger.info(`recoverPassword request for ${email || 'unknown'} from ${req.ip || 'unknown-ip'}`);
      const isHuman = await verifyRecaptcha(captchaResponse);
      if (!isHuman) {
        logger.warn(`Recaptcha invalido en recoverPassword: ${email}`);
        return res.status(400).json({ message: 'Captcha invalido' });
      }
      const user = await userService.findUserForPasswordRecovery(email);
      if (!user) {
        logger.warn(`Usuario no encontrado en recoverPassword: ${email}`);
        return res.status(404).json({ message: 'Usuario no encontrado' });
    }

      const recipientEmail = user.admin_email || user.customer_email;
      if (!recipientEmail) {
        logger.warn(`Email real no encontrado para recoverPassword: ${email}`);
        return res.status(404).json({ message: 'Email no encontrado para la cuenta' });
      }

      const token = jwt.sign({ userId: user.id, email }, process.env.JWT_SECRET, { expiresIn: '15m' });
    const resetUrl = `${process.env.FRONTEND_BASE_URL || 'http://localhost:2121'}/authentication/reset-password?token=${token}`;

      await sendEmail({
        to: recipientEmail,
        subject: 'Reestablece tu contraseña',
        html: renderPasswordResetEmail({
          userName: user.full_name || recipientEmail,
          resetUrl
        })
      });

      logger.info(`Correo de recuperación enviado a ${recipientEmail}`);
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
    const { token, newPassword, captchaResponse } = req.body;
    if (!token || !newPassword) {
      logger.warn('Faltan datos en resetPassword');
      return res.status(400).json({ message: 'Faltan datos' });
    }
  
    if (!isStrongPassword(newPassword)) {
      return res.status(400).json({
        message: 'La contraseña debe tener al menos 8 caracteres e incluir mayúscula, minúscula y número'
      });
    }
  
    try {
      const isHuman = await verifyRecaptcha(captchaResponse);
      if (!isHuman) {
        logger.warn('Recaptcha invalido en resetPassword');
        return res.status(400).json({ message: 'Captcha invalido' });
      }

      const { email, userId } = jwt.verify(token, process.env.JWT_SECRET);
      const user = userId
        ? await userService.findUserById(userId)
        : await userService.findUserForPasswordRecovery(email);
      if (!user) {
        logger.warn(`Usuario no encontrado en resetPassword: ${email}`);
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }

    const hashed = await bcrypt.hash(newPassword, 10);
    const pool = await mysqlPoolPromise;
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

  if (!isStrongPassword(newPassword)) {
    return res.status(400).json({
      message: 'La contraseña debe tener al menos 8 caracteres e incluir mayúscula, minúscula y número'
    });
  }

  try {
    const user = await userService.findUserByEmailOrUsername(req.user.rut || req.user.email);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    const validPassword = await bcrypt.compare(currentPassword, user.password);
    if (!validPassword) {
      return res.status(401).json({ message: 'Contraseña actual incorrecta' });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    const pool = await mysqlPoolPromise;
    await pool.query('UPDATE users SET password = ?, change_pw = 1 WHERE id = ?', [hashed, userId]);

      logger.info(`Contraseña cambiada para usuario ${user.rut}`);
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
        logger.info(`Usuario ${req.user.rut || req.user.email} desconectado - online actualizado a 0`);
    }
  } catch (error) {
    logger.error(`Error actualizando estado online en logout: ${error.message}`);
  }
  
  res.clearCookie('token');
  logger.info('Sesión cerrada correctamente');
  res.status(200).json({ message: 'Sesión cerrada correctamente' });
};
