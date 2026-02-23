const { poolPromise } = require('../config/db');
const { getSqlPool, sql } = require('../config/sqlserver');
const { normalizeRut } = require('../utils/rut.util');

const fetchCustomerNames = async (ruts = []) => {
  const cleaned = (ruts || [])
    .map((rut) => String(rut || '').trim())
    .filter(Boolean);
  if (!cleaned.length) return new Map();

  const sqlPool = await getSqlPool();
  const request = sqlPool.request();
  const placeholders = cleaned.map((rut, idx) => {
    const key = `rut${idx}`;
    request.input(key, sql.VarChar, rut);
    return `@${key}`;
  });

  const result = await request.query(`
    SELECT Rut, Nombre
    FROM jor_imp_CLI_01_softkey
    WHERE Rut IN (${placeholders.join(', ')})
  `);

  const map = new Map();
  (result.recordset || []).forEach((row) => {
    if (row?.Rut) {
      map.set(String(row.Rut), String(row.Nombre || ''));
    }
  });
  return map;
};

class ChatMessage {
  static async create(messageData) {
    const pool = await poolPromise;
    const { customer_id, message, sender_role, is_security_message } = messageData;
    
    // Validar que sender_role sea válido
    if (!['client', 'admin'].includes(sender_role)) {
      throw new Error(`sender_role inválido: ${sender_role}`);
    }
    
    // Verificar que customer_id (RUT) exista en SQL
    try {
      const sqlPool = await getSqlPool();
      const request = sqlPool.request();
      const rawRut = String(customer_id || '').trim();
      const hasTrailingC = rawRut.toLowerCase().endsWith('c');
      const altRut = hasTrailingC ? rawRut.slice(0, -1) : `${rawRut}C`;
      request.input('rut', sql.VarChar, rawRut);
      request.input('rutAlt', sql.VarChar, altRut);
      const result = await request.query(`
        SELECT TOP 1 Rut
        FROM jor_imp_CLI_01_softkey
        WHERE Rut = @rut OR Rut = @rutAlt
      `);
      if (!result.recordset?.length) {
        throw new Error(`Customer con RUT ${customer_id} no existe`);
      }
    } catch (error) {
      const { logger } = require('../utils/logger');
      logger.error(`[ChatMessage] Error verificando existencia: ${error.message}`);
      throw error;
    }
    
    // Usar el parámetro is_security_message del request
    const isSecurityMessage = is_security_message ? 1 : 0;
    
    const query = `
      INSERT INTO chat_messages (rut, body, sender_role, is_security_message)
      VALUES (?, ?, ?, ?)
    `;
    
    try {
      const [result] = await pool.query(query, [customer_id, message, sender_role, isSecurityMessage]);
      return result.insertId;
    } catch (error) {
      const { logger } = require('../utils/logger');
      logger.error(`[ChatMessage] Error en create: ${error.message}`);
      throw error;
    }
  }

  static async getMessagesByCustomer(customerId, limit = 50) {
    const pool = await poolPromise;
    const query = `
      SELECT 
        id,
        rut AS customer_id,
        body as message,
        sender_role as sender_type,
        created_at,
        is_read_by_client,
        is_read_by_admin,
        is_security_message
      FROM chat_messages
      WHERE rut = ?
      ORDER BY created_at ASC
      LIMIT ?
    `;
    
    try {
      const [rows] = await pool.query(query, [customerId, limit]);
      return rows;
    } catch (error) {
      const { logger } = require('../utils/logger');
      logger.error(`[ChatMessage] Error en getMessagesByCustomer: ${error.message}`);
      throw error;
    }
  }

  static async getUnreadCount(customerId) {
    const pool = await poolPromise;
    const query = `
      SELECT COUNT(*) as count
      FROM chat_messages
      WHERE rut = ? AND sender_role = 'admin' AND is_read_by_client = 0
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
      WHERE rut = ? AND sender_role = 'admin' AND is_read_by_client = 0
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
        cm.rut AS customer_id,
        cm.body as last_message,
        cm.created_at as last_message_time,
        cm.sender_role as last_sender,
        COUNT(CASE WHEN cm2.is_read_by_admin = 0 AND cm2.sender_role = 'client' THEN 1 END) as unread_count
      FROM chat_messages cm
      LEFT JOIN chat_messages cm2 ON cm.rut = cm2.rut AND cm2.admin_id = ?
      WHERE cm.id = (
        SELECT MAX(id)
        FROM chat_messages
        WHERE rut = cm.rut
        AND admin_id = ?
        AND NOT (sender_role = 'admin' AND is_security_message = 1)
      )
      AND cm.admin_id = ?
      AND NOT (cm.sender_role = 'admin' AND cm.is_security_message = 1)
      GROUP BY cm.rut, cm.body, cm.created_at, cm.sender_role
      ORDER BY cm.created_at DESC
    `;
    
    try {
      const [rows] = await pool.query(query, [adminId, adminId, adminId]);
      const customerIds = rows.map((row) => String(row.customer_id || '').trim()).filter(Boolean);
      const normalizedRuts = customerIds.map(normalizeRut).filter(Boolean);
      const [onlineRows] = normalizedRuts.length
        ? await pool.query(
          `SELECT rut, online FROM users WHERE rut IN (${normalizedRuts.map(() => '?').join(',')})`,
          normalizedRuts
        )
        : [[]];

      const onlineMap = new Map();
      (onlineRows || []).forEach((row) => {
        if (row?.rut) {
          onlineMap.set(normalizeRut(row.rut), Number(row.online || 0));
        }
      });

      const nameMap = await fetchCustomerNames(customerIds);

      return rows.map((row) => ({
        customer_id: row.customer_id,
        company_name: nameMap.get(String(row.customer_id)) || '',
        online: onlineMap.get(normalizeRut(row.customer_id)) ?? 0,
        last_message: row.last_message,
        last_message_time: row.last_message_time,
        last_sender: row.last_sender,
        unread_count: Number(row.unread_count || 0)
      }));
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
      WHERE rut = ? AND admin_id = ? AND sender_role = 'client' AND is_read_by_admin = 0
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
      SELECT u.id, COALESCE(a.name, '') AS full_name, u.online, ua.file_path AS avatar_path
      FROM users u
      JOIN admins a ON u.rut = a.rut
      LEFT JOIN user_avatar ua ON u.id = ua.user_id AND ua.is_active = 1
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
      WHERE rut = ? AND admin_id = ?
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
      INSERT INTO chat_messages (rut, admin_id, body, sender_role, is_security_message, created_at)
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
