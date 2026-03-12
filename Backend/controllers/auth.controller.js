const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const { container } = require('../config/container');
const userService = container.resolve('userService');
const passwordService = container.resolve('passwordService');
const authService = container.resolve('authService');
const fs = require('fs');
const path = require('path');
const Handlebars = require('handlebars');
const customerService = container.resolve('customerService');
const { generateToken } = require('../utils/jwt.util');
const { sendEmail } = require('../utils/email.util');
const { logger } = require('../utils/logger');
const { normalizeRole } = require('../utils/role.util');
const { t } = require('../i18n');
const MAX_LOGIN_ATTEMPTS = 5;

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

  // Verificar si recaptcha está habilitado
  let recaptchaEnabled = true;
  try {
    const configService = require('../services/config.service');
    const config = await configService.getConfigByName('setRecapchaLogin');
    recaptchaEnabled = config?.params?.enable === 1;
  } catch (error) {
    logger.warn(`Error obteniendo config de recaptcha: ${error.message}`);
  }

  // Solo validar recaptcha si está habilitado
  if (recaptchaEnabled) {
    const captchaValid = await verifyRecaptcha(captchaResponse);
    if (!captchaValid) {
      logger.warn(`Failed captcha verification for ${identifier}`);
      return res.status(400).json({ message: t('auth.captcha_failed', req.lang || 'es') });
    }
  }

    logger.info(`Intento de login para: ${identifier}`);

  try {
    const user = await userService.findUserByEmailOrUsername(identifier);
    if (!user) {
      logger.warn(`Usuario no encontrado: ${identifier}`);
      return res.status(401).json({ message: t('auth.invalid_credentials', req.lang || 'es') });
    }

    if (Number(user.bloqueado) === 1) {
      logger.warn(`Usuario bloqueado: ${identifier}`);
      return res.status(403).json({
        message: t('auth.account_blocked', req.lang || 'es'),
        error: 'ACCOUNT_BLOCKED'
      });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      logger.warn(`Contraseña incorrecta para usuario: ${identifier}`);
      try {
        const result = await authService.updateLoginAttempts(user.id, false);
        
        if (result.blocked) {
          return res.status(403).json({
            message: t('auth.account_blocked', req.lang || 'es'),
            error: 'ACCOUNT_BLOCKED'
          });
        }
        
        return res.status(401).json({
          message: t('auth.invalid_credentials', req.lang || 'es'),
          remainingAttempts: result.remainingAttempts
        });
      } catch (updateError) {
        logger.error(`Error actualizando intentos fallidos para ${identifier}: ${updateError.message}`);
      }

      return res.status(401).json({ message: t('auth.invalid_credentials', req.lang || 'es') });
    }
    try {
      await authService.updateLoginAttempts(user.id, true);
    } catch (resetError) {
      logger.error(`Error reseteando intentos fallidos para ${identifier}: ${resetError.message}`);
    }

      if (user.twoFAEnabled) {
        if (!user.twoFASecret) {
          logger.warn(`Usuario ${identifier} no enrolado en 2FA`);
          return res.status(401).json({ message: t('auth.not_enrolled_2fa', req.lang || 'es') });
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
          message: t('auth.2fa_required', req.lang || 'es'),
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
          return res.status(401).json({ message: t('auth.invalid_2fa_code', req.lang || 'es') });
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
      const io = req.app.get('io');
      if (io) {
        io.to('admin-room').emit('userPresenceUpdated', { userId: user.id, online: 1 });
      }
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
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 1000,
    };

    res.cookie('token', token, cookieOptions);

      logger.info(`Login exitoso para usuario ${user.rut || user.username || 'undefined'}`);
      logger.info(`Usuario encontrado:`, { id: user.id, rut: user.rut, username: user.username, role: user.role });
    
    // Determinar URL de redirección según el rol
    let redirectUrl = '/admin/orders';
    if (normalizedRole === 'seller') {
      redirectUrl = '/seller/orders';
    } else if (normalizedRole === 'client') {
      redirectUrl = '/client/documents';
    }
    
    res.json({ 
      token,
      customersWithoutAccount,
      redirectUrl
    });

  } catch (err) {
    logger.error(`Error en login: ${err.message}`);
    res.status(500).json({ message: t('auth.login_error', req.lang || 'es') });
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
        return res.status(400).json({ message: t('auth.invalid_token_no_rut', req.lang || 'es') });
      }
      
      const user = await userService.findUserByEmailOrUsername(decodedRut);
    
      if (!user) {
        logger.warn(`Usuario no encontrado en refresh: ${decodedRut}`);
        return res.status(404).json({ message: t('errors.user_not_found', req.lang || 'es') });
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
    res.status(500).json({ message: t('auth.refresh_error', req.lang || 'es') });
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
    return res.status(401).json({ message: t('auth.2fa_auth_required', req.lang || 'es') });
  }

  try {
      const identifier = payload.rut || payload.email || payload.username;
    const user = await userService.findUserByEmailOrUsername(identifier);
    if (!user || user.id !== payload.id) {
      logger.warn(`Token 2FA no coincide con usuario solicitado: ${identifier}`);
      return res.status(403).json({ message: t('auth.invalid_2fa_token', req.lang || 'es') });
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
          return res.status(500).json({ message: t('auth.qr_generation_error', req.lang || 'es') });
        }
        return res.json({ qr: dataURL });
      });
    }

      const secret = speakeasy.generateSecret({ name: `Gelymar:${user.rut}`, length: 20 });
    await userService.updateUser2FASecret(user.id, secret.base32);

    qrcode.toDataURL(secret.otpauth_url, (err, dataURL) => {
      if (err) {
        logger.error(`Error generando QR nuevo en setup2FA: ${err.message}`);
        return res.status(500).json({ message: t('auth.qr_generation_error', req.lang || 'es') });
      }
        logger.info(`Nuevo 2FA enrolado para usuario ${user.rut}`);
      return res.json({ qr: dataURL, secret: secret.base32 });
    });

  } catch (err) {
    logger.error(`Error general en setup2FA: ${err.message}`);
    res.status(500).json({ message: t('auth.login_error', req.lang || 'es') });
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
    return res.status(401).json({ message: t('auth.2fa_auth_required', req.lang || 'es') });
  }

  try {
      const identifier = payload.rut || payload.email;
      const user = await userService.findUserByEmailOrUsername(identifier);
      if (!user || user.id !== payload.id) {
        logger.warn(`Token 2FA no coincide con usuario solicitado: ${identifier}`);
        return res.status(403).json({ message: t('auth.invalid_2fa_token', req.lang || 'es') });
      }

      logger.info(`Consulta de 2FA para usuario ${identifier}`);
    res.json({
      twoFAEnabled: !!user.twoFASecret,
      hasSecret: !!user.twoFASecret,
      isEnrolled: !!user.twoFASecret
    });

  } catch (err) {
    logger.error(`Error general en check2FAStatus: ${err.message}`);
    res.status(500).json({ message: t('auth.login_error', req.lang || 'es') });
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
        return res.status(400).json({ message: t('auth.invalid_captcha', req.lang || 'es') });
      }
      const user = await userService.findUserForPasswordRecovery(email);
      if (!user) {
        logger.warn(`Usuario no encontrado en recoverPassword: ${email}`);
        return res.status(404).json({ message: t('auth.user_not_found_recovery', req.lang || 'es') });
    }

      const recipientEmail = user.admin_email || user.customer_email;
      if (!recipientEmail) {
        logger.warn(`Email real no encontrado para recoverPassword: ${email}`);
        return res.status(404).json({ message: t('auth.email_not_found', req.lang || 'es') });
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
    res.json({ message: t('auth.recovery_email_sent', req.lang || 'es') });

  } catch (err) {
    logger.error(`Error en recoverPassword: ${err.message}`);
    res.status(500).json({ message: t('auth.recovery_error', req.lang || 'es') });
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
      return res.status(400).json({ message: t('auth.missing_data', req.lang || 'es') });
    }
  
    const validation = passwordService.validatePasswordStrength(newPassword, req.lang || 'es');
    if (!validation.valid) {
      return res.status(400).json({
        message: validation.message
      });
    }
  
    try {
      const isHuman = await verifyRecaptcha(captchaResponse);
      if (!isHuman) {
        logger.warn('Recaptcha invalido en resetPassword');
        return res.status(400).json({ message: t('auth.invalid_captcha', req.lang || 'es') });
      }

      const { email, userId } = jwt.verify(token, process.env.JWT_SECRET);
      const user = userId
        ? await userService.findUserById(userId)
        : await userService.findUserForPasswordRecovery(email);
      if (!user) {
        logger.warn(`Usuario no encontrado en resetPassword: ${email}`);
        return res.status(404).json({ message: t('auth.user_not_found_recovery', req.lang || 'es') });
      }

    const result = await passwordService.resetPassword(user.id, newPassword, req.lang || 'es');
    if (!result.success) {
      return res.status(400).json({ message: result.message });
    }

    logger.info(`Contraseña actualizada para ${email}`);
    res.json({ message: t('auth.password_updated', req.lang || 'es') });

  } catch (err) {
    logger.error(`Error en resetPassword: ${err.message}`);
    res.status(400).json({ message: t('auth.invalid_or_expired_token', req.lang || 'es') });
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
    return res.status(400).json({ message: t('auth.missing_required_data', req.lang || 'es') });
  }

  const validation = passwordService.validatePasswordStrength(newPassword, req.lang || 'es');
  if (!validation.valid) {
    return res.status(400).json({
      message: validation.message
    });
  }

  try {
    const user = await userService.findUserByEmailOrUsername(req.user.rut || req.user.email);
    if (!user) {
      return res.status(404).json({ message: t('errors.user_not_found', req.lang || 'es') });
    }

    const result = await passwordService.changePassword(userId, currentPassword, newPassword, req.lang || 'es');
    if (!result.success) {
      if (result.message.includes('incorrecta')) {
        return res.status(401).json({ message: result.message });
      }
      return res.status(400).json({ message: result.message });
    }

      logger.info(`Contraseña cambiada para usuario ${user.rut}`);
    res.json({ message: t('auth.password_updated', req.lang || 'es') });

  } catch (err) {
    logger.error(`Error en changePassword: ${err.message}`);
    res.status(500).json({ message: t('auth.change_password_error', req.lang || 'es') });
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
      const io = req.app.get('io');
      if (io) {
        io.to('admin-room').emit('userPresenceUpdated', { userId: req.user.id, online: 0 });
      }
      logger.info(`Usuario ${req.user.rut || req.user.email} desconectado - online actualizado a 0`);
    }
  } catch (error) {
    logger.error(`Error actualizando estado online en logout: ${error.message}`);
  }
  
  res.clearCookie('token');
  logger.info('Sesión cerrada correctamente');
  res.status(200).json({ message: t('auth.logout_success', req.lang || 'es') });
};

