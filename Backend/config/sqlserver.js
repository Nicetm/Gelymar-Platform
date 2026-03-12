const sql = require('mssql');
const { logger } = require('../utils/logger');

const sqlConfig = {
  user: process.env.SQL_USER,
  password: process.env.SQL_PASS,
  server: process.env.SQL_HOST,
  port: Number(process.env.SQL_PORT),
  database: process.env.SQL_DB,
  requestTimeout: Number(process.env.SQL_REQUEST_TIMEOUT || 60000),
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

let sqlPoolPromise;

function getSqlPool() {
  if (!sqlPoolPromise) {
    logger.info(
      `[sqlserver] Config -> host=${process.env.SQL_HOST || 'N/A'} port=${process.env.SQL_PORT || 'N/A'} db=${process.env.SQL_DB || 'N/A'} user=${process.env.SQL_USER || 'N/A'} passLen=${process.env.SQL_PASS ? process.env.SQL_PASS.length : 0} requestTimeout=${sqlConfig.requestTimeout}`
    );
    sqlPoolPromise = sql.connect(sqlConfig).catch((error) => {
      logger.error(`Error conectando a SQL Server: ${error.message}`);
      throw error;
    });
  }
  return sqlPoolPromise;
}

module.exports = {
  sql,
  getSqlPool,
};
