const ChatService = require('./chat.service');
const OrderService = require('./order.service');
const CustomerService = require('./customer.service');
const configService = require('./config.service');
const { MESSAGE_TYPES, MessageModel } = require('../models/message.model');

const DEFAULT_LIMIT = 20;

async function getConfigParamsByName(name) {
  const config = await configService.getConfigByName(name);
  if (!config) {
    return null;
  }

  let params = config.params;
  if (Buffer.isBuffer(params)) {
    params = params.toString('utf-8');
  }

  if (typeof params === 'string') {
    try {
      params = JSON.parse(params);
    } catch {
      params = null;
    }
  }

  return params;
}

async function resolveMissingDocumentsConfig() {
  const params =
    (await getConfigParamsByName('headerOrdenesSinDocumentos')) ||
    (await getConfigParamsByName('alertaOrdenesSinDocumentos')) ||
    {};

  const fechaAlerta = params?.fechaAlerta || '1970-01-01';
  const minDocuments = Number(params?.minDocuments) || 5;

  return { fechaAlerta, minDocuments };
}

function applySearchFilter(items, predicate) {
  if (!items.length) {
    return items;
  }
  return predicate ? items.filter(predicate) : items;
}

function applyPagination(items, page, limit) {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const currentPage = Math.min(Math.max(page, 1), totalPages);
  const start = (currentPage - 1) * limit;
  const end = start + limit;
  const sliced = items.slice(start, end);

  return {
    paginated: sliced,
    pagination: {
      page: currentPage,
      limit,
      total,
      totalPages,
    },
  };
}

class MessageService {
  async getSummary({ adminId }) {
    const [chatSummary, missingDocsConfig, customersWithoutAccount] = await Promise.all([
      ChatService.getChatSummary(adminId),
      resolveMissingDocumentsConfig(),
      CustomerService.getCustomersWithoutAccount(),
    ]);

    const orders = await OrderService.getOrdersMissingDocumentsAlert(missingDocsConfig);

    return {
      [MESSAGE_TYPES.MESSAGES]: {
        total: chatSummary?.totalChats || 0,
        unread: chatSummary?.totalUnread || 0,
      },
      [MESSAGE_TYPES.ORDERS_MISSING_DOCUMENTS]: {
        total: orders.length,
      },
      [MESSAGE_TYPES.CUSTOMERS_WITHOUT_ACCOUNT]: {
        total: customersWithoutAccount.length,
      },
    };
  }

  async getMessages({ type, page = 1, limit = DEFAULT_LIMIT, status = 'all', search = '', adminId }) {
    const normalizedType = type || MESSAGE_TYPES.MESSAGES;
    const normalizedSearch = search.trim().toLowerCase();
    const normalizedLimit = Math.min(Math.max(Number(limit) || DEFAULT_LIMIT, 1), 100);
    const normalizedPage = Math.max(Number(page) || 1, 1);

    switch (normalizedType) {
      case MESSAGE_TYPES.MESSAGES:
        return this.getChatMessages({
          adminId,
          page: normalizedPage,
          limit: normalizedLimit,
          status,
          search: normalizedSearch,
        });
      case MESSAGE_TYPES.ORDERS_MISSING_DOCUMENTS:
        return this.getOrdersMissingDocuments({
          page: normalizedPage,
          limit: normalizedLimit,
          search: normalizedSearch,
        });
      case MESSAGE_TYPES.CUSTOMERS_WITHOUT_ACCOUNT:
        return this.getCustomersWithoutAccount({
          page: normalizedPage,
          limit: normalizedLimit,
          search: normalizedSearch,
        });
      default:
        throw new Error(`Tipo de mensaje no soportado: ${normalizedType}`);
    }
  }

  async getChatMessages({ adminId, page, limit, status, search }) {
    const summary = await ChatService.getChatSummary(adminId);
    const chats = Array.isArray(summary?.recentChats) ? summary.recentChats : [];

    const filteredByStatus =
      status === 'unread'
        ? chats.filter((chat) => Number(chat.unread_count || 0) > 0)
        : chats;

    const filtered = applySearchFilter(filteredByStatus, (chat) => {
      if (!search) return true;
      const company = (chat.company_name || '').toLowerCase();
      const customerId = String(chat.customer_id || '').toLowerCase();
      return company.includes(search) || customerId.includes(search);
    });

    const { paginated, pagination } = applyPagination(filtered, page, limit);
    const items = paginated
      .map((chat) => MessageModel.normalizeChatSummary(chat))
      .filter(Boolean);

    return { items, pagination };
  }

