const configService = require('./config.service');
const orderService = require('./order.service');
const customerService = require('./customer.service');
const userService = require('./user.service');
const { sendAdminNotificationSummary } = require('./email.service');

const parseConfigParams = (config) => {
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
    params = JSON.parse(trimmed);
  }

  if (typeof params !== 'object' || params === null) {
    return null;
  }

  return params;
};

const isEnabled = (value) => {
  if (value === undefined || value === null) return false;
  const numericValue = Number(value);
  if (!Number.isNaN(numericValue)) {
    return numericValue === 1;
  }
  return String(value).toLowerCase() === 'true';
};

const resolveAdminPortalUrl = () => {
  const adminUrl = process.env.PUBLIC_ADMIN_APP_URL;
  if (adminUrl) return adminUrl.replace(/\/?$/, '/');

  const frontendBase = process.env.FRONTEND_BASE_URL || process.env.PUBLIC_FRONTEND_BASE_URL || '';
  if (!frontendBase) return '';
  return `${frontendBase.replace(/\/$/, '')}/admin/`;
};

const buildSummary = ({ ordersCount, customersCount }) => {
  if (!ordersCount && !customersCount) {
    return 'No hay tareas pendientes para hoy.';
  }

  const lines = [];
  if (ordersCount) {
    lines.push(`- Ordenes con documentacion pendiente: ${ordersCount}`);
  }
  if (customersCount) {
    lines.push(`- Clientes sin cuenta registrada: ${customersCount}`);
  }
  return lines.join('\n');
};

async function sendDailyAdminNotificationSummary() {
  const [ordersConfig, usersConfig] = await Promise.all([
    configService.getConfigByName('headerOrdenesSinDocumentos'),
    configService.getConfigByName('headerUsersSinCuenta')
  ]);

  const ordersParams = parseConfigParams(ordersConfig) || {};
  const usersParams = parseConfigParams(usersConfig) || {};

  let ordersCount = 0;
  let customersCount = 0;

  if (isEnabled(ordersParams.enable)) {
    const fechaAlerta = ordersParams.fechaAlerta;
    if (fechaAlerta) {
      const minDocuments = Number(ordersParams.minDocuments) || 5;
      const orders = await orderService.getOrdersMissingDocumentsAlert({
        fechaAlerta,
        minDocuments
      });
      ordersCount = orders.length;
    }
  }

  if (isEnabled(usersParams.enable)) {
    const customers = await customerService.getCustomersWithoutAccount();
    customersCount = customers.length;
  }

  const adminUsers = await userService.getAdminNotificationRecipients();
  if (!adminUsers.length) {
    return { processed: 0, skipped: true };
  }

  const portalBase = resolveAdminPortalUrl();
  const summaryText = buildSummary({ ordersCount, customersCount });

  let processed = 0;

  for (const admin of adminUsers) {
    await sendAdminNotificationSummary({
      adminEmail: admin.email,
      adminName: admin.full_name,
      summaryText,
      portalUrl: portalBase || '',
      links: {
        orders: portalBase ? `${portalBase}orders` : '',
        clients: portalBase ? `${portalBase}clients` : ''
      }
    });
    processed += 1;
  }

  return { processed };
}

module.exports = {
  sendDailyAdminNotificationSummary
};
