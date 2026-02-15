const sql = require('mssql');

const config = {
  user: process.env.SQL_USER || 'your_user',
  password: process.env.SQL_PASS || 'your_password',
  server: process.env.SQL_HOST || 'your_sql_host',
  port: Number(process.env.SQL_PORT || 1433),
  database: process.env.SQL_DB || 'your_database',
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
  pool: {
    max: 5,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

async function testSqlConnection() {
  try {
    console.log('[SQL] Connecting to:', {
      server: config.server,
      port: config.port,
      database: config.database,
      user: config.user,
    });

    const pool = await sql.connect(config);
    const result = await pool.request().query('SELECT 1 AS ok');
    console.log('[SQL] Connection OK:', result.recordset);
    await pool.close();
    process.exit(0);
  } catch (error) {
    console.error('[SQL] Connection error:', error.message);
    process.exit(1);
  }
}

testSqlConnection();