  async getOrdersMissingDocuments({ page, limit, search }) {
    const missingDocsConfig = await resolveMissingDocumentsConfig();
    const orders = await OrderService.getOrdersMissingDocumentsAlert(missingDocsConfig);

    const filtered = applySearchFilter(orders, (order) => {
      if (!search) return true;
      const pc = (order.pc || '').toLowerCase();
      const oc = (order.oc || '').toLowerCase();
      const customerName = (order.customer_name || '').toLowerCase();
      return pc.includes(search) || oc.includes(search) || customerName.includes(search);
    });

    const { paginated, pagination } = applyPagination(filtered, page, limit);
    const items = paginated
      .map((order) => MessageModel.normalizeOrderAlert(order, missingDocsConfig))
      .filter(Boolean);

    return { items, pagination };
  }

  async getCustomersWithoutAccount({ page, limit, search }) {
    const customers = await CustomerService.getCustomersWithoutAccount();

    const filtered = applySearchFilter(customers, (customer) => {
      if (!search) return true;
      const name = (customer.name || '').toLowerCase();
      const rut = (customer.rut || '').toLowerCase();
      return name.includes(search) || rut.includes(search);
    });

    const { paginated, pagination } = applyPagination(filtered, page, limit);
    const items = paginated
      .map((customer) => MessageModel.normalizeCustomerWithoutAccount(customer))
      .filter(Boolean);

    return { items, pagination };
  }

  async getMessageDetail({ type, id, adminId }) {
    switch (type) {
      case MESSAGE_TYPES.MESSAGES:
        return this.getChatDetail({ customerId: Number(id), adminId });
      case MESSAGE_TYPES.ORDERS_MISSING_DOCUMENTS:
        return this.getOrderDetail({ orderId: Number(id) });
      case MESSAGE_TYPES.CUSTOMERS_WITHOUT_ACCOUNT:
        return this.getCustomerDetail({ customerId: Number(id) });
      default:
        throw new Error(`Tipo de mensaje no soportado: ${type}`);
    }
  }

  async getChatDetail({ customerId, adminId }) {
    if (!customerId) {
      throw new Error('ID de cliente inválido');
    }

    const [conversation, customer, summary] = await Promise.all([
      ChatService.getCustomerMessages(customerId, 200),
      CustomerService.getCustomerById(customerId),
      ChatService.getChatSummary(adminId),
    ]);

    const summaryItem = summary?.recentChats?.find(
      (chat) => Number(chat.customer_id) === Number(customerId)
    );

    return {
      type: MESSAGE_TYPES.MESSAGES,
      item: summaryItem ? MessageModel.normalizeChatSummary(summaryItem) : null,
      conversation: Array.isArray(conversation)
        ? conversation.map((msg) => MessageModel.normalizeChatMessage(msg)).filter(Boolean)
        : [],
      customer,
    };
  }

  async getOrderDetail({ orderId }) {
    if (!orderId) {
      throw new Error('ID de orden inválido');
    }

    const order = await OrderService.getOrderByIdSimple(orderId);
    if (!order) {
      return {
        type: MESSAGE_TYPES.ORDERS_MISSING_DOCUMENTS,
        item: null,
        order: null,
      };
    }

    const missingDocsConfig = await resolveMissingDocumentsConfig();
    const summaryItem = MessageModel.normalizeOrderAlert(order, missingDocsConfig);

    return {
      type: MESSAGE_TYPES.ORDERS_MISSING_DOCUMENTS,
      item: summaryItem,
      order,
    };
  }

  async getCustomerDetail({ customerId }) {
    if (!customerId) {
      throw new Error('ID de cliente inválido');
    }

    const customer = await CustomerService.getCustomerById(customerId);
    if (!customer) {
      return {
        type: MESSAGE_TYPES.CUSTOMERS_WITHOUT_ACCOUNT,
        item: null,
        customer: null,
      };
    }

    const summaryItem = MessageModel.normalizeCustomerWithoutAccount(customer);

    return {
      type: MESSAGE_TYPES.CUSTOMERS_WITHOUT_ACCOUNT,
      item: summaryItem,
      customer,
    };
  }
}

module.exports = new MessageService();
