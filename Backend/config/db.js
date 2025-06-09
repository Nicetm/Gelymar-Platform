// db.js

require('dotenv').config();


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

const poolPromise = mysql.createPool(dbConfig)
  .getConnection()
  .then(connection => {
    console.log('Conectado a MySQL');
    console.log('DB_USER:', process.env.DB_USER);
    connection.release(); // libera la conexión de prueba
    return mysql.createPool(dbConfig); // retorna el pool
  })
  .catch(err => {
    console.error('Error de conexión a MySQL:', err);
    process.exit(1);
  });

module.exports = { poolPromise };
