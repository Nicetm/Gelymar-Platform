// config/db.js
// Las variables de entorno ya se cargan automáticamente en app.js
const { logger } = require('../utils/logger');
const mysql = require('mysql2/promise');

// Debug: Mostrar configuración de BD (solo en desarrollo)
// if (process.env.NODE_ENV === 'development') {
//   console.log(`[${new Date().toISOString()}] -> Database Config Process -> Configuración de BD:`);
//   console.log(`[${new Date().toISOString()}] -> Database Config Process -> Host: ${process.env.DB_HOST}`);
//   console.log(`[${new Date().toISOString()}] -> Database Config Process -> User: ${process.env.DB_USER}`);
//   console.log(`[${new Date().toISOString()}] -> Database Config Process -> Password: ${process.env.DB_PASS ? '***' : 'NO DEFINIDA'}`);
//   console.log(`[${new Date().toISOString()}] -> Database Config Process -> Database: ${process.env.DB_NAME}`);
// }

const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Función de conexión con reintentos
async function connectWithRetry(retries = 5, delayMs = 5000) {
  let attempt = 0;
  while (attempt < retries) {
    try {
      // if (process.env.NODE_ENV === 'development') {
      //   console.log(`[${new Date().toISOString()}] -> Database Config Process -> Intentando conectar a MySQL (Intento ${attempt + 1} de ${retries})...`);
      // }
      const connection = await mysql.createConnection(dbConfig);

      await connection.ping();
      await connection.end();

      return mysql.createPool(dbConfig);
    } catch (err) {
      logger.error(`Error conectando a MySQL: ${err.message}`);
      attempt++;
              if (attempt < retries) {
          // if (process.env.NODE_ENV === 'development') {
          //   console.log(`[${new Date().toISOString()}] -> Database Config Process -> Reintentando en ${delayMs / 1000} segundos...`);
          // }
          await new Promise(res => setTimeout(res, delayMs));
        } else {
          // console.error(`[${new Date().toISOString()}] -> Database Config Process -> No se pudo conectar a MySQL después de múltiples intentos.`);
          process.exit(1);
        }
    }
  }
}

// Exportamos el poolPromise cuando la conexión esté lista
const poolPromise = connectWithRetry();

module.exports = { poolPromise };
