const ChatService = require('../services/chat.service');
const ChatMessage = require('../models/chatMessage.model');
const EncryptionService = require('../services/encryption.service');

class ChatController {
  // Enviar mensaje (cliente o admin)
  static async sendMessage(req, res) {
    try {
      const { customer_id, admin_id, message, sender_role, is_security_message } = req.body;

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

      // Encriptar el mensaje antes de guardarlo (excepto mensajes de seguridad)
      const messageToSave = is_security_message ? message.trim() : EncryptionService.encrypt(message.trim());
      
      const messageData = {
        customer_id,
        admin_id,
        message: message.trim(), // Mensaje original para enviar por socket
        sender_role,
        is_security_message: is_security_message || false
      };

      const result = await ChatMessage.sendMessageWithAdmin(
        customer_id, 
        admin_id, 
        messageToSave, // Mensaje encriptado para guardar en BD
        sender_role, 
        is_security_message || false
      );
      
      // Emitir evento Socket.io para notificar en tiempo real
      const io = req.app.get('io');
      if (io) {
        const messageWithDetails = {
          messageId: result,
          customer_id: parseInt(customer_id),
          admin_id: admin_id,
          sender_role: sender_role,
          body: messageData.message,
          created_at: new Date()
        };

        // Emitir solo al admin específico si es un mensaje del cliente
        if (sender_role === 'client') {
          io.to(`admin-${admin_id}`).emit('newMessage', messageWithDetails);
        }
        
        // Emitir a la sala específica del cliente
        io.to(`customer-${customer_id}`).emit('newMessage', messageWithDetails);
        
        // Emitir actualización de notificaciones solo si es un mensaje del cliente
        if (sender_role === 'client') {
          io.to('admin-room').emit('updateNotifications');
        }
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

      const { adminId } = req.query;
      
      let messages;
      if (adminId) {
        messages = await ChatMessage.getMessagesByAdmin(customerId, adminId);
      } else {
        messages = await ChatService.getCustomerMessages(customerId, parseInt(limit));
      }
      
      // Desencriptar mensajes (excepto mensajes de seguridad)
      const decryptedMessages = messages.map(msg => {
        if (!msg.is_security_message && EncryptionService.isEncrypted(msg.body)) {
          try {
            msg.body = EncryptionService.decrypt(msg.body);
          } catch (error) {
            console.error('Error desencriptando mensaje:', error);
            msg.body = '[Mensaje no disponible]';
          }
        }
        return msg;
      });
      
      res.json({
        success: true,
        data: decryptedMessages
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
      
      // Emitir evento Socket.io para actualizar check marks en el admin
      const io = req.app.get('io');
      if (io) {
        // Notificar al admin para actualizar check marks verdes
        io.to('admin-room').emit('updateNotifications');
      }
      
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
      const adminId = req.user.id; // ID del admin desde el token
      const summary = await ChatService.getChatSummary(adminId);
      
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
  // Obtener estado online de administradores
  static async getAdminOnlineStatus(req, res) {
    try {
      const { adminId } = req.query;
      let adminPresence;
      
      if (adminId) {
        adminPresence = await ChatService.getSpecificAdminPresence(adminId);
      } else {
        adminPresence = await ChatService.getAdminPresence();
      }
      
      res.json({
        success: true,
        data: adminPresence
      });
    } catch (error) {
      console.error('Error obteniendo estado online del admin:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  }

  static async markAllAsRead(req, res) {
    try {
      const adminId = req.user.id; // ID del admin desde el token
      const result = await ChatService.markAllAsRead(adminId);
      
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
      const adminId = req.user.id; // ID del admin desde el token

      if (!customerId) {
        return res.status(400).json({ 
          message: 'customerId es requerido' 
        });
      }

      const result = await ChatService.markAsReadByAdmin(customerId, adminId);
      
      // Emitir evento Socket.io para actualizar notificaciones
      const io = req.app.get('io');
      if (io) {
        io.to('admin-room').emit('updateNotifications');
        // También notificar al cliente para actualizar check verdes
        io.to(`customer-${customerId}`).emit('updateNotifications');
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

  // Marcar mensajes del admin como leídos por cliente
  static async markAsReadByClient(req, res) {
    try {
      const { customerId } = req.params;

      if (!customerId) {
        return res.status(400).json({ 
          message: 'customerId es requerido' 
        });
      }

      const result = await ChatService.markAsReadByClient(customerId);
      
      // Emitir evento Socket.io para actualizar check marks en el admin
      const io = req.app.get('io');
      if (io) {
        io.to('admin-room').emit('updateNotifications');
      }
      
      res.json({
        success: true,
        message: 'Mensajes marcados como leídos por cliente',
        data: result
      });

    } catch (error) {
      console.error('Error marcando mensajes como leídos por cliente:', error);
      res.status(500).json({ 
        message: 'Error interno del servidor' 
      });
    }
  }

  // Manejar evento de typing
  static async handleTyping(req, res) {
    try {
      const { customer_id } = req.body;
      const io = req.app.get('io');
      
      if (io && customer_id) {
        // Reenviar evento de typing al admin
        io.to('admin-room').emit('typing', { customer_id: parseInt(customer_id) });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error manejando typing:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  }

  // Manejar evento de stop typing
  static async handleStopTyping(req, res) {
    try {
      const { customer_id } = req.body;
      const io = req.app.get('io');
      
      if (io && customer_id) {
        // Reenviar evento de stop typing al admin
        io.to('admin-room').emit('stop-typing', { customer_id: parseInt(customer_id) });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error manejando stop typing:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  }

  // Obtener lista de administradores
  static async getAdmins(req, res) {
    try {
      const admins = await ChatMessage.getAdmins();
      res.json({ data: admins });
    } catch (error) {
      console.error('Error obteniendo administradores:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  }
}

module.exports = ChatController; 



