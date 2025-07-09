// config/db.js
require('dotenv').config();
const logger = require('../utils/logger');
const mysql = require('mysql2/promise');

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
      console.log(`Intentando conectar a MySQL (Intento ${attempt + 1} de ${retries})...`);
      const connection = await mysql.createConnection(dbConfig);

      await connection.ping();
      await connection.end();

      logger.info('Conexión a MySQL exitosa');
      return mysql.createPool(dbConfig);
    } catch (err) {
      logger.error(`Error conectando a MySQL: ${err.message}`);
      attempt++;
      if (attempt < retries) {
        console.log(`Reintentando en ${delayMs / 1000} segundos...`);
        await new Promise(res => setTimeout(res, delayMs));
      } else {
        console.error('❌ No se pudo conectar a MySQL después de múltiples intentos.');
        process.exit(1);
      }
    }
  }
}

// Exportamos el poolPromise cuando la conexión esté lista
const poolPromise = connectWithRetry();

module.exports = { poolPromise };
