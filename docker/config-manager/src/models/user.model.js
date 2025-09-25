const mysql = require('mysql2/promise');

class UserModel {
  constructor() {
    this.pool = mysql.createPool({
      host: process.env.DB_HOST || 'mysql',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'gelymar2024',
      database: process.env.DB_NAME || 'gelymar_platform',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
  }

  // Obtener todos los usuarios
  async getAllUsers() {
    try {
      const [rows] = await this.pool.execute(`
        SELECT 
          id, 
          username, 
          email, 
          role, 
          is_active, 
          last_login, 
          created_at, 
          updated_at,
          permissions
        FROM users 
        ORDER BY created_at DESC
      `);
      return rows;
    } catch (error) {
      console.error('Error obteniendo usuarios:', error);
      throw error;
    }
  }

  // Obtener usuario por ID
  async getUserById(id) {
    try {
      const [rows] = await this.pool.execute(
        'SELECT * FROM users WHERE id = ?',
        [id]
      );
      return rows[0];
    } catch (error) {
      console.error('Error obteniendo usuario por ID:', error);
      throw error;
    }
  }

  // Obtener usuario por username
  async getUserByUsername(username) {
    try {
      const [rows] = await this.pool.execute(
        'SELECT * FROM users WHERE username = ?',
        [username]
      );
      return rows[0];
    } catch (error) {
      console.error('Error obteniendo usuario por username:', error);
      throw error;
    }
  }

  // Crear nuevo usuario
  async createUser(userData) {
    try {
      const {
        username,
        email,
        password,
        role = 'user',
        permissions = '{}',
        is_active = true
      } = userData;

      const [result] = await this.pool.execute(`
        INSERT INTO users (username, email, password, role, permissions, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
      `, [username, email, password, role, permissions, is_active]);

      return result.insertId;
    } catch (error) {
      console.error('Error creando usuario:', error);
      throw error;
    }
  }

  // Actualizar usuario
  async updateUser(id, userData) {
    try {
      const {
        username,
        email,
        role,
        permissions,
        is_active
      } = userData;

      const fields = [];
      const values = [];

      if (username !== undefined) {
        fields.push('username = ?');
        values.push(username);
      }
      if (email !== undefined) {
        fields.push('email = ?');
        values.push(email);
      }
      if (role !== undefined) {
        fields.push('role = ?');
        values.push(role);
      }
      if (permissions !== undefined) {
        fields.push('permissions = ?');
        values.push(permissions);
      }
      if (is_active !== undefined) {
        fields.push('is_active = ?');
        values.push(is_active);
      }

      fields.push('updated_at = NOW()');
      values.push(id);

      const [result] = await this.pool.execute(`
        UPDATE users 
        SET ${fields.join(', ')}
        WHERE id = ?
      `, values);

      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error actualizando usuario:', error);
      throw error;
    }
  }

  // Cambiar contraseña
  async changePassword(id, newPassword) {
    try {
      const [result] = await this.pool.execute(`
        UPDATE users 
        SET password = ?, updated_at = NOW()
        WHERE id = ?
      `, [newPassword, id]);

      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error cambiando contraseña:', error);
      throw error;
    }
  }

  // Eliminar usuario
  async deleteUser(id) {
    try {
      const [result] = await this.pool.execute(
        'DELETE FROM users WHERE id = ?',
        [id]
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error eliminando usuario:', error);
      throw error;
    }
  }

  // Actualizar último login
  async updateLastLogin(id) {
    try {
      const [result] = await this.pool.execute(`
        UPDATE users 
        SET last_login = NOW(), updated_at = NOW()
        WHERE id = ?
      `, [id]);

      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error actualizando último login:', error);
      throw error;
    }
  }

  // Obtener usuarios por rol
  async getUsersByRole(role) {
    try {
      const [rows] = await this.pool.execute(
        'SELECT * FROM users WHERE role = ? ORDER BY created_at DESC',
        [role]
      );
      return rows;
    } catch (error) {
      console.error('Error obteniendo usuarios por rol:', error);
      throw error;
    }
  }

  // Obtener usuarios activos
  async getActiveUsers() {
    try {
      const [rows] = await this.pool.execute(`
        SELECT * FROM users 
        WHERE is_active = 1 
        ORDER BY last_login DESC
      `);
      return rows;
    } catch (error) {
      console.error('Error obteniendo usuarios activos:', error);
      throw error;
    }
  }

  // Verificar si username existe
  async usernameExists(username, excludeId = null) {
    try {
      let query = 'SELECT COUNT(*) as count FROM users WHERE username = ?';
      const params = [username];

      if (excludeId) {
        query += ' AND id != ?';
        params.push(excludeId);
      }

      const [rows] = await this.pool.execute(query, params);
      return rows[0].count > 0;
    } catch (error) {
      console.error('Error verificando username:', error);
      throw error;
    }
  }

  // Verificar si email existe
  async emailExists(email, excludeId = null) {
    try {
      let query = 'SELECT COUNT(*) as count FROM users WHERE email = ?';
      const params = [email];

      if (excludeId) {
        query += ' AND id != ?';
        params.push(excludeId);
      }

      const [rows] = await this.pool.execute(query, params);
      return rows[0].count > 0;
    } catch (error) {
      console.error('Error verificando email:', error);
      throw error;
    }
  }

  // Obtener estadísticas de usuarios
  async getUserStats() {
    try {
      const [rows] = await this.pool.execute(`
        SELECT 
          COUNT(*) as total_users,
          COUNT(CASE WHEN is_active = 1 THEN 1 END) as active_users,
          COUNT(CASE WHEN is_active = 0 THEN 1 END) as inactive_users,
          COUNT(CASE WHEN role = 'admin' THEN 1 END) as admin_users,
          COUNT(CASE WHEN role = 'user' THEN 1 END) as regular_users,
          COUNT(CASE WHEN last_login > DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) as recent_logins
        FROM users
      `);
      return rows[0];
    } catch (error) {
      console.error('Error obteniendo estadísticas de usuarios:', error);
      throw error;
    }
  }

  // Cerrar conexión
  async close() {
    await this.pool.end();
  }
}

module.exports = UserModel;
