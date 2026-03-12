// config/db.js
// Las variables de entorno ya se cargan automáticamente en app.js
const { logger } = require('../utils/logger');
const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.MYSQL_DB_HOST,
  user: process.env.MYSQL_DB_USER,
  password: process.env.MYSQL_DB_PASS,
  database: process.env.MYSQL_DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Función de conexión con reintentos
async function connectWithRetry(retries = 5, delayMs = 5000) {
  let attempt = 0;
  while (attempt < retries) {
    try {
      const connection = await mysql.createConnection(dbConfig);

      await connection.ping();
      await connection.end();

      return mysql.createPool(dbConfig);
    } catch (err) {
      logger.error(`Error conectando a MySQL: ${err.message}`);
      attempt++;
        if (attempt < retries) {
          await new Promise(res => setTimeout(res, delayMs));
        } else {
          process.exit(1);
        }
    }
  }
}

// Exportamos el poolPromise cuando la conexión esté lista
const poolPromise = connectWithRetry();

module.exports = { poolPromise };
