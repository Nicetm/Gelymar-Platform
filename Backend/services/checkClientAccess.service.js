const { poolPromise } = require('../config/db');
const { getSqlPool } = require('../config/sqlserver');
const bcrypt = require('bcrypt');
const { logger } = require('../utils/logger');

/**
 * Verifica y crea usuarios de acceso para clientes y sellers que no tienen cuenta.
 * - Customers: role_id = 2 (cliente)
 * - Sellers: role_id = 3 (seller)
 */
async function checkClientAccess() {
  const pool = await poolPromise;

  const normalizeRut = (value = '') => value.toString().trim().toLowerCase();

  try {
    // 1. Obtener clientes con RUT válido (SQL Server)
    const sqlPool = await getSqlPool();
    const sqlResult = await sqlPool.request().query(`
      SELECT
        Rut,
        Nombre,
        Telefono,
        Pais,
        Ciudad
      FROM jor_imp_CLI_01_softkey
      WHERE Rut IS NOT NULL AND LTRIM(RTRIM(Rut)) <> ''
    `);
    const customers = (sqlResult.recordset || []).map((row) => ({
      rut: row.Rut,
      name: row.Nombre,
      phone: row.Telefono,
      country: row.Pais,
      city: row.Ciudad
    }));

    // 1b. Obtener sellers desde SQL (jor_imp_VEND_90_softkey)
    const sellersResult = await sqlPool.request().query(`
      SELECT Rut, SlpName
      FROM jor_imp_VEND_90_softkey
      WHERE Rut IS NOT NULL AND LTRIM(RTRIM(Rut)) <> ''
    `);
    const sellers = (sellersResult.recordset || []).map((row) => ({
      rut: row.Rut,
      name: row.SlpName
    }));

    logger.info(`[checkClientAccess] Total de clientes encontrados: ${customers.length}`);
    logger.info(`[checkClientAccess] Total de sellers encontrados: ${sellers.length}`);

    // 2. Obtener RUTs de usuarios existentes
      const [existingUsers] = await pool.query(`
        SELECT rut FROM users WHERE rut IS NOT NULL
      `);

      const existingRuts = existingUsers.map((user) => user.rut);
      const existingRutsSet = new Set(existingUsers.map((user) => normalizeRut(user.rut)));
    logger.info(`[checkClientAccess] Usuarios existentes: ${existingRuts.length}`);

    // 3. Filtrar clientes y sellers que no tienen usuario
    const clientsWithoutAccess = customers.filter((customer) => !existingRutsSet.has(normalizeRut(customer.rut)));
    const sellersWithoutAccess = sellers.filter((seller) => !existingRutsSet.has(normalizeRut(seller.rut)));

    logger.info(`[checkClientAccess] Clientes sin acceso: ${clientsWithoutAccess.length}`);
    logger.info(`[checkClientAccess] Sellers sin acceso: ${sellersWithoutAccess.length}`);

    if (clientsWithoutAccess.length === 0 && sellersWithoutAccess.length === 0) {
      logger.info('[checkClientAccess] Todos los clientes y sellers ya tienen acceso configurado');
      return;
    }

    // 4. Generar contraseña por defecto
    const defaultPassword = '123456';
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    // 5. Crear usuarios para clientes y sellers sin acceso
    let createdCount = 0;
    let errorCount = 0;

    // Clientes -> role_id 2
    for (const customer of clientsWithoutAccess) {
      try {
        if (!customer.rut || customer.rut.trim() === '') {
          logger.warn(`[checkClientAccess] Cliente sin RUT válido: ${customer.name}`);
          continue;
        }

        const normalizedRut = normalizeRut(customer.rut);
        if (existingRutsSet.has(normalizedRut)) {
          logger.info(`[checkClientAccess] Cliente ya tenía usuario rut=${customer.rut}, se omite inserción`);
          continue;
        }

        await pool.query(
          `
          INSERT INTO users (
            rut, 
            password, 
            role_id, 
            twoFASecret, 
            twoFAEnabled, 
            created_at, 
            updated_at
          ) VALUES (?, ?, ?, ?, ?, NOW(), NOW())
        `,
          [
            customer.rut.trim(),
            hashedPassword,
            2, // role_id = 2 (cliente)
            null,
            0,
          ]
        );

        logger.info(`[checkClientAccess] Cliente creado rut=${customer.rut} nombre=${customer.name}`);
        createdCount++;
        existingRutsSet.add(normalizedRut);
      } catch (error) {
        logger.error(`[checkClientAccess] Error creando usuario cliente rut=${customer.rut} nombre=${customer.name}: ${error.message}`);
        errorCount++;
      }
    }

    // Sellers -> role_id 3
    for (const seller of sellersWithoutAccess) {
      try {
        if (!seller.rut || seller.rut.trim() === '') {
          logger.warn(`[checkClientAccess] Seller sin RUT válido: ${seller.rut}`);
          continue;
        }

        const normalizedRut = normalizeRut(seller.rut);
        if (existingRutsSet.has(normalizedRut)) {
          logger.info(`[checkClientAccess] Seller ya tenía usuario rut=${seller.rut}, se omite inserción`);
          continue;
        }

        await pool.query(
          `
          INSERT INTO users (
            rut, 
            password, 
            role_id, 
            twoFASecret, 
            twoFAEnabled, 
            created_at, 
            updated_at
          ) VALUES (?, ?, ?, ?, ?, NOW(), NOW())
        `,
          [
            seller.rut.trim(),
            hashedPassword,
            3, // role_id = 3 (seller)
            null,
            0,
          ]
        );

        logger.info(`[checkClientAccess] Seller creado rut=${seller.rut} nombre=${seller.name || 'N/A'}`);
        createdCount++;
        existingRutsSet.add(normalizedRut);
      } catch (error) {
        logger.error(`[checkClientAccess] Error creando usuario seller rut=${seller.rut}: ${error.message}`);
        errorCount++;
      }
    }

    // 6. Resumen final
    logger.info(`[checkClientAccess] RESUMEN: clientes=${customers.length} sellers=${sellers.length} existentes=${existingRuts.length} nuevos=${createdCount} errores=${errorCount}`);

    if (createdCount > 0) {
      logger.info('[checkClientAccess] Los nuevos usuarios pueden acceder con: email=RUT password=123456 must_change_password=true');
    }
  } catch (error) {
    logger.error(`[checkClientAccess] Error: ${error.message}`);
    throw error;
  }
}

module.exports = {
  checkClientAccess,
};
