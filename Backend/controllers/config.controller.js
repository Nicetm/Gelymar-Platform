const { container } = require('../config/container');
const { logger } = require('../utils/logger');
const { t } = require('../i18n');
const configService = container.resolve('configService');
const orderService = container.resolve('orderService');

async function getConfigParamsByName(name) {
  const config = await configService.getConfigByName(name);
  if (!config || config.params == null) {
    return null;
  }

  let params = config.params;

  if (Buffer.isBuffer(params)) {
    params = params.toString('utf8');
  }

  if (typeof params === 'string') {
    const trimmed = params.trim();
    if (!trimmed) {
      return {};
    }
    try {
      params = JSON.parse(trimmed);
    } catch (error) {
      throw new Error(`Error al parsear parámetros de configuración (${name}): ${error.message}`);
    }
  }

  if (typeof params !== 'object' || params === null) {
    throw new Error(`Formato de parámetros de configuración (${name}) no soportado`);
  }

  return params;
}

exports.getConfigParamsByName = getConfigParamsByName;

const normalizeRoles = (roles) => {
  if (!Array.isArray(roles)) return [];
  return roles
    .map((value) => Number(value))
    .filter((value) => !Number.isNaN(value));
};

exports.getSidebarMenuConfig = async (req, res) => {
  try {
    const params = await getConfigParamsByName('sidebarMenuPorRol');
    res.json(params || { enable: 0, menu: [] });
  } catch (error) {
    logger.error(`[ConfigController][getSidebarMenuConfig] Error: ${error.message}`);
    res.status(500).json({ message: t('errors.get_config_error', req.lang || 'es') });
  }
};

const isFeatureEnabledForUser = (params, userRoleId) => {
  if (!params) return false;
  const isEnabled = Number(params.enable) === 1;
  if (!isEnabled) {
    return false;
  }

  const allowedRoles = normalizeRoles(params.role_id || params.roles || []);
  if (!allowedRoles.length) {
    return true;
  }

  const numericRoleId = Number(userRoleId);
  if (Number.isNaN(numericRoleId)) {
    return false;
  }

  return allowedRoles.includes(numericRoleId);
};

/**
 * @route GET /api/config/pdf-mail-list
 * @desc Obtener lista de correos para PDFs
 * @access Admin only
 */
