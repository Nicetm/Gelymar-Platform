const EncryptionService = require('../services/encryption.service');

const MESSAGE_TYPES = {
  MESSAGES: 'messages',
  ORDERS_MISSING_DOCUMENTS: 'orders_missing_documents',
  CUSTOMERS_WITHOUT_ACCOUNT: 'customers_without_account',
};

class MessageModel {
  static normalizeChatSummary(chat) {
    if (!chat) {
      return null;
    }

    const unreadCount = Number(chat.unread_count || 0);

    return {
      id: String(chat.customer_id),
      type: MESSAGE_TYPES.MESSAGES,
      title: chat.company_name || `Cliente #${chat.customer_id}`,
      description: chat.last_message || '',
      related: {
        customerId: chat.customer_id,
        customerName: chat.company_name || '',
        customerUuid: chat.customer_rut || chat.customer_uuid || null,
        online: typeof chat.online !== 'undefined' ? Boolean(chat.online) : undefined,
      },
      timestamp: chat.last_message_time || null,
      unreadCount,
      status: unreadCount > 0 ? 'pending' : 'done',
      raw: chat,
    };
  }

  static normalizeOrderAlert(order, { minDocuments }) {
    if (!order) {
      return null;
    }

    const minDocs = Number(minDocuments || 5);

    return {
      id: String(order.id),
      type: MESSAGE_TYPES.ORDERS_MISSING_DOCUMENTS,
      title: `PC ${order.pc || '-'} / OC ${order.oc || '-'}`,
      description: `Documentos cargados: ${order.document_count ?? 0}`,
      related: {
        orderId: order.id,
        pc: order.pc,
        oc: order.oc,
        customerName: order.customer_name,
        customerUuid: order.customer_rut || order.customer_uuid,
      },
      timestamp: order.fecha_etd || order.fecha || null,
      status: Number(order.document_count || 0) >= minDocs ? 'done' : 'pending',
      documentCount: Number(order.document_count || 0),
      minDocuments: minDocs,
      raw: order,
    };
  }

  static normalizeCustomerWithoutAccount(customer) {
    if (!customer) {
      return null;
    }

    return {
      id: String(customer.id),
      type: MESSAGE_TYPES.CUSTOMERS_WITHOUT_ACCOUNT,
      title: customer.name || `Cliente #${customer.id}`,
      description: customer.email || customer.rut || '',
      related: {
        customerId: customer.id,
        customerUuid: customer.rut || customer.uuid,
        rut: customer.rut,
      },
      timestamp: customer.created_at || null,
      status: 'pending',
      raw: customer,
    };
  }

  static normalizeChatMessage(message) {
    if (!message) {
      return null;
    }

    let body = message.message || '';
    try {
      if (
        body &&
        !message.is_security_message &&
        EncryptionService.isEncrypted &&
        EncryptionService.isEncrypted(body)
      ) {
        body = EncryptionService.decrypt(body);
      }
    } catch (error) {
      const { logger } = require('../utils/logger');
      logger.error(`[MessageModel] Error desencriptando mensaje: ${error.message || error}`);
    }

    return {
      id: message.id,
      message: body,
      sender: message.sender_type,
      createdAt: message.created_at,
      readByAdmin: Boolean(message.is_read_by_admin),
      readByClient: Boolean(message.is_read_by_client),
      isSecurityMessage: Boolean(message.is_security_message),
    };
  }
}

module.exports = {
  MESSAGE_TYPES,
  MessageModel,
};
