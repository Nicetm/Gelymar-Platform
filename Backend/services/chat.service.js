const ChatMessage = require('../models/chatMessage.model');
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

  static async getChatSummary() {
    try {
      const recentChats = await ChatMessage.getRecentChats();
      const totalUnread = await ChatMessage.getAdminUnreadCount();
      
      console.log('Chat Summary:', { totalUnread, totalChats: recentChats.length });
      
      return {
        recentChats,
        totalUnread,
        totalChats: recentChats.length
      };
    } catch (error) {
      throw error;
    }
  }

  static async markAllAsRead() {
    try {
      const affectedRows = await ChatMessage.markAllAsRead();
      return { success: true, affectedRows };
    } catch (error) {
      throw error;
    }
  }

  static async markAsReadByAdmin(customerId) {
    try {
      const affectedRows = await ChatMessage.markAsReadByAdmin(customerId);
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
}

module.exports = ChatService; 