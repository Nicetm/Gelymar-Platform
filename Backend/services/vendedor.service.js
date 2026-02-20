const { poolPromise } = require('../config/db');
const { getSqlPool, sql } = require('../config/sqlserver');
const { logger } = require('../utils/logger');
const Vendedor = require('../models/vendedor.model');

/**
 * Obtiene la lista de vendedores (usuarios con role_id = 3)
 * @param {Object} options
 * @param {string} [options.search] - Término de búsqueda opcional
 * @returns {Promise<Array<Vendedor>>}
 */
async function getVendedores({ search } = {}) {
  const pool = await poolPromise;
  const sqlPool = await getSqlPool();

  const normalized = (value) => String(value || '').trim().toLowerCase();

  try {
    const [sellerRows] = await pool.query(
      `SELECT codigo, rut, activo, bloqueado, phone, email FROM sellers WHERE rut IS NOT NULL AND rut <> '' AND rut <> 0`
    );
    logger.info(`[getVendedores] sellers=${sellerRows.length} search=${search || ''}`);
    if (!sellerRows.length) return [];

    const codes = sellerRows
      .map((row) => String(row.codigo || '').trim())
      .filter(Boolean);
    const sellerNameMap = new Map();

    if (codes.length) {
      try {
        const request = sqlPool.request();
        const placeholders = codes.map((_, idx) => `@code${idx}`);
        codes.forEach((code, idx) => {
          request.input(`code${idx}`, sql.VarChar, code);
        });
        const query = `
          SELECT
            CAST(SlpCode AS varchar(50)) AS SlpCode,
            SlpName
          FROM jor_imp_VEND_90_softkey
          WHERE CAST(SlpCode AS varchar(50)) IN (${placeholders.join(', ')})
        `;
        const result = await request.query(query);
        (result.recordset || []).forEach((row) => {
          if (row.SlpCode) {
            sellerNameMap.set(String(row.SlpCode).trim(), row.SlpName);
          }
        });
        logger.info(`[getVendedores] sqlNames=${sellerNameMap.size}`);
      } catch (error) {
        logger.error(`[getVendedores] Error consultando vendedores en SQL: ${error.message}`);
      }
    }

    const [userRows] = await pool.query(
      `SELECT id, rut, online, created_at, updated_at FROM users WHERE role_id = 3`
    );
    const userMap = new Map();
    userRows.forEach((row) => {
      userMap.set(normalized(row.rut), row);
    });

    let sellers = sellerRows.map((row) => {
      const user = userMap.get(normalized(row.rut));
      const name = sellerNameMap.get(String(row.codigo || '').trim()) || row.rut;
      return new Vendedor({
        id: user?.id || null,
        rut: row.rut,
        email: row.email || row.rut,
        full_name: name,
        phone: row.phone || null,
        country: null,
        city: null,
        activo: row.activo ?? 0,
        bloqueado: row.bloqueado ?? 0,
        role_id: 3,
        online: user?.online ?? 0,
        created_at: user?.created_at || null,
        updated_at: user?.updated_at || null
      });
    });

    if (search && typeof search === 'string') {
      const needle = search.trim().toLowerCase();
      sellers = sellers.filter((seller) => {
        return [seller.full_name, seller.email, seller.rut]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(needle));
      });
    }

    sellers.sort((a, b) => {
      const nameA = normalized(a.full_name);
      const nameB = normalized(b.full_name);
      if (nameA < nameB) return -1;
      if (nameA > nameB) return 1;
      return normalized(a.rut).localeCompare(normalized(b.rut));
    });

    return sellers;
  } catch (error) {
    logger.error(`[getVendedores] Error general: ${error.message}`);
    throw error;
  }
}

module.exports = {
  getVendedores,
  updateSellerByRut: async (rut, payload = {}) => {
    const pool = await poolPromise;
    const rawRut = String(rut || '').trim();
    if (!rawRut) return null;

    const [existingRows] = await pool.query(
      'SELECT codigo, rut FROM sellers WHERE rut = ? LIMIT 1',
      [rawRut]
    );
    if (!existingRows.length) return null;

    const nextRut = (payload.rut || rawRut).trim();
    if (nextRut && nextRut !== rawRut) {
      const [dupRows] = await pool.query(
        'SELECT rut FROM sellers WHERE rut = ? LIMIT 1',
        [nextRut]
      );
      if (dupRows.length) {
        const error = new Error('RUT ya existe');
        error.code = 'RUT_EXISTS';
        throw error;
      }
    }

    const activo = payload.activo ?? 0;
    const bloqueado = payload.bloqueado ?? 0;
    const telefono = payload.phone ?? null;
    const correo = payload.email ?? null;

    await pool.query(
      `
      UPDATE sellers
      SET rut = ?, activo = ?, bloqueado = ?, phone = ?, email = ?
      WHERE rut = ?
      `,
      [nextRut, activo, bloqueado, telefono, correo, rawRut]
    );

    await pool.query(
      'UPDATE users SET rut = ?, bloqueado = ? WHERE rut = ? AND role_id = 3',
      [nextRut, bloqueado, rawRut]
    );

    const [rows] = await pool.query(
      'SELECT codigo, rut, activo, bloqueado, phone, email FROM sellers WHERE rut = ? LIMIT 1',
      [nextRut]
    );
    return rows[0] || null;
  },
  changeSellerPassword: async (rut, password) => {
    const pool = await poolPromise;
    const rawRut = String(rut || '').trim();
    if (!rawRut) return null;
    const [users] = await pool.query(
      'SELECT id FROM users WHERE rut = ? AND role_id = 3 LIMIT 1',
      [rawRut]
    );
    if (!users.length) return null;
    return users[0].id;
  }
};
