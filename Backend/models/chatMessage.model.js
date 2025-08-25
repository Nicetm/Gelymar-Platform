const { poolPromise } = require('../config/db');

class ChatMessage {
  static async create(messageData) {
    const pool = await poolPromise;
    const { customer_id, message, sender_role } = messageData;
    
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
    
    const query = `
      INSERT INTO chat_messages (customer_id, body, sender_role)
      VALUES (?, ?, ?)
    `;
    
    try {
      console.log('Insertando mensaje:', { customer_id, message, sender_role });
      const [result] = await pool.query(query, [customer_id, message, sender_role]);
      console.log('Mensaje insertado con ID:', result.insertId);
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
        is_read_by_client as is_read
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

  static async getRecentChats() {
    const pool = await poolPromise;
    const query = `
      SELECT 
        c.id as customer_id,
        c.name as company_name,
        cm.body as last_message,
        cm.created_at as last_message_time,
        cm.sender_role as last_sender,
        COUNT(CASE WHEN cm2.is_read_by_admin = 0 AND cm2.sender_role = 'client' THEN 1 END) as unread_count
      FROM customers c
      INNER JOIN chat_messages cm ON c.id = cm.customer_id
      LEFT JOIN chat_messages cm2 ON c.id = cm2.customer_id
      WHERE cm.id = (
        SELECT MAX(id) 
        FROM chat_messages 
        WHERE customer_id = c.id
      )
      GROUP BY c.id, c.name, cm.body, cm.created_at, cm.sender_role
      ORDER BY cm.created_at DESC
    `;
    
    try {
      const [rows] = await pool.query(query);
      return rows;
    } catch (error) {
      throw error;
    }
  }

  static async getAdminUnreadCount() {
    const pool = await poolPromise;
    const query = `
      SELECT COUNT(*) as count
      FROM chat_messages
      WHERE sender_role = 'client' AND is_read_by_admin = 0
    `;
    
    try {
      const [rows] = await pool.query(query);
      return rows[0].count;
    } catch (error) {
      throw error;
    }
  }

  static async markAllAsRead() {
    const pool = await poolPromise;
    const query = `
      UPDATE chat_messages 
      SET is_read_by_admin = 1 
      WHERE sender_role = 'client' AND is_read_by_admin = 0
    `;
    
    try {
      const [result] = await pool.query(query);
      return result.affectedRows;
    } catch (error) {
      throw error;
    }
  }

  static async markAsReadByAdmin(customerId) {
    const pool = await poolPromise;
    const query = `
      UPDATE chat_messages 
      SET is_read_by_admin = 1 
      WHERE customer_id = ? AND sender_role = 'client' AND is_read_by_admin = 0
    `;
    
    try {
      const [result] = await pool.query(query, [customerId]);
      return result.affectedRows;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = ChatMessage; 