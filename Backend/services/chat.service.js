const ChatMessage = require('../models/chatMessage.model');
const EncryptionService = require('./encryption.service');
const UserService = require('./user.service');

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

  static async getRecentChats() {
    try {
      const chats = await ChatMessage.getRecentChats();
      return chats;
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
}

module.exports = ChatService; 
