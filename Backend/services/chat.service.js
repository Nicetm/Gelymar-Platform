const ChatMessage = require('../models/chatMessage.model');
const EncryptionService = require('./encryption.service');
const UserService = require('./user.service');
const CustomerService = require('./customer.service');
const { sendChatNotification } = require('./email.service');

function parseChatPayload(message) {
  if (typeof message !== 'string') {
    return { type: 'text', text: '' };
  }
  try {
    const parsed = JSON.parse(message);
    if (parsed && parsed.type === 'image' && parsed.url) {
      return {
        type: 'image',
        url: parsed.url,
        text: parsed.text || ''
      };
    }
  } catch (error) {
    // Ignorar JSON invalido
  }
  return { type: 'text', text: message };
}

class ChatService {
  static async sendMessage(messageData) {
    try {
      const messageId = await ChatMessage.create(messageData);
      return { success: true, messageId };
    } catch (error) {
      throw error;
    }
  }

  static async getCustomerMessages(customerId, limit = 50) {
    try {
      const messages = await ChatMessage.getMessagesByCustomer(customerId, limit);
      return messages;
    } catch (error) {
      throw error;
    }
  }

  static async getUnreadCount(customerId) {
    try {
      const count = await ChatMessage.getUnreadCount(customerId);
      return count;
    } catch (error) {
      throw error;
    }
  }

  static async markMessagesAsRead(customerId) {
    try {
      const affectedRows = await ChatMessage.markAsRead(customerId);
      return { success: true, affectedRows };
    } catch (error) {
      throw error;
    }
  }

  static async getRecentChats(adminId) {
    try {
      const chats = await ChatMessage.getRecentChats(adminId);
      const decryptedChats = chats.map(chat => {
        if (chat.last_message && !chat.is_security_message && EncryptionService.isEncrypted(chat.last_message)) {
          try {
            chat.last_message = EncryptionService.decrypt(chat.last_message);
          } catch (error) {
            console.error('Error desencriptando mensaje reciente:', error);
            chat.last_message = '[Mensaje no disponible]';
          }
        }
        const parsed = parseChatPayload(chat.last_message);
        if (parsed.type === 'image') {
          chat.last_message = parsed.text ? `${parsed.text} [Imagen adjunta]` : '[Imagen adjunta]';
        }
        return chat;
      });
      return decryptedChats;
    } catch (error) {
      throw error;
    }
  }

  static async getChatSummary(adminId) {
    try {
      const recentChats = await ChatMessage.getRecentChats(adminId);
      const totalUnread = await ChatMessage.getAdminUnreadCount(adminId);
      
      // Desencriptar mensajes recientes (excepto mensajes de seguridad)
      const decryptedChats = recentChats.map(chat => {
        if (chat.last_message && !chat.is_security_message && EncryptionService.isEncrypted(chat.last_message)) {
          try {
            chat.last_message = EncryptionService.decrypt(chat.last_message);
          } catch (error) {
            console.error('Error desencriptando mensaje reciente:', error);
            chat.last_message = '[Mensaje no disponible]';
          }
        }
        const parsed = parseChatPayload(chat.last_message);
        if (parsed.type === 'image') {
          chat.last_message = parsed.text ? `${parsed.text} [Imagen adjunta]` : '[Imagen adjunta]';
        }
        return chat;
      });
      
      return {
        recentChats: decryptedChats,
        totalUnread,
        totalChats: decryptedChats.length
      };
    } catch (error) {
      throw error;
    }
  }

  static async getAdminPresence() {
    try {
      return await UserService.getPrimaryAdminPresence();
    } catch (error) {
      throw error;
    }
  }

  static async getSpecificAdminPresence(adminId) {
    try {
      return await UserService.getSpecificAdminPresence(adminId);
    } catch (error) {
      throw error;
    }
  }

  static async markAllAsRead(adminId) {
    try {
      const affectedRows = await ChatMessage.markAllAsRead(adminId);
      return { success: true, affectedRows };
    } catch (error) {
      throw error;
    }
  }

  static async markAsReadByAdmin(customerId, adminId) {
    try {
      const affectedRows = await ChatMessage.markAsReadByAdmin(customerId, adminId);
      return { success: true, affectedRows };
    } catch (error) {
      throw error;
    }
  }

  static async markAsReadByClient(customerId) {
    try {
      const affectedRows = await ChatMessage.markAsRead(customerId);
      return { success: true, affectedRows };
    } catch (error) {
      throw error;
    }
  }

  static async authenticateUser(userId) {
    try {
      const user = await UserService.findUserForAuth(userId);
      return user;
    } catch (error) {
      throw error;
    }
  }

  static async getAdmins() {
    try {
      const admins = await ChatMessage.getAdmins();
      return admins;
    } catch (error) {
      throw error;
    }
  }

  static async notifyAdminOfClientMessage({ customerId, adminId, message }) {
    if (!adminId || !customerId || !message) {
      return;
    }

    const admin = await UserService.getAdminUserById(adminId);
    if (!admin || !admin.email) {
      return;
    }

    const isOnline = admin.online === 1 || admin.online === true;
    if (isOnline) {
      return;
    }

    const customer = await CustomerService.getCustomerByRutFromSql(String(customerId));
    const portalBase = process.env.FRONTEND_BASE_URL || 'http://localhost:2121';
    const portalUrl = `${portalBase}/admin`;

    const parsed = parseChatPayload(message);
    const previewMessage = parsed.type === 'image'
      ? (parsed.text ? `${parsed.text}\n[Imagen adjunta]` : '[Imagen adjunta]')
      : message;

    await sendChatNotification({
      adminEmail: admin.email,
      adminName: admin.full_name || admin.email,
      customerName: customer?.name || customer?.rut || String(customerId),
      message: previewMessage,
      portalUrl
    });
  }
}

module.exports = ChatService; 
