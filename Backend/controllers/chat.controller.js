const { container } = require('../config/container');
const ChatService = container.resolve('chatService');
const ChatMessage = require('../models/chatMessage.model');
const EncryptionService = container.resolve('encryptionService');
const { logger } = require('../utils/logger');
const { t } = require('../i18n');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { validateFilePath, setSecureFilePermissions } = require('../utils/filePermissions');

const chatImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const allowed = ['.jpg', '.jpeg', '.png'];
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido'), false);
    }
  }
});

class ChatController {
  static async uploadChatImage(req, res) {
    chatImageUpload.single('image')(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ message: err.message || t('chat.upload_image_error', req.lang || 'es') });
      }

      try {
        const { customer_id } = req.body;
        const file = req.file;

        if (!customer_id || !file) {
          return res.status(400).json({ message: t('chat.missing_data', req.lang || 'es') });
        }

        const basePath = process.env.FILE_SERVER_ROOT || '/var/www/html';
        const fileServerUrl = process.env.FILE_SERVER_URL || '';
        const customerFolder = path.join(basePath, 'uploads', 'chat', String(customer_id));
        fs.mkdirSync(customerFolder, { recursive: true });

        const ext = path.extname(file.originalname || '').toLowerCase();
        const fileName = `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
        const relativePath = path.join('uploads', 'chat', String(customer_id), fileName);

        if (!validateFilePath(relativePath, basePath)) {
          return res.status(400).json({ message: t('chat.invalid_file_path', req.lang || 'es') });
        }

        const absolutePath = path.join(basePath, relativePath);
        fs.writeFileSync(absolutePath, file.buffer);
        await setSecureFilePermissions(absolutePath);

        const normalizedPath = relativePath.replace(/\\/g, '/');
        const urlBase = fileServerUrl ? fileServerUrl.replace(/\/$/, '') : '';
        const publicUrl = urlBase ? `${urlBase}/${normalizedPath}` : `/${normalizedPath}`;

        return res.status(201).json({ url: publicUrl, path: normalizedPath });
      } catch (uploadError) {
        return res.status(500).json({ message: t('chat.internal_error_upload', req.lang || 'es') });
      }
    });
  }

  // Enviar mensaje (cliente o admin)
  static async sendMessage(req, res) {
    try {
      const { customer_id, admin_id, message, sender_role, is_security_message } = req.body;

      if (!customer_id || !message || !sender_role) {
        return res.status(400).json({ 
          message: t('chat.missing_required_fields', req.lang || 'es')
        });
      }

      if (!['client', 'admin'].includes(sender_role)) {
        return res.status(400).json({ 
          message: t('chat.invalid_sender_role', req.lang || 'es')
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

      if (sender_role === 'client' && admin_id) {
        try {
          await ChatService.notifyAdminOfClientMessage({
            customerId: String(customer_id),
            adminId: Number(admin_id),
            message: message.trim()
          });
        } catch (emailError) {
          logger.error(`[ChatController] Error enviando correo de chat: ${emailError.message}`);
        }
      }
      
      // Emitir evento Socket.io para notificar en tiempo real
      const io = req.app.get('io');
      if (io) {
        const messageWithDetails = {
          messageId: result,
          customer_id: String(customer_id),
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
        message: t('chat.message_sent', req.lang || 'es'),
        data: result
      });

    } catch (error) {
      logger.error(`[ChatController] Error enviando mensaje: ${error.message}`);
      res.status(500).json({ 
        message: t('chat.send_message_error', req.lang || 'es'),
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
          message: t('chat.customer_id_required', req.lang || 'es')
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
            logger.error(`[ChatController] Error desencriptando mensaje: ${error.message}`);
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
      logger.error(`[ChatController] Error obteniendo mensajes: ${error.message}`);
      res.status(500).json({ 
        message: t('chat.get_messages_error', req.lang || 'es'),
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
          message: t('chat.customer_id_required', req.lang || 'es')
        });
      }

      const count = await ChatService.getUnreadCount(customerId);
      
      res.json({
        success: true,
        data: { unreadCount: count }
      });

    } catch (error) {
      logger.error(`[ChatController] Error obteniendo conteo de no leídos: ${error.message}`);
      res.status(500).json({ 
        message: t('chat.get_unread_count_error', req.lang || 'es')
      });
    }
  }

  // Marcar mensajes como leídos
  static async markAsRead(req, res) {
    try {
      const { customerId } = req.params;

      if (!customerId) {
        return res.status(400).json({ 
          message: t('chat.customer_id_required', req.lang || 'es')
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
        message: t('chat.messages_marked_read', req.lang || 'es'),
        data: result
      });

    } catch (error) {
      logger.error(`[ChatController] Error marcando mensajes como leídos: ${error.message}`);
      res.status(500).json({ 
        message: t('chat.mark_read_error', req.lang || 'es')
      });
    }
  }

  // Obtener chats recientes (solo admin)
  static async getRecentChats(req, res) {
    try {
      const adminId = req.user?.id;
      if (!adminId) {
        return res.status(400).json({ message: t('chat.admin_id_required', req.lang || 'es') });
      }
      const chats = await ChatService.getRecentChats(adminId);
      
      res.json({
        success: true,
        data: chats
      });

    } catch (error) {
      logger.error(`[ChatController] Error obteniendo chats recientes: ${error.message}`);
      res.status(500).json({ 
        message: t('chat.get_recent_chats_error', req.lang || 'es')
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
      logger.error(`[ChatController] Error obteniendo resumen del chat: ${error.message}`);
      res.status(500).json({ 
        message: t('chat.get_chat_summary_error', req.lang || 'es')
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
      logger.error(`[ChatController] Error obteniendo estado online del admin: ${error.message}`);
      res.status(500).json({ message: t('chat.get_admin_status_error', req.lang || 'es') });
    }
  }

  static async markAllAsRead(req, res) {
    try {
      const adminId = req.user.id; // ID del admin desde el token
      const result = await ChatService.markAllAsRead(adminId);
      
      res.json({
        success: true,
        message: t('chat.all_messages_marked_read', req.lang || 'es'),
        data: result
      });

    } catch (error) {
      logger.error(`[ChatController] Error marcando todos los mensajes como leídos: ${error.message}`);
      res.status(500).json({ 
        message: t('chat.mark_all_read_error', req.lang || 'es')
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
          message: t('chat.customer_id_required', req.lang || 'es')
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
        message: t('chat.messages_marked_read_by_admin', req.lang || 'es'),
        data: result
      });

    } catch (error) {
      logger.error(`[ChatController] Error marcando mensajes como leídos por admin: ${error.message}`);
      res.status(500).json({ 
        message: t('chat.mark_read_by_admin_error', req.lang || 'es')
      });
    }
  }

  // Marcar mensajes del admin como leídos por cliente
  static async markAsReadByClient(req, res) {
    try {
      const { customerId } = req.params;

      if (!customerId) {
        return res.status(400).json({ 
          message: t('chat.customer_id_required', req.lang || 'es')
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
        message: t('chat.messages_marked_read_by_client', req.lang || 'es'),
        data: result
      });

    } catch (error) {
      logger.error(`[ChatController] Error marcando mensajes como leídos por cliente: ${error.message}`);
      res.status(500).json({ 
        message: t('chat.mark_read_by_client_error', req.lang || 'es')
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
        io.to('admin-room').emit('typing', { customer_id: String(customer_id) });
      }
      
      res.json({ success: true });
    } catch (error) {
      logger.error(`[ChatController] Error manejando typing: ${error.message}`);
      res.status(500).json({ message: t('chat.handle_typing_error', req.lang || 'es') });
    }
  }

  // Manejar evento de stop typing
  static async handleStopTyping(req, res) {
    try {
      const { customer_id } = req.body;
      const io = req.app.get('io');
      
      if (io && customer_id) {
        // Reenviar evento de stop typing al admin
        io.to('admin-room').emit('stop-typing', { customer_id: String(customer_id) });
      }
      
      res.json({ success: true });
    } catch (error) {
      logger.error(`[ChatController] Error manejando stop typing: ${error.message}`);
      res.status(500).json({ message: t('chat.handle_stop_typing_error', req.lang || 'es') });
    }
  }

  // Obtener lista de administradores
  static async getAdmins(req, res) {
    try {
      const admins = await ChatMessage.getAdmins();
      res.json({ data: admins });
    } catch (error) {
      logger.error(`[ChatController] Error obteniendo administradores: ${error.message}`);
      res.status(500).json({ message: t('chat.get_admins_error', req.lang || 'es') });
    }
  }
}

module.exports = ChatController; 



