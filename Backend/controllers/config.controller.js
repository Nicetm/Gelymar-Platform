const configService = require('../services/config.service');
const orderService = require('../services/order.service');

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
    console.error('[getHeaderNotificaciones] Error:', error.message);
    res.status(500).json({ message: 'Error al obtener configuracion de notificaciones' });
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
    console.error('[getHeaderOrdenesSinDocumentosConfig] Error:', error.message);
    res.status(500).json({ message: 'Error al obtener configuracion de ordenes sin documentos' });
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
        message: 'Configuración headerOrdenesSinDocumentos no encontrada'
      });
    }

    const canAccess = isFeatureEnabledForUser(params, req.user?.roleId);
    if (!canAccess) {
      return res.status(403).json({
        message: 'Acceso a ordenes sin documentos no autorizado'
      });
    }

    const fechaAlerta = params.fechaAlerta;
    if (!fechaAlerta) {
      return res.status(400).json({
        message: 'El parámetro fechaAlerta no está configurado'
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
    console.error('[getOrdersMissingDocumentsAlert] Error:', error.message);
    res.status(500).json({ message: 'Error al obtener alertas de órdenes sin documentos' });
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
        return res.status(404).json({ message: 'Configuración settingEmailNotificacion no encontrada' });
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
    let notificationParams = await getConfigParamsByName('settingEmailNotificacion');
    if (!notificationParams) {
      notificationParams = await getConfigParamsByName('settingEmailNotificación');
    }

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
    console.error('[getAdminSettingsVisibility] Error:', error.message);
    res.status(500).json({ message: 'Error al obtener la visibilidad de ajustes' });
  }
};

exports.getHeaderUsersSinCuenta = async (req, res) => {
  try {
    const params = await getConfigParamsByName('headerUsersSinCuenta');
    res.json(params || { enable: 0, role_id: [] });
  } catch (error) {
    console.error('[getHeaderUsersSinCuenta] Error:', error.message);
    res.status(500).json({ message: 'Error al obtener configuración de usuarios sin cuenta' });
  }
};
