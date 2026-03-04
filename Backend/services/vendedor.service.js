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
    // 1. Obtener SlpCode y SlpName desde SQL Server
    const sqlResult = await sqlPool.request().query(`
      SELECT
        CAST(SlpCode AS varchar(50)) AS SlpCode,
        SlpName
      FROM jor_imp_VEND_90_softkey
    `);
    
    const vendedores = sqlResult.recordset || [];
    logger.info(`[getVendedores] sqlVendedores=${vendedores.length} search=${search || ''}`);
    
    if (!vendedores.length) return [];

    const codes = vendedores
      .map((row) => String(row.SlpCode || '').trim())
      .filter(Boolean);

    // 2. Buscar en MySQL sellers por codigo
    const [sellerRows] = codes.length > 0
      ? await pool.query(
          `SELECT codigo, rut, activo, bloqueado, phone, email FROM sellers WHERE codigo IN (?)`,
          [codes]
        )
      : [[]];

    const sellerMap = new Map();
    sellerRows.forEach((row) => {
      sellerMap.set(String(row.codigo || '').trim(), row);
    });

    // 3. Obtener usuarios
    const [userRows] = await pool.query(
      `SELECT id, rut, online, created_at, updated_at FROM users WHERE role_id = 3`
    );
    const userMap = new Map();
    userRows.forEach((row) => {
      userMap.set(normalized(row.rut), row);
    });

    // 4. Combinar datos
    let sellers = vendedores.map((vendedor) => {
      const codigo = String(vendedor.SlpCode || '').trim();
      const seller = sellerMap.get(codigo);
      const user = seller ? userMap.get(normalized(seller.rut)) : null;
      
      return new Vendedor({
        id: user?.id || null,
        rut: seller?.rut || null,
        email: seller?.email || null,
        full_name: vendedor.SlpName || null,
        phone: seller?.phone || null,
        country: null,
        city: null,
        activo: seller?.activo ?? 0,
        bloqueado: seller?.bloqueado ?? 0,
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
