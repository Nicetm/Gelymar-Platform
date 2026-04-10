const mysql = require('mysql2/promise');
const sql = require('mssql');
const fs = require('fs');
const path = require('path');

let configPath = '';
let config = null;
let currentEnv = 'dev';
let mysqlPool = null;
let sqlPool = null;

const defaultConfig = {
  environments: {
    dev: {
      mysql: { host: '', port: 3306, user: '', password: '', database: '' },
      sqlserver: { host: '', port: 1433, user: '', password: '', database: '' },
      docker: { socketPath: '/var/run/docker.sock' },
      fileserverRoot: '',
      backendUrl: 'http://localhost:3000'
    },
    prod: {
      mysql: { host: '', port: 3306, user: '', password: '', database: '' },
      sqlserver: { host: '', port: 1433, user: '', password: '', database: '' },
      docker: { host: 'tcp://host:2375' },
      fileserverRoot: '',
      backendUrl: ''
    }
  },
  jwtSecret: 'super-admin-panel-secret-change-me',
  backendUrl: 'http://localhost:3000',
  fileserverUser: 'admin',
  fileserverPass: '',
  cronContainerName: 'gelymar-cron',
  defaultLogLines: 200,
  pm2ContainerName: 'gelymar-cron'
};

function loadConfig() {
  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    config = JSON.parse(raw);
  } catch {
    config = { ...defaultConfig };
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  }
  return config;
}

function getConfig() {
  if (!config) loadConfig();
  return config;
}

function saveConfig(newConfig) {
  config = newConfig;
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

function getEnvConfig(env) {
  const c = getConfig();
  return c.environments[env || currentEnv];
}

async function createPools(env) {
  const envCfg = getEnvConfig(env);
  if (!envCfg) return;

  if (envCfg.mysql && envCfg.mysql.host) {
    try {
      mysqlPool = mysql.createPool({
        host: envCfg.mysql.host,
        port: envCfg.mysql.port || 3306,
        user: envCfg.mysql.user,
        password: envCfg.mysql.password,
        database: envCfg.mysql.database,
        waitForConnections: true,
        connectionLimit: 10
      });
    } catch (e) {
      console.error('MySQL pool error:', e.message);
    }
  }

  if (envCfg.sqlserver && envCfg.sqlserver.host) {
    try {
      sqlPool = await sql.connect({
        server: envCfg.sqlserver.host,
        port: envCfg.sqlserver.port || 1433,
        user: envCfg.sqlserver.user,
        password: envCfg.sqlserver.password,
        database: envCfg.sqlserver.database,
        options: { encrypt: false, trustServerCertificate: true },
        pool: { max: 10, min: 0, idleTimeoutMillis: 30000 }
      });
    } catch (e) {
      console.error('SQL Server pool error:', e.message);
    }
  }
}

async function destroyPools() {
  if (mysqlPool) { try { await mysqlPool.end(); } catch {} mysqlPool = null; }
  if (sqlPool) { try { await sqlPool.close(); } catch {} sqlPool = null; }
}

function getPool() { return mysqlPool; }
function getSqlPool() { return sqlPool; }
function getCurrentEnv() { return currentEnv; }

async function switchEnvironment(env) {
  await destroyPools();
  currentEnv = env;
  await createPools(env);
  return currentEnv;
}

function init(userDataPath) {
  configPath = path.join(userDataPath, 'config.json');
  loadConfig();
  // Auto-connect if config has MySQL host
  const envCfg = getEnvConfig(currentEnv);
  if (envCfg?.mysql?.host) {
    createPools(currentEnv).catch(e => console.error('Auto-connect error:', e.message));
  }
}

module.exports = { init, getPool, getSqlPool, switchEnvironment, getCurrentEnv, getConfig, saveConfig, getEnvConfig, createPools, destroyPools };
