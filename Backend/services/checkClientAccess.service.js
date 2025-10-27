const { poolPromise } = require('../config/db');
const bcrypt = require('bcrypt');

/**
 * Verifica y crea usuarios de acceso para clientes que no tienen cuenta
 * Obtiene clientes de la tabla customers y los sincroniza con la tabla users
 */
async function checkClientAccess() {
  const pool = await poolPromise;
  
  try {
    
    // 1. Obtener todos los clientes con los campos requeridos
    const [customers] = await pool.query(`
      SELECT rut, name, phone, country, city 
      FROM customers 
      WHERE rut IS NOT NULL AND rut != ''
    `);
    
    console.log(`[${new Date().toISOString()}] -> Check Client Access Process -> Total de clientes encontrados: ${customers.length}`);
    
    // 2. Obtener RUTs de usuarios existentes
    const [existingUsers] = await pool.query(`
      SELECT email FROM users WHERE email IS NOT NULL
    `);
    
    const existingRuts = existingUsers.map(user => user.email);
    console.log(`[${new Date().toISOString()}] -> Check Client Access Process -> Usuarios existentes: ${existingRuts.length}`);
    
    // 3. Filtrar clientes que no tienen usuario
    const clientsWithoutAccess = customers.filter(customer => 
      !existingRuts.includes(customer.rut)
    );
    
    console.log(`[${new Date().toISOString()}] -> Check Client Access Process -> Clientes sin acceso: ${clientsWithoutAccess.length}`);
    
    if (clientsWithoutAccess.length === 0) {
      console.log(`[${new Date().toISOString()}] -> Check Client Access Process -> Todos los clientes ya tienen acceso configurado`);
      return;
    }
    
    // 4. Generar contraseña por defecto (RUT como contraseña)
    const defaultPassword = '123456'; // Contraseña por defecto
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);
    
    // 5. Crear usuarios para clientes sin acceso
    let createdCount = 0;
    let errorCount = 0;
    
    for (const customer of clientsWithoutAccess) {
      try {
        // Verificar que el RUT no esté vacío
        if (!customer.rut || customer.rut.trim() === '') {
          console.log(`[${new Date().toISOString()}] -> Check Client Access Process -> Cliente sin RUT válido: ${customer.name}`);
          continue;
        }
        
        // Insertar usuario
        const [result] = await pool.query(`
          INSERT INTO users (
            email, 
            password, 
            role_id, 
            twoFASecret, 
            twoFAEnabled, 
            full_name, 
            phone, 
            country, 
            city, 
            created_at, 
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        `, [
          customer.rut.trim(),           // email = RUT
          hashedPassword,                // password hasheado
          2,                             // role_id = 2 (cliente)
          null,                          // twoFASecret = null
          0,                             // twoFAEnabled = 0
          customer.name || 'Cliente',    // full_name
          customer.phone || null,        // phone
          customer.country || null,      // country
          customer.city || null          // city
        ]);
        
        console.log(`[${new Date().toISOString()}] -> Check Client Access Process -> insertando fila: RUT=${customer.rut}, Nombre=${customer.name}, Cuenta creada OK`);
        createdCount++;
        
      } catch (error) {
        console.error(`[${new Date().toISOString()}] -> Check Client Access Process -> Error creando usuario para ${customer.name} (RUT: ${customer.rut}):`, error.message);
        errorCount++;
      }
    }
    
    // 6. Resumen final
    console.log(`[${new Date().toISOString()}] -> Check Client Access Process -> RESUMEN DEL PROCESAMIENTO:`);
    console.log(`   • Clientes procesados: ${customers.length}`);
    console.log(`   • Usuarios existentes: ${existingRuts.length}`);
    console.log(`   • Nuevos usuarios creados: ${createdCount}`);
    console.log(`   • Errores: ${errorCount}`);
    
    if (createdCount > 0) {
      console.log(`[${new Date().toISOString()}] -> Check Client Access Process -> Los nuevos usuarios pueden acceder con:`);
      console.log(`   • Email: Su RUT`);
      console.log(`   • Contraseña: ${defaultPassword}`);
      console.log(`   • Deben cambiar su contraseña en el primer acceso`);
    }
    
  } catch (error) {
    console.error(`[${new Date().toISOString()}] -> Check Client Access Process -> Error en checkClientAccess:`, error.message);
    throw error;
  }
}

module.exports = {
  checkClientAccess
}; 