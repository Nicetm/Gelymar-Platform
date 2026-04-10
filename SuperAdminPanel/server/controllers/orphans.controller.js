const { getPool, getEnvConfig, getCurrentEnv, getConfig } = require('../config/database');
const path = require('path');

/**
 * Obtiene el token del fileserver del backend principal.
 * Usa las credenciales del fileserver configuradas en el SuperAdminPanel.
 */
async function getFileserverToken(backendUrl) {
  const config = getConfig();
  const user = config.fileserverUser || process.env.FILESERVER_USER || 'admin';
  const pass = config.fileserverPass || process.env.FILESERVER_PASS || '';

  const res = await fetch(`${backendUrl}/api/fileserver/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: user, password: pass })
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'Error autenticando con fileserver');
  }

  const data = await res.json();
  return data.token;
}

/**
 * Obtiene la URL del backend principal según el ambiente activo.
 */
function getBackendUrl() {
  const env = getCurrentEnv();
  const envCfg = getEnvConfig(env);
  if (envCfg?.backendUrl && envCfg.backendUrl.trim()) {
    return envCfg.backendUrl.trim();
  }
  return process.env.BACKEND_URL || 'http://localhost:3000';
}

/**
 * Lista recursivamente todos los archivos del fileserver vía la API del backend.
 */
async function listFilesViaAPI(backendUrl, token, dirPath = '') {
  const results = [];

  const url = dirPath
    ? `${backendUrl}/api/fileserver/files?path=${encodeURIComponent(dirPath)}`
    : `${backendUrl}/api/fileserver/files`;

  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!res.ok) return results;

  const data = await res.json();
  const files = data.files || [];

  for (const file of files) {
    if (file.isDirectory) {
      const subFiles = await listFilesViaAPI(backendUrl, token, file.path);
      results.push(...subFiles);
    } else {
      results.push({
        relative: `uploads/${file.path}`,
        size: file.size,
        name: file.name
      });
    }
  }

  return results;
}

/**
 * Lista directorios del fileserver vía la API del backend (solo primer nivel).
 */
async function listDirectoriesViaAPI(backendUrl, token, dirPath = '') {
  const url = dirPath
    ? `${backendUrl}/api/fileserver/files?path=${encodeURIComponent(dirPath)}`
    : `${backendUrl}/api/fileserver/files`;

  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!res.ok) return [];

  const data = await res.json();
  return (data.files || []).filter(f => f.isDirectory);
}

/**
 * Escanea archivos huérfanos: archivos en disco que no tienen registro en BD.
 */
exports.scan = async (req, res) => {
  try {
    const pool = getPool();
    if (!pool) return res.status(500).json({ message: 'BD no conectada' });

    const backendUrl = getBackendUrl();
    const token = await getFileserverToken(backendUrl);

    const [dbRows] = await pool.query('SELECT DISTINCT path FROM order_files WHERE path IS NOT NULL');
    const dbPaths = new Set(dbRows.map(r => r.path));

    const files = await listFilesViaAPI(backendUrl, token);
    const orphans = files.filter(f => !dbPaths.has(f.relative));

    res.json(orphans.map(f => ({ path: f.relative, size: f.size })));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Elimina archivos del fileserver vía la API del backend.
 */
exports.deleteFiles = async (req, res) => {
  const { paths } = req.body;
  if (!paths || !paths.length) return res.status(400).json({ message: 'Sin archivos para eliminar' });

  const backendUrl = getBackendUrl();
  let token;
  try {
    token = await getFileserverToken(backendUrl);
  } catch (err) {
    return res.status(500).json({ message: 'Error autenticando: ' + err.message });
  }

  const results = [];
  for (const filePath of paths) {
    try {
      // Extraer directorio y nombre del path relativo
      const relativePath = filePath.replace(/^uploads\//, '');
      const dirName = path.dirname(relativePath);
      const fileName = path.basename(relativePath);

      const deleteRes = await fetch(`${backendUrl}/api/fileserver/delete`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ path: dirName, name: fileName })
      });

      results.push({ path: filePath, deleted: deleteRes.ok });
    } catch (err) {
      results.push({ path: filePath, deleted: false, error: err.message });
    }
  }
  res.json(results);
};

/**
 * Resumen: total archivos en disco, registros en BD, huérfanos.
 */
exports.summary = async (req, res) => {
  try {
    const pool = getPool();
    if (!pool) return res.status(500).json({ message: 'BD no conectada' });

    const backendUrl = getBackendUrl();
    let token;
    try {
      token = await getFileserverToken(backendUrl);
    } catch (err) {
      // Si no puede conectar al fileserver, retornar solo datos de BD
      const [dbRows] = await pool.query('SELECT COUNT(DISTINCT path) AS cnt FROM order_files WHERE path IS NOT NULL');
      return res.json({ totalFiles: 0, totalRecords: dbRows[0]?.cnt || 0, orphans: 0, spaceBytes: 0, fileserverError: err.message });
    }

    const [dbRows] = await pool.query('SELECT DISTINCT path FROM order_files WHERE path IS NOT NULL');
    const dbPaths = new Set(dbRows.map(r => r.path));

    const files = await listFilesViaAPI(backendUrl, token);
    const orphans = files.filter(f => !dbPaths.has(f.relative));
    const spaceBytes = orphans.reduce((sum, f) => sum + (f.size || 0), 0);

    res.json({ totalFiles: files.length, totalRecords: dbPaths.size, orphans: orphans.length, spaceBytes });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Escanea directorios vacíos en el fileserver.
 */
exports.scanEmptyDirs = async (req, res) => {
  try {
    const backendUrl = getBackendUrl();
    const token = await getFileserverToken(backendUrl);

    const emptyDirs = [];

    // Listar clientes (primer nivel)
    const clients = await listDirectoriesViaAPI(backendUrl, token);

    for (const client of clients) {
      // Listar carpetas de órdenes dentro de cada cliente
      const orderDirs = await listDirectoriesViaAPI(backendUrl, token, client.path);

      for (const orderDir of orderDirs) {
        // Listar contenido de cada carpeta de orden
        const url = `${backendUrl}/api/fileserver/files?path=${encodeURIComponent(orderDir.path)}`;
        const contentRes = await fetch(url, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (contentRes.ok) {
          const contentData = await contentRes.json();
          const contents = contentData.files || [];
          if (contents.length === 0) {
            emptyDirs.push({
              path: `uploads/${orderDir.path}`,
              client: client.name,
              directory: orderDir.name
            });
          }
        }
      }

      // También verificar si el directorio del cliente está vacío
      if (orderDirs.length === 0) {
        emptyDirs.push({
          path: `uploads/${client.path}`,
          client: client.name,
          directory: '(directorio raíz vacío)'
        });
      }
    }

    res.json(emptyDirs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Elimina directorios vacíos del fileserver.
 */
exports.deleteEmptyDirs = async (req, res) => {
  const { paths } = req.body;
  if (!paths || !paths.length) return res.status(400).json({ message: 'Sin directorios para eliminar' });

  const backendUrl = getBackendUrl();
  let token;
  try {
    token = await getFileserverToken(backendUrl);
  } catch (err) {
    return res.status(500).json({ message: 'Error autenticando: ' + err.message });
  }

  const results = [];
  for (const dirPath of paths) {
    try {
      const relativePath = dirPath.replace(/^uploads\//, '');
      const parentDir = path.dirname(relativePath);
      const dirName = path.basename(relativePath);

      const deleteRes = await fetch(`${backendUrl}/api/fileserver/delete`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ path: parentDir, name: dirName })
      });

      results.push({ path: dirPath, deleted: deleteRes.ok });
    } catch (err) {
      results.push({ path: dirPath, deleted: false, error: err.message });
    }
  }
  res.json(results);
};
