const { container } = require('../config/container');
const vendedorService = container.resolve('vendedorService');
const passwordService = container.resolve('passwordService');
const { logger } = require('../utils/logger');
const { t } = require('../i18n');

/**
 * Obtiene todos los vendedores (usuarios con role_id = 3)
 */
exports.getVendedores = async (req, res) => {
  try {
    if (!req.user || Number(req.user.roleId) !== 1) {
      return res.status(403).json({ message: t('vendedor.unauthorized_admin_only', req.lang || 'es') });
    }

    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    logger.info(`[getVendedores] request userId=${req.user?.id || 'N/A'} search=${search}`);
    const vendedores = await vendedorService.getVendedores({ search });
    res.json(vendedores);
  } catch (error) {
    logger.error(`[getVendedores] Error: ${error.message}`);
    res.status(500).json({ message: t('vendedor.get_list_error', req.lang || 'es') });
  }
};

exports.updateVendedor = async (req, res) => {
  try {
    if (!req.user || Number(req.user.roleId) !== 1) {
      return res.status(403).json({ message: t('vendedor.unauthorized_admin_only', req.lang || 'es') });
    }

    const rut = String(req.params.rut || '').trim();
    const {
      rut: nextRut,
      email,
      phone,
      activo,
      bloqueado
    } = req.body || {};

    if (!rut) {
      return res.status(400).json({ message: t('validation.rut_required', req.lang || 'es') });
    }

    if (!nextRut || String(nextRut).trim() === '') {
      return res.status(400).json({ message: t('validation.rut_required', req.lang || 'es') });
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
      return res.status(400).json({ message: t('validation.email_invalid', req.lang || 'es') });
    }

    if (phone && String(phone).trim().length > 0) {
      const phoneLen = String(phone).trim().length;
      if (phoneLen < 8 || phoneLen > 20) {
        return res.status(400).json({ message: t('vendedor.phone_length_error', req.lang || 'es') });
      }
    }

    const normalizedActivo = Number(activo) === 1 ? 1 : 0;
    const normalizedBloqueado = Number(bloqueado) === 1 ? 1 : 0;

    const updated = await vendedorService.updateSellerByRut(rut, {
      rut: String(nextRut).trim(),
      email: email ? String(email).trim() : null,
      phone: phone ? String(phone).trim() : null,
      activo: normalizedActivo,
      bloqueado: normalizedBloqueado
    });

    if (!updated) {
      return res.status(404).json({ message: t('vendedor.not_found', req.lang || 'es') });
    }

    res.json({
      message: t('vendedor.updated_successfully', req.lang || 'es'),
      seller: updated
    });
  } catch (error) {
    if (error.code === 'RUT_EXISTS') {
      return res.status(409).json({ message: t('vendedor.rut_exists', req.lang || 'es') });
    }
    logger.error(`[updateVendedor] Error: ${error.message}`);
    res.status(500).json({ message: t('vendedor.update_error', req.lang || 'es') });
  }
};

exports.changeVendedorPassword = async (req, res) => {
  try {
    if (!req.user || Number(req.user.roleId) !== 1) {
      return res.status(403).json({ message: t('vendedor.unauthorized_admin_only', req.lang || 'es') });
    }

    const rut = String(req.params.rut || '').trim();
    const { password } = req.body || {};

    if (!rut) {
      return res.status(400).json({ message: t('validation.rut_required', req.lang || 'es') });
    }
    if (!password) {
      return res.status(400).json({ message: t('errors.password_required', req.lang || 'es') });
    }

    const validation = passwordService.validatePasswordStrength(password, req.lang || 'es');
    if (!validation.valid) {
      return res.status(400).json({
        message: validation.message
      });
    }

    const userId = await vendedorService.changeSellerPassword(rut, password);
    if (!userId) {
      return res.status(404).json({ message: t('vendedor.user_not_found', req.lang || 'es') });
    }

    const result = await passwordService.resetPassword(userId, password, req.lang || 'es');
    if (!result.success) {
      return res.status(400).json({ message: result.message });
    }

    res.json({ message: t('vendedor.password_updated', req.lang || 'es') });
  } catch (error) {
    logger.error(`[changeVendedorPassword] Error: ${error.message}`);
    res.status(500).json({ message: t('vendedor.change_password_error', req.lang || 'es') });
  }
};
