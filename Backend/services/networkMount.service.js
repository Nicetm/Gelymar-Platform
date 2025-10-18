const fs = require('fs-extra');
const os = require('os');
const { execSync } = require('child_process');

let isNetworkMounted = false;
let mountPath = null;

/**
 * Monta la unidad de red compartida
 * @returns {string} Ruta del montaje
 */
async function mountNetworkShare() {
  if (isNetworkMounted && mountPath) {
    return mountPath;
  }

  // Construir ruta usando variables de entorno
  const networkServer = process.env.NETWORK_SERVER || '172.20.10.167';
  const sharePath = process.env.NETWORK_SHARE_PATH || 'Users/above/Documents/BotArchivoWeb/archivos';
  const networkUser = process.env.NETWORK_USER || 'softkey';
  const networkPassword = process.env.NETWORK_PASSWORD || 'sK06.2025$#';
  
  // Detectar sistema operativo
  const isWindows = os.platform() === 'win32';
  const isDocker = process.env.DOCKER_ENV === 'true';
  
  let inputPath;
  
  if (isDocker) {
    // En Docker, montar la red compartida directamente
    inputPath = '/mnt/archivos';
    
    // Crear directorio si no existe
    if (!fs.existsSync(inputPath)) {
      fs.mkdirSync(inputPath, { recursive: true });
    }
    
    // Montar la red compartida
    try {
      // Crear archivo temporal de credenciales para evitar problemas con caracteres especiales
      const credentialsFile = '/tmp/cifs_credentials';
      const credentialsContent = `username=${networkUser}\npassword=${networkPassword}\n`;
      
      fs.writeFileSync(credentialsFile, credentialsContent, { mode: 0o600 });

      const mountCommand = `mount -t cifs //${networkServer}/${sharePath} ${inputPath} -o credentials=${credentialsFile},uid=1000,gid=1000,iocharset=utf8`;
      execSync(mountCommand, { stdio: 'inherit' });
      
      // Limpiar archivo de credenciales
      fs.unlinkSync(credentialsFile);
    } catch (error) {
      console.error('❌ Error montando red compartida:', error.message);
      // Intentar limpiar archivo de credenciales si existe
      try {
        if (fs.existsSync('/tmp/cifs_credentials')) {
          fs.unlinkSync('/tmp/cifs_credentials');
        }
      } catch (cleanupError) {
        console.warn('⚠️ No se pudo limpiar archivo de credenciales:', cleanupError.message);
      }
      throw new Error(`No se pudo montar la red compartida: ${error.message}`);
    }
  } else if (isWindows) {
    // En Windows, intentar mapear la unidad Z: si no existe
    inputPath = 'Z:\\';
    if (!fs.existsSync('Z:\\')) {
      try {
        execSync(`net use Z: \\\\${networkServer}\\${sharePath} /user:${networkUser} "${networkPassword}"`, { stdio: 'inherit' });
      } catch (error) {
        console.error('❌ Error mapeando red compartida:', error.message);
        throw new Error(`No se pudo mapear la red compartida: ${error.message}`);
      }
    }
  } else {
    // En Linux, usar path absoluto
    inputPath = `/mnt/${networkServer}/${sharePath}`;
  }
  
  // Verificar que el path existe
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Path de red no disponible: ${inputPath}`);
  }
  
  isNetworkMounted = true;
  mountPath = inputPath;
  
  return inputPath;
}

/**
 * Obtiene la ruta completa de un archivo en la red
 * @param {string} filename - Nombre del archivo
 * @returns {string} Ruta completa del archivo
 */
async function getNetworkFilePath(filename) {
  const basePath = await mountNetworkShare();
  const fullPath = os.platform() === 'win32' ? `${basePath}${filename}` : `${basePath}/${filename}`;
  
  // Verificar que el archivo existe
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Archivo no encontrado: ${fullPath}`);
  }
  
  return fullPath;
}

/**
 * Verifica si la red está montada
 * @returns {boolean}
 */
function isNetworkAvailable() {
  return isNetworkMounted && mountPath && fs.existsSync(mountPath);
}

/**
 * Desmonta la red
 */
function unmountNetwork() {
  if (isNetworkMounted && mountPath) {
    try {
      if (os.platform() === 'win32') {
        execSync('net use Z: /delete', { stdio: 'inherit' });
      } else if (process.env.DOCKER_ENV === 'true') {
        execSync(`umount ${mountPath}`, { stdio: 'inherit' });
      }
    } catch (error) {
      console.error('❌ Error desmontando red:', error.message);
    }
  }
  isNetworkMounted = false;
  mountPath = null;
}

module.exports = {
  mountNetworkShare,
  getNetworkFilePath,
  isNetworkAvailable,
  unmountNetwork
};