/**
 * @route POST /api/auth/generate-token
 * @desc Genera un token JWT válido con usuario y contraseña (sin 2FA)
 * @access Público
 */
exports.generateToken = async (req, res) => {
  const { email, username, password } = req.body;
  const identifier = email || username;

  if (!identifier || !password) {
    return res.status(400).json({ 
      message: 'Email/username y password son requeridos' 
    });
  }

  logger.info(`Generación de token solicitada para: ${identifier}`);

  try {
    const user = await userService.findUserByEmailOrUsername(identifier);
    if (!user) {
      logger.warn(`Usuario no encontrado: ${identifier}`);
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    if (Number(user.bloqueado) === 1) {
      logger.warn(`Usuario bloqueado: ${identifier}`);
      return res.status(403).json({
        message: 'Cuenta bloqueada',
        error: 'ACCOUNT_BLOCKED'
      });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      logger.warn(`Contraseña incorrecta para usuario: ${identifier}`);
      return res.status(401).json({ message: 'Credenciales inválidas' });
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

    logger.info(`Token generado exitosamente para usuario ${user.rut || user.username}`);
    
    res.json({ 
      success: true,
      token,
      user: {
        id: user.id,
        rut: user.rut,
        username: user.username,
        role: normalizedRole
      }
    });

  } catch (err) {
    logger.error(`Error generando token: ${err.message}`);
    res.status(500).json({ message: 'Error generando token' });
  }
};
