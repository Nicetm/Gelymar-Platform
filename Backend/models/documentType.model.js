const { poolPromise } = require('../config/db');

class DocumentType {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.description = data.description;
    this.is_active = data.is_active;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  static async getAll() {
    const pool = await poolPromise;
    const [rows] = await pool.query(
      'SELECT * FROM document_types WHERE is_active = TRUE ORDER BY name ASC'
    );
    return rows.map(row => new DocumentType(row));
  }

  static async getById(id) {
    const pool = await poolPromise;
    const [rows] = await pool.query(
      'SELECT * FROM document_types WHERE id = ? AND is_active = TRUE',
      [id]
    );
    return rows.length > 0 ? new DocumentType(rows[0]) : null;
  }

  static async create(data) {
    const pool = await poolPromise;
    const [result] = await pool.query(
      'INSERT INTO document_types (name, description) VALUES (?, ?)',
      [data.name, data.description]
    );
    return result.insertId;
  }

  static async update(id, data) {
    const pool = await poolPromise;
    const [result] = await pool.query(
      'UPDATE document_types SET name = ?, description = ? WHERE id = ?',
      [data.name, data.description, id]
    );
    return result.affectedRows > 0;
  }

  static async delete(id) {
    const pool = await poolPromise;
    const [result] = await pool.query(
      'UPDATE document_types SET is_active = FALSE WHERE id = ?',
      [id]
    );
    return result.affectedRows > 0;
  }
}

module.exports = DocumentType; 