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
      u.email,
      u.full_name,
      u.phone,
      u.country,
      u.city,
      u.role_id,
      u.online,
      u.created_at,
      u.updated_at
    FROM users u
    WHERE u.role_id = 3
  `;

  const params = [];

  if (search && typeof search === 'string') {
    const normalized = `%${search.trim().toLowerCase()}%`;
    query += `
      AND (
        LOWER(u.full_name) LIKE ?
        OR LOWER(u.email) LIKE ?
        OR LOWER(COALESCE(u.phone, '')) LIKE ?
        OR LOWER(COALESCE(u.country, '')) LIKE ?
        OR LOWER(COALESCE(u.city, '')) LIKE ?
      )
    `;
    params.push(normalized, normalized, normalized, normalized, normalized);
  }

  query += ' ORDER BY u.full_name ASC, u.email ASC';

  const [rows] = await pool.query(query, params);
  return rows.map((row) => new Vendedor(row));
}

module.exports = {
  getVendedores,
};

