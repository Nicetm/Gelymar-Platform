const { poolPromise } = require('../config/db');
const Vendedor = require('../models/vendedor.model');

/**
 * Obtiene la lista de vendedores (usuarios con role_id = 3)
 * @param {Object} options
 * @param {string} [options.search] - Término de búsqueda opcional
 * @returns {Promise<Array<Vendedor>>}
 */
async function getVendedores({ search } = {}) {
  const pool = await poolPromise;

  let query = `
    SELECT 
      u.id,
      u.rut,
      u.rut AS email,
      s.nombre AS full_name,
      NULL AS phone,
      NULL AS country,
      NULL AS city,
      u.role_id,
      u.online,
      u.created_at,
      u.updated_at
    FROM users u
    LEFT JOIN sellers s ON s.rut COLLATE utf8mb4_general_ci = u.rut COLLATE utf8mb4_general_ci
    WHERE u.role_id = 3
  `;

  const params = [];

  if (search && typeof search === 'string') {
    const normalized = `%${search.trim().toLowerCase()}%`;
    query += `
      AND (
        LOWER(COALESCE(s.nombre, '')) LIKE ?
        OR LOWER(u.rut) LIKE ?
      )
    `;
    params.push(normalized, normalized);
  }

  query += ' ORDER BY s.nombre ASC, u.rut ASC';

  const [rows] = await pool.query(query, params);
  return rows.map((row) => new Vendedor(row));
}

module.exports = {
  getVendedores,
};
