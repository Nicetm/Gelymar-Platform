const { poolPromise } = require('../config/db');
const { getSqlPool } = require('../config/sqlserver');
const bcrypt = require('bcrypt');

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

    // 1b. Obtener sellers activos y no bloqueados con RUT válido
    const [sellers] = await pool.query(`
      SELECT rut, nombre AS name
      FROM sellers
      WHERE activo = 1
        AND bloqueado = 0
        AND rut IS NOT NULL
        AND rut != ''
    `);

    console.log(`[${new Date().toISOString()}] -> Check Client Access Process -> Total de clientes encontrados: ${customers.length}`);
    console.log(`[${new Date().toISOString()}] -> Check Client Access Process -> Total de sellers encontrados: ${sellers.length}`);

    // 2. Obtener RUTs de usuarios existentes
      const [existingUsers] = await pool.query(`
        SELECT rut FROM users WHERE rut IS NOT NULL
      `);

      const existingRuts = existingUsers.map((user) => user.rut);
      const existingRutsSet = new Set(existingUsers.map((user) => normalizeRut(user.rut)));
    console.log(`[${new Date().toISOString()}] -> Check Client Access Process -> Usuarios existentes: ${existingRuts.length}`);

    // 3. Filtrar clientes y sellers que no tienen usuario
    const clientsWithoutAccess = customers.filter((customer) => !existingRutsSet.has(normalizeRut(customer.rut)));
    const sellersWithoutAccess = sellers.filter((seller) => !existingRutsSet.has(normalizeRut(seller.rut)));

    console.log(`[${new Date().toISOString()}] -> Check Client Access Process -> Clientes sin acceso: ${clientsWithoutAccess.length}`);
    console.log(`[${new Date().toISOString()}] -> Check Client Access Process -> Sellers sin acceso: ${sellersWithoutAccess.length}`);

    if (clientsWithoutAccess.length === 0 && sellersWithoutAccess.length === 0) {
      console.log(`[${new Date().toISOString()}] -> Check Client Access Process -> Todos los clientes y sellers ya tienen acceso configurado`);
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
          console.log(`[${new Date().toISOString()}] -> Check Client Access Process -> Cliente sin RUT válido: ${customer.name}`);
          continue;
        }

        const normalizedRut = normalizeRut(customer.rut);
        if (existingRutsSet.has(normalizedRut)) {
          console.log(`[${new Date().toISOString()}] -> Check Client Access Process -> Cliente ya tenía usuario (RUT=${customer.rut}), se omite inserción`);
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

        console.log(`[${new Date().toISOString()}] -> Check Client Access Process -> insertando cliente: RUT=${customer.rut}, Nombre=${customer.name}, Cuenta creada OK`);
        createdCount++;
        existingRutsSet.add(normalizedRut);
      } catch (error) {
        console.error(
          `[${new Date().toISOString()}] -> Check Client Access Process -> Error creando usuario para ${customer.name} (RUT: ${customer.rut}):`,
          error.message
        );
        errorCount++;
      }
    }

    // Sellers -> role_id 3
    for (const seller of sellersWithoutAccess) {
      try {
        if (!seller.rut || seller.rut.trim() === '') {
          console.log(`[${new Date().toISOString()}] -> Check Client Access Process -> Seller sin RUT válido: ${seller.rut}`);
          continue;
        }

        const normalizedRut = normalizeRut(seller.rut);
        if (existingRutsSet.has(normalizedRut)) {
          console.log(`[${new Date().toISOString()}] -> Check Client Access Process -> Seller ya tenía usuario (RUT=${seller.rut}), se omite inserción`);
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

        console.log(`[${new Date().toISOString()}] -> Check Client Access Process -> insertando seller: RUT=${seller.rut}, Nombre=${seller.name || 'N/A'}, Cuenta creada OK`);
        createdCount++;
        existingRutsSet.add(normalizedRut);
      } catch (error) {
        console.error(
          `[${new Date().toISOString()}] -> Check Client Access Process -> Error creando usuario seller RUT: ${seller.rut}:`,
          error.message
        );
        errorCount++;
      }
    }

    // 6. Resumen final
    console.log(`[${new Date().toISOString()}] -> Check Client Access Process -> RESUMEN DEL PROCESAMIENTO:`);
    console.log(`   -> Clientes procesados: ${customers.length}`);
    console.log(`   -> Sellers procesados: ${sellers.length}`);
    console.log(`   -> Usuarios existentes: ${existingRuts.length}`);
    console.log(`   -> Nuevos usuarios creados: ${createdCount}`);
    console.log(`   -> Errores: ${errorCount}`);

    if (createdCount > 0) {
      console.log(`[${new Date().toISOString()}] -> Check Client Access Process -> Los nuevos usuarios pueden acceder con:`);
      console.log(`   -> Email: Su RUT`);
      console.log(`   -> Contraseña: ${defaultPassword}`);
      console.log(`   -> Deben cambiar su contraseña en el primer acceso`);
    }
  } catch (error) {
    console.error(`[${new Date().toISOString()}] -> Check Client Access Process -> Error en checkClientAccess:`, error.message);
    throw error;
  }
}

module.exports = {
  checkClientAccess,
};
