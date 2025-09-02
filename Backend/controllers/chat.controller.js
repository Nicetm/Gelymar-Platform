const ChatService = require('../services/chat.service');

class ChatController {
  // Enviar mensaje (cliente o admin)
  static async sendMessage(req, res) {
    try {
      const { customer_id, message, sender_role, is_security_message } = req.body;

      if (!customer_id || !message || !sender_role) {
        return res.status(400).json({ 
          message: 'Faltan campos requeridos: customer_id, message, sender_role' 
        });
      }

      if (!['client', 'admin'].includes(sender_role)) {
        return res.status(400).json({ 
          message: 'sender_role debe ser "client" o "admin"' 
        });
      }

      const messageData = {
        customer_id,
        message: message.trim(),
        sender_role,
        is_security_message: is_security_message || false
      };

      const result = await ChatService.sendMessage(messageData);
      
      // Emitir evento Socket.io para notificar en tiempo real
      const io = req.app.get('io');
      if (io) {
        const messageWithDetails = {
          ...result,
          customer_id: parseInt(customer_id),
          sender_role: sender_role
        };

        // Emitir a la sala del admin
        io.to('admin-room').emit('newMessage', messageWithDetails);
        
        // Emitir a la sala específica del cliente
        io.to(`customer-${customer_id}`).emit('newMessage', messageWithDetails);
        
        // Emitir actualización de notificaciones
        io.to('admin-room').emit('updateNotifications');
      }
      
      res.status(201).json({
        success: true,
        message: 'Mensaje enviado correctamente',
        data: result
      });

    } catch (error) {
      console.error('Error enviando mensaje:', error);
      res.status(500).json({ 
        message: 'Error interno del servidor',
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  // Obtener mensajes de un cliente
  static async getCustomerMessages(req, res) {
    try {
      const { customerId } = req.params;
      const { limit = 50 } = req.query;

      if (!customerId) {
        return res.status(400).json({ 
          message: 'customerId es requerido' 
        });
      }

      const messages = await ChatService.getCustomerMessages(customerId, parseInt(limit));
      
      res.json({
        success: true,
        data: messages
      });

    } catch (error) {
      console.error('Error obteniendo mensajes:', error);
      res.status(500).json({ 
        message: 'Error interno del servidor',
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  // Obtener conteo de mensajes no leídos
  static async getUnreadCount(req, res) {
    try {
      const { customerId } = req.params;

      if (!customerId) {
        return res.status(400).json({ 
          message: 'customerId es requerido' 
        });
      }

      const count = await ChatService.getUnreadCount(customerId);
      
      res.json({
        success: true,
        data: { unreadCount: count }
      });

    } catch (error) {
      console.error('Error obteniendo conteo de no leídos:', error);
      res.status(500).json({ 
        message: 'Error interno del servidor' 
      });
    }
  }

  // Marcar mensajes como leídos
  static async markAsRead(req, res) {
    try {
      const { customerId } = req.params;

      if (!customerId) {
        return res.status(400).json({ 
          message: 'customerId es requerido' 
        });
      }

      const result = await ChatService.markMessagesAsRead(customerId);
      
      res.json({
        success: true,
        message: 'Mensajes marcados como leídos',
        data: result
      });

    } catch (error) {
      console.error('Error marcando mensajes como leídos:', error);
      res.status(500).json({ 
        message: 'Error interno del servidor' 
      });
    }
  }

  // Obtener chats recientes (solo admin)
  static async getRecentChats(req, res) {
    try {
      const chats = await ChatService.getRecentChats();
      
      res.json({
        success: true,
        data: chats
      });

    } catch (error) {
      console.error('Error obteniendo chats recientes:', error);
      res.status(500).json({ 
        message: 'Error interno del servidor' 
      });
    }
  }

  // Obtener resumen del chat (solo admin)
  static async getChatSummary(req, res) {
    try {
      const summary = await ChatService.getChatSummary();
      
      res.json({
        success: true,
        data: summary
      });

    } catch (error) {
      console.error('Error obteniendo resumen del chat:', error);
      res.status(500).json({ 
        message: 'Error interno del servidor' 
      });
    }
  }

  // Marcar todos los mensajes como leídos (solo admin)
  static async markAllAsRead(req, res) {
    try {
      const result = await ChatService.markAllAsRead();
      
      res.json({
        success: true,
        message: 'Todos los mensajes marcados como leídos',
        data: result
      });

    } catch (error) {
      console.error('Error marcando todos los mensajes como leídos:', error);
      res.status(500).json({ 
        message: 'Error interno del servidor' 
      });
    }
  }

  // Marcar mensajes de un cliente como leídos por admin
  static async markAsReadByAdmin(req, res) {
    try {
      const { customerId } = req.params;

      if (!customerId) {
        return res.status(400).json({ 
          message: 'customerId es requerido' 
        });
      }

      const result = await ChatService.markAsReadByAdmin(customerId);
      
      // Emitir evento Socket.io para actualizar notificaciones
      const io = req.app.get('io');
      if (io) {
        io.to('admin-room').emit('updateNotifications');
      }
      
      res.json({
        success: true,
        message: 'Mensajes marcados como leídos por admin',
        data: result
      });

    } catch (error) {
      console.error('Error marcando mensajes como leídos por admin:', error);
      res.status(500).json({ 
        message: 'Error interno del servidor' 
      });
    }
  }
}

module.exports = ChatController; 