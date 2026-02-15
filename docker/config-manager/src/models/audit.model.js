const mysql = require('mysql2/promise');

class AuditModel {
  constructor() {
    this.pool = mysql.createPool({
      host: process.env.MYSQL_DB_HOST || 'mysql',
      port: process.env.MYSQL_DB_PORT || 3306,
      user: process.env.MYSQL_DB_USER || 'root',
      password: process.env.MYSQL_DB_PASS || 'gelymar2024',
      database: process.env.MYSQL_DB_NAME || 'gelymar_platform',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
  }

  // Crear tabla de auditoría si no existe
  async createAuditTable() {
    try {
      await this.pool.execute(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT,
          username VARCHAR(255),
          action VARCHAR(100) NOT NULL,
          resource_type VARCHAR(100),
          resource_id VARCHAR(255),
          details JSON,
          ip_address VARCHAR(45),
          user_agent TEXT,
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_user_id (user_id),
          INDEX idx_action (action),
          INDEX idx_timestamp (timestamp),
          INDEX idx_resource (resource_type, resource_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
    } catch (error) {
      console.error('Error creando tabla de auditoría:', error);
      throw error;
    }
  }

  // Registrar acción de auditoría
  async logAction(auditData) {
    try {
      const {
        userId,
        username,
        action,
        resourceType = null,
        resourceId = null,
        details = null,
        ipAddress = null,
        userAgent = null
      } = auditData;

      const [result] = await this.pool.execute(`
        INSERT INTO audit_logs (
          user_id, username, action, resource_type, resource_id, 
          details, ip_address, user_agent, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `, [
        userId,
        username,
        action,
        resourceType,
        resourceId,
        details ? JSON.stringify(details) : null,
        ipAddress,
        userAgent
      ]);

      return result.insertId;
    } catch (error) {
      console.error('Error registrando acción de auditoría:', error);
      throw error;
    }
  }

  // Obtener logs de auditoría
  async getAuditLogs(filters = {}) {
    try {
      const {
        userId = null,
        action = null,
        resourceType = null,
        startDate = null,
        endDate = null,
        limit = 100,
        offset = 0
      } = filters;

      let query = `
        SELECT 
          al.*,
          u.username as user_username,
          u.email as user_email
        FROM audit_logs al
        LEFT JOIN users u ON al.user_id = u.id
        WHERE 1=1
      `;
      
      const params = [];

      if (userId) {
        query += ' AND al.user_id = ?';
        params.push(userId);
      }

      if (action) {
        query += ' AND al.action = ?';
        params.push(action);
      }

      if (resourceType) {
        query += ' AND al.resource_type = ?';
        params.push(resourceType);
      }

      if (startDate) {
        query += ' AND al.timestamp >= ?';
        params.push(startDate);
      }

      if (endDate) {
        query += ' AND al.timestamp <= ?';
        params.push(endDate);
      }

      query += ' ORDER BY al.timestamp DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const [rows] = await this.pool.execute(query, params);
      return rows;
    } catch (error) {
      console.error('Error obteniendo logs de auditoría:', error);
      throw error;
    }
  }

  // Obtener estadísticas de auditoría
  async getAuditStats(filters = {}) {
    try {
      const {
        startDate = null,
        endDate = null
      } = filters;

      let query = `
        SELECT 
          COUNT(*) as total_actions,
          COUNT(DISTINCT user_id) as unique_users,
          COUNT(CASE WHEN action = 'login' THEN 1 END) as login_actions,
          COUNT(CASE WHEN action = 'logout' THEN 1 END) as logout_actions,
          COUNT(CASE WHEN action LIKE 'create%' THEN 1 END) as create_actions,
          COUNT(CASE WHEN action LIKE 'update%' THEN 1 END) as update_actions,
          COUNT(CASE WHEN action LIKE 'delete%' THEN 1 END) as delete_actions,
          COUNT(CASE WHEN action LIKE 'container%' THEN 1 END) as container_actions,
          COUNT(CASE WHEN action LIKE 'config%' THEN 1 END) as config_actions
        FROM audit_logs
        WHERE 1=1
      `;
      
      const params = [];

      if (startDate) {
        query += ' AND timestamp >= ?';
        params.push(startDate);
      }

      if (endDate) {
        query += ' AND timestamp <= ?';
        params.push(endDate);
      }

      const [rows] = await this.pool.execute(query, params);
      return rows[0];
    } catch (error) {
      console.error('Error obteniendo estadísticas de auditoría:', error);
      throw error;
    }
  }

  // Obtener acciones más frecuentes
  async getTopActions(limit = 10, filters = {}) {
    try {
      const {
        startDate = null,
        endDate = null
      } = filters;

      let query = `
        SELECT 
          action,
          COUNT(*) as count,
          COUNT(DISTINCT user_id) as unique_users
        FROM audit_logs
        WHERE 1=1
      `;
      
      const params = [];

      if (startDate) {
        query += ' AND timestamp >= ?';
        params.push(startDate);
      }

      if (endDate) {
        query += ' AND timestamp <= ?';
        params.push(endDate);
      }

      query += ' GROUP BY action ORDER BY count DESC LIMIT ?';
      params.push(limit);

      const [rows] = await this.pool.execute(query, params);
      return rows;
    } catch (error) {
      console.error('Error obteniendo acciones más frecuentes:', error);
      throw error;
    }
  }

  // Obtener usuarios más activos
  async getTopUsers(limit = 10, filters = {}) {
    try {
      const {
        startDate = null,
        endDate = null
      } = filters;

      let query = `
        SELECT 
          al.user_id,
          al.username,
          COUNT(*) as action_count,
          MAX(al.timestamp) as last_action
        FROM audit_logs al
        WHERE al.user_id IS NOT NULL
      `;
      
      const params = [];

      if (startDate) {
        query += ' AND al.timestamp >= ?';
        params.push(startDate);
      }

      if (endDate) {
        query += ' AND al.timestamp <= ?';
        params.push(endDate);
      }

      query += ' GROUP BY al.user_id, al.username ORDER BY action_count DESC LIMIT ?';
      params.push(limit);

      const [rows] = await this.pool.execute(query, params);
      return rows;
    } catch (error) {
      console.error('Error obteniendo usuarios más activos:', error);
      throw error;
    }
  }

  // Limpiar logs antiguos
  async cleanOldLogs(daysToKeep = 90) {
    try {
      const [result] = await this.pool.execute(`
        DELETE FROM audit_logs 
        WHERE timestamp < DATE_SUB(NOW(), INTERVAL ? DAY)
      `, [daysToKeep]);

      return result.affectedRows;
    } catch (error) {
      console.error('Error limpiando logs antiguos:', error);
      throw error;
    }
  }

  // Obtener actividad por hora del día
  async getActivityByHour(filters = {}) {
    try {
      const {
        startDate = null,
        endDate = null
      } = filters;

      let query = `
        SELECT 
          HOUR(timestamp) as hour,
          COUNT(*) as action_count
        FROM audit_logs
        WHERE 1=1
      `;
      
      const params = [];

      if (startDate) {
        query += ' AND timestamp >= ?';
        params.push(startDate);
      }

      if (endDate) {
        query += ' AND timestamp <= ?';
        params.push(endDate);
      }

      query += ' GROUP BY HOUR(timestamp) ORDER BY hour';

      const [rows] = await this.pool.execute(query, params);
      return rows;
    } catch (error) {
      console.error('Error obteniendo actividad por hora:', error);
      throw error;
    }
  }

  // Obtener actividad por día
  async getActivityByDay(filters = {}) {
    try {
      const {
        startDate = null,
        endDate = null,
        days = 30
      } = filters;

      let query = `
        SELECT 
          DATE(timestamp) as date,
          COUNT(*) as action_count,
          COUNT(DISTINCT user_id) as unique_users
        FROM audit_logs
        WHERE 1=1
      `;
      
      const params = [];

      if (startDate) {
        query += ' AND timestamp >= ?';
        params.push(startDate);
      } else {
        query += ' AND timestamp >= DATE_SUB(NOW(), INTERVAL ? DAY)';
        params.push(days);
      }

      if (endDate) {
        query += ' AND timestamp <= ?';
        params.push(endDate);
      }

      query += ' GROUP BY DATE(timestamp) ORDER BY date DESC';

      const [rows] = await this.pool.execute(query, params);
      return rows;
    } catch (error) {
      console.error('Error obteniendo actividad por día:', error);
      throw error;
    }
  }

  // Cerrar conexión
  async close() {
    await this.pool.end();
  }
}

module.exports = AuditModel;
