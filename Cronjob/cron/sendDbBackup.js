const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const { spawn } = require('child_process');
const zlib = require('zlib');
let logger;
try {
  ({ logger } = require('../../Backend/utils/logger'));
} catch (error) {
  logger = {
    info: console.log,
    warn: console.warn,
    error: console.error
  };
  logger.warn(`[sendDbBackup] Logger backend no disponible, usando consola. error=${error.message}`);
}

const emitReady = () => {
  if (process.send) {
    process.send('ready');
  }
};

function getBackupDir() {
  if (process.env.DB_BACKUP_DIR) {
    return process.env.DB_BACKUP_DIR;
  }
  return '/var/backups/gelymar';
}

function getBackupFileName(dbName) {
  const stamp = new Date().toISOString().slice(0, 10);
  return `backup_${dbName}_${stamp}.sql.gz`;
}

function removeOldBackups(backupDir, keepFile) {
  if (!fs.existsSync(backupDir)) {
    return;
  }
  const files = fs.readdirSync(backupDir);
  files.forEach((file) => {
    if (file.endsWith('.sql.gz') && file != keepFile) {
      try {
        fs.unlinkSync(path.join(backupDir, file));
      } catch (error) {
        logger.error(`[sendDbBackup] Error removing old backup ${file}: ${error.message}`);
      }
    }
  });
}

async function runBackup() {
  const dbHost = process.env.MYSQL_DB_HOST;
  const dbUser = process.env.MYSQL_DB_USER;
  const dbPass = process.env.MYSQL_DB_PASS;
  const dbName = process.env.MYSQL_DB_NAME;

  if (!dbHost || !dbUser || !dbPass || !dbName) {
    throw new Error('Missing MYSQL_DB_HOST/MYSQL_DB_USER/MYSQL_DB_PASS/MYSQL_DB_NAME env vars');
  }

  const backupDir = getBackupDir();
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const fileName = getBackupFileName(dbName);
  const filePath = path.join(backupDir, fileName);

  removeOldBackups(backupDir, fileName);

  const args = [
    '-h', dbHost,
    '-u', dbUser,
    '--databases', dbName,
    '--single-transaction',
    '--quick',
    '--lock-tables=false'
  ];

  logger.info(`[sendDbBackup] Starting backup: ${filePath}`);

  const dump = spawn('mysqldump', args, {
    env: { ...process.env, MYSQL_PWD: dbPass }
  });

  const gzip = zlib.createGzip();
  const output = fs.createWriteStream(filePath);

  dump.stdout.pipe(gzip).pipe(output);

  let stderr = '';
  dump.stderr.on('data', (data) => {
    stderr += data.toString();
  });

  return new Promise((resolve, reject) => {
    dump.on('error', (error) => {
      reject(error);
    });

    output.on('finish', () => {
      resolve(filePath);
    });

    dump.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`mysqldump failed (code ${code}): ${stderr.trim()}`));
      }
    });
  });
}

async function executeWithErrorHandling() {
  try {
    const filePath = await runBackup();
    logger.info(`[sendDbBackup] Backup completed: ${filePath}`);
  } catch (error) {
    logger.error(`[sendDbBackup] Error: ${error.message}`);
  } finally {
    emitReady();
  }
}

const arg = process.argv[2];

if (arg === 'execute-now') {
  executeWithErrorHandling();
} else {
  emitReady();
}

cron.schedule('0 2 * * *', async () => {
  try {
    await runBackup();
  } catch (error) {
    logger.error(`[sendDbBackup] Error: ${error.message}`);
  }
});