exports.getPdfMailList = async (req, res) => {
  try {
    const params = await getConfigParamsByName('settingPdfEmailConsultas');
    res.json(params || { emails: [], enable: 0 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * @route PUT /api/config/pdf-mail-list
 * @desc Actualizar lista de correos para PDFs
 * @access Admin only
 */
exports.updatePdfMailList = async (req, res) => {
  try {
    const { emails = [], enable } = req.body;
    const current = (await getConfigParamsByName('settingPdfEmailConsultas')) || {};
    const payload = {
      emails,
      enable: enable !== undefined ? enable : current.enable ?? 0
    };

    await configService.updateConfig('settingPdfEmailConsultas', payload);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * @route GET /api/config/headerBusquedaClienteChat
 * @desc Obtener configuración del chat de búsqueda de clientes
 * @access Admin only
 */
exports.getHeaderBusquedaClienteChat = async (req, res) => {
  try {
    const params = await getConfigParamsByName('headerBusquedaClienteChat');
    res.json(params || { enable: 0 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getHeaderNotificaciones = async (req, res) => {
  try {
    const params = await getConfigParamsByName('headerNotificaciones');
    res.json(params || { enable: 0, role_id: [] });
  } catch (error) {
    logger.error(`[ConfigController][getHeaderNotificaciones] Error: ${error.message}`);
    res.status(500).json({ message: t('errors.get_notifications_config_error', req.lang || 'es') });
  }
};

exports.getHeaderOrdenesSinDocumentosConfig = async (req, res) => {
  try {
    const params = await getConfigParamsByName('headerOrdenesSinDocumentos');
    res.json(
      params || {
        enable: 0,
        role_id: [],
        fechaAlerta: null,
        minDocuments: null
      }
    );
  } catch (error) {
    logger.error(`[ConfigController][getHeaderOrdenesSinDocumentosConfig] Error: ${error.message}`);
    res.status(500).json({ message: t('errors.get_orders_config_error', req.lang || 'es') });
  }
};

/**
 * @route GET /api/orders/alerts/missing-documents
 * @desc Obtener órdenes sin documentos suficientes
 * @access Admin only
 */
exports.getOrdersMissingDocumentsAlert = async (req, res) => {
  try {
    const params = await getConfigParamsByName('headerOrdenesSinDocumentos');

    if (!params) {
      return res.status(404).json({
        message: t('config.config_not_found', req.lang || 'es')
      });
    }

    const canAccess = isFeatureEnabledForUser(params, req.user?.roleId);
    if (!canAccess) {
      return res.status(403).json({
        message: t('config.access_not_authorized', req.lang || 'es')
      });
    }

    const fechaAlerta = params.fechaAlerta;
    if (!fechaAlerta) {
      return res.status(400).json({
        message: t('config.fecha_alerta_not_configured', req.lang || 'es')
      });
    }

    const minDocuments = Number(params.minDocuments) || 5;

    const orders = await orderService.getOrdersMissingDocumentsAlert({
      fechaAlerta,
      minDocuments
    });

    res.json({
      count: orders.length,
      orders
    });
  } catch (error) {
    logger.error(`[ConfigController][getOrdersMissingDocumentsAlert] Error: ${error.message}`);
    res.status(500).json({ message: t('errors.get_orders_alert_error', req.lang || 'es') });
  }
};

exports.getNotificationEmailList = async (req, res) => {
  try {
    let params = await getConfigParamsByName('settingEmailNotificacion');
    if (!params) {
      params = await getConfigParamsByName('settingEmailNotificación');
    }

    res.json(params || { emails: [], enable: 0 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateNotificationEmailList = async (req, res) => {
  try {
    const { emails = [], enable } = req.body;

    let current = await getConfigParamsByName('settingEmailNotificacion');
    if (!current) {
      current = await getConfigParamsByName('settingEmailNotificación');
    }
    current = current || {};

    const payload = {
      emails,
      enable: enable !== undefined ? enable : current.enable ?? 0
    };

    let result = await configService.updateConfig('settingEmailNotificacion', payload);
    if (result.affectedRows === 0) {
      result = await configService.updateConfig('settingEmailNotificación', payload);
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: t('config.config_not_found_generic', req.lang || 'es') });
      }
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * @route GET /api/config/admin-settings/visibility
 * @desc Obtiene la disponibilidad de las opciones de ajustes en el sidebar
 * @access Admin only
 */
exports.getAdminSettingsVisibility = async (req, res) => {
  try {
    const pdfParams = await getConfigParamsByName('settingPdfEmailConsultas');
    const profileParams = await getConfigParamsByName('settingEdicionPerfil');
    const notificationParams = await getConfigParamsByName('settingEmailNotificacion');

    const isEnabled = (value) => {
      if (value === undefined || value === null) return false;
      const numericValue = Number(value);
      if (!Number.isNaN(numericValue)) {
        return numericValue === 1;
      }
      return String(value).toLowerCase() === 'true';
    };

    res.json({
      pdfMailList: pdfParams ? isEnabled(pdfParams.enable) : false,
      notificationEmailList: notificationParams ? isEnabled(notificationParams.enable) : false,
      profile: profileParams ? isEnabled(profileParams.enable) : false
    });
  } catch (error) {
    logger.error(`[ConfigController][getAdminSettingsVisibility] Error: ${error.message}`);
    res.status(500).json({ message: t('errors.get_visibility_error', req.lang || 'es') });
  }
};

exports.getHeaderUsersSinCuenta = async (req, res) => {
  try {
    const params = await getConfigParamsByName('headerUsersSinCuenta');
    res.json(params || { enable: 0, role_id: [] });
  } catch (error) {
    logger.error(`[ConfigController][getHeaderUsersSinCuenta] Error: ${error.message}`);
    res.status(500).json({ message: t('errors.get_users_config_error', req.lang || 'es') });
  }
};

exports.getRecaptchaLoginConfig = async (req, res) => {
  try {
    const params = await getConfigParamsByName('setRecapchaLogin');
    if (!params) return res.json({ active: 0 });

    const portal = req.query.portal;

    // Global kill-switch
    if (params.enable !== 1) {
      return res.json(portal ? { active: 0 } : { enable: 0 });
    }

    // No portal param: return full config for backward compatibility
    if (!portal) return res.json(params);

    // Portal-specific config
    const portalConfig = params.portal?.[portal];
    if (!portalConfig) return res.json({ active: 0 });

    res.json({ active: portalConfig.active ?? 0, type: portalConfig.type || null });
  } catch (error) {
    logger.error(`[ConfigController][getRecaptchaLoginConfig] Error: ${error.message}`);
    res.status(500).json({ message: 'Error obteniendo configuración de recaptcha' });
  }
};
