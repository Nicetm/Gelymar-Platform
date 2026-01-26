const { poolPromise } = require('../config/db');

class ChatMessage {
  static async create(messageData) {
    const pool = await poolPromise;
    const { customer_id, message, sender_role, is_security_message } = messageData;
    
    // Validar que sender_role sea válido
    if (!['client', 'admin'].includes(sender_role)) {
      throw new Error(`sender_role inválido: ${sender_role}`);
    }
    
    // Verificar que customer_id exista
    try {
      const [customerCheck] = await pool.query('SELECT id FROM customers WHERE id = ?', [customer_id]);
      if (customerCheck.length === 0) {
        throw new Error(`Customer con ID ${customer_id} no existe`);
      }
    } catch (error) {
      console.error('Error verificando existencia:', error);
      throw error;
    }
    
    // Usar el parámetro is_security_message del request
    const isSecurityMessage = is_security_message ? 1 : 0;
    
    const query = `
      INSERT INTO chat_messages (customer_id, body, sender_role, is_security_message)
      VALUES (?, ?, ?, ?)
    `;
    
    try {
      const [result] = await pool.query(query, [customer_id, message, sender_role, isSecurityMessage]);
      return result.insertId;
    } catch (error) {
      console.error('Error en create:', error);
      throw error;
    }
  }

  static async getMessagesByCustomer(customerId, limit = 50) {
    const pool = await poolPromise;
    const query = `
      SELECT 
        id,
        body as message,
        sender_role as sender_type,
        created_at,
        is_read_by_client,
        is_read_by_admin,
        is_security_message
      FROM chat_messages
      WHERE customer_id = ?
      ORDER BY created_at ASC
      LIMIT ?
    `;
    
    try {
      const [rows] = await pool.query(query, [customerId, limit]);
      return rows;
    } catch (error) {
      console.error('Error en getMessagesByCustomer:', error);
      throw error;
    }
  }

  static async getUnreadCount(customerId) {
    const pool = await poolPromise;
    const query = `
      SELECT COUNT(*) as count
      FROM chat_messages
      WHERE customer_id = ? AND sender_role = 'admin' AND is_read_by_client = 0
    `;
    
    try {
      const [rows] = await pool.query(query, [customerId]);
      return rows[0].count;
    } catch (error) {
      throw error;
    }
  }

  static async markAsRead(customerId) {
    const pool = await poolPromise;
    const query = `
      UPDATE chat_messages 
      SET is_read_by_client = 1 
      WHERE customer_id = ? AND sender_role = 'admin' AND is_read_by_client = 0
    `;
    
    try {
      const [result] = await pool.query(query, [customerId]);
      return result.affectedRows;
    } catch (error) {
      throw error;
    }
  }

  static async getRecentChats(adminId) {
    const pool = await poolPromise;
    const query = `
      SELECT
        c.id as customer_id,
        c.name as company_name,
        u.online as online,
        cm.body as last_message,
        cm.created_at as last_message_time,
        cm.sender_role as last_sender,
        COUNT(CASE WHEN cm2.is_read_by_admin = 0 AND cm2.sender_role = 'client' THEN 1 END) as unread_count
      FROM customers c
      INNER JOIN chat_messages cm ON c.id = cm.customer_id
      LEFT JOIN chat_messages cm2 ON c.id = cm2.customer_id
      LEFT JOIN users u ON u.rut = c.rut
      WHERE cm.id = (
        SELECT MAX(id) 
        FROM chat_messages 
        WHERE customer_id = c.id
        AND admin_id = ?
        AND NOT (sender_role = 'admin' AND is_security_message = 1)
      )
      AND cm.admin_id = ?
      AND NOT (cm.sender_role = 'admin' AND cm.is_security_message = 1)
      GROUP BY c.id, c.name, u.online, cm.body, cm.created_at, cm.sender_role
      ORDER BY cm.created_at DESC
    `;
    
    try {
      const [rows] = await pool.query(query, [adminId, adminId]);
      return rows;
    } catch (error) {
      throw error;
    }
  }

  static async getAdminUnreadCount(adminId) {
    const pool = await poolPromise;
    const query = `
      SELECT COUNT(*) as count
      FROM chat_messages
      WHERE sender_role = 'client' AND is_read_by_admin = 0 AND admin_id = ?
    `;
    
    try {
      const [rows] = await pool.query(query, [adminId]);
      return rows[0].count;
    } catch (error) {
      throw error;
    }
  }

  static async markAllAsRead(adminId) {
    const pool = await poolPromise;
    const query = `
      UPDATE chat_messages 
      SET is_read_by_admin = 1 
      WHERE sender_role = 'client' AND is_read_by_admin = 0 AND admin_id = ?
    `;
    
    try {
      const [result] = await pool.query(query, [adminId]);
      return result.affectedRows;
    } catch (error) {
      throw error;
    }
  }

  static async markAsReadByAdmin(customerId, adminId) {
    const pool = await poolPromise;
    const query = `
      UPDATE chat_messages 
      SET is_read_by_admin = 1 
      WHERE customer_id = ? AND admin_id = ? AND sender_role = 'client' AND is_read_by_admin = 0
    `;
    
    try {
      const [result] = await pool.query(query, [customerId, adminId]);
      return result.affectedRows;
    } catch (error) {
      throw error;
    }
  }

  static async getAdmins() {
    const pool = await poolPromise;
    const query = `
      SELECT u.id, COALESCE(a.name, '') AS full_name, u.online 
      FROM users u
      JOIN admins a ON u.rut = a.rut
      WHERE u.role_id = 1 AND u.agent = 1
      ORDER BY a.name ASC
    `;
    
    try {
      const [rows] = await pool.query(query);
      return rows;
    } catch (error) {
      throw error;
    }
  }

  static async getMessagesByAdmin(customerId, adminId) {
    const pool = await poolPromise;
    const query = `
      SELECT * FROM chat_messages 
      WHERE customer_id = ? AND admin_id = ?
      ORDER BY created_at ASC
    `;
    
    try {
      const [rows] = await pool.query(query, [customerId, adminId]);
      return rows;
    } catch (error) {
      throw error;
    }
  }

  static async sendMessageWithAdmin(customerId, adminId, message, senderRole, isSecurityMessage = false) {
    const pool = await poolPromise;
    const query = `
      INSERT INTO chat_messages (customer_id, admin_id, body, sender_role, is_security_message, created_at)
      VALUES (?, ?, ?, ?, ?, NOW())
    `;
    
    try {
      const [result] = await pool.query(query, [customerId, adminId, message, senderRole, isSecurityMessage]);
      return result.insertId;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = ChatMessage; 
