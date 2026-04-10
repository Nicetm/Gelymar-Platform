/**
 * Limpieza de archivos huérfanos en el fileserver.
 * Compara el filesystem contra la BD y elimina lo que no tiene registro.
 * 
 * Uso:
 *   node scripts/cleanup-orphan-files.js          # Solo lista (dry-run)
 *   node scripts/cleanup-orphan-files.js --delete  # Elimina los huérfanos
 */

const path = require('path');
const fs = require('fs').promises;
const { poolPromise } = require('../config/db');

const FILE_SERVER_ROOT = process.env.FILE_SERVER_ROOT || '/var/www/html';
const UPLOADS_DIR = path.join(FILE_SERVER_ROOT, 'uploads');
const DRY_RUN = !process.argv.includes('--delete');

async function getDbPaths() {
  const pool = await poolPromise;
  const [rows] = await pool.query('SELECT DISTINCT path FROM order_files WHERE path IS NOT NULL');
  return new Set(rows.map(r => r.path));
}

async function getDbDirectories() {
  const pool = await poolPromise;
  const [rows] = await pool.query(`
    SELECT DISTINCT 
      SUBSTRING_INDEX(path, '/', 2) AS clientDir,
      SUBSTRING_INDEX(path, '/', 3) AS orderDir
    FROM order_files 
    WHERE path IS NOT NULL
  `);
  const dirs = new Set();
  rows.forEach(r => {
    dirs.add(r.clientDir);
    dirs.add(r.orderDir);
  });
  return dirs;
}

async function listFiles(dir) {
  const results = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const children = await listFiles(fullPath);
        results.push(...children);
      } else {
        results.push(fullPath);
      }
    }
  } catch (err) {
    // directorio no accesible
  }
  return results;
}

async function listDirectories(dir) {
  const results = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const fullPath = path.join(dir, entry.name);
        const children = await listDirectories(fullPath);
        results.push(...children);
        results.push(fullPath);
      }
    }
  } catch (err) {
    // directorio no accesible
  }
  return results;
}

async function run() {
  console.log(`\n${DRY_RUN ? '🔍 DRY RUN - Solo listando, no se elimina nada' : '🗑️  DELETE MODE - Se eliminarán archivos huérfanos'}\n`);

  const dbPaths = await getDbPaths();
  const dbDirs = await getDbDirectories();

  console.log(`📊 Registros en BD: ${dbPaths.size}`);

  // Listar todos los archivos en uploads/
  const allFiles = await listFiles(UPLOADS_DIR);
  console.log(`📁 Archivos en fileserver: ${allFiles.length}\n`);

  // Encontrar archivos huérfanos
  const orphanFiles = [];
  for (const filePath of allFiles) {
    const relativePath = path.relative(FILE_SERVER_ROOT, filePath).replace(/\\/g, '/');
    if (!dbPaths.has(relativePath)) {
      orphanFiles.push({ absolute: filePath, relative: relativePath });
    }
  }

  console.log(`🗂️  Archivos huérfanos: ${orphanFiles.length}\n`);

  if (orphanFiles.length > 0) {
    for (const f of orphanFiles) {
      console.log(`  ${DRY_RUN ? '[HUÉRFANO]' : '[ELIMINANDO]'} ${f.relative}`);
      if (!DRY_RUN) {
        try {
          await fs.unlink(f.absolute);
        } catch (err) {
          console.error(`  ❌ Error eliminando ${f.relative}: ${err.message}`);
        }
      }
    }
  }

  // Encontrar directorios vacíos o huérfanos
  if (!DRY_RUN && orphanFiles.length > 0) {
    console.log('\n🧹 Limpiando directorios vacíos...');
    const allDirs = await listDirectories(UPLOADS_DIR);
    // Ordenar de más profundo a menos profundo
    allDirs.sort((a, b) => b.split(path.sep).length - a.split(path.sep).length);
    
    for (const dir of allDirs) {
      try {
        const entries = await fs.readdir(dir);
        if (entries.length === 0) {
          const relDir = path.relative(FILE_SERVER_ROOT, dir).replace(/\\/g, '/');
          console.log(`  [ELIMINANDO DIR] ${relDir}`);
          await fs.rmdir(dir);
        }
      } catch (err) {
        // ignorar
      }
    }
  }

  console.log('\n✅ Listo.');
  process.exit(0);
}

run().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
