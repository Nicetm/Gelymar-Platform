const axios = require('axios');
const dotenv = require('dotenv');
const os = require('os');
const fs = require('fs');

// Detectar entorno y cargar variables automáticamente
const networkInterfaces = os.networkInterfaces();
const isServer = Object.values(networkInterfaces)
  .flat()
  .some(iface => iface && iface.address === '172.20.10.151');

// Cargar archivo de configuración según entorno
const envFile = isServer ? '../env.server' : '../env.local';

if (fs.existsSync(envFile)) {
  dotenv.config({ path: envFile });
} else {
  dotenv.config(); // Fallback a .env si existe
}

// Configuración de la API del backend
let BACKEND_API_URL = process.env.BACKEND_API_URL || 'http://localhost:3000';

// Si estamos en Docker y no se cargó la configuración, forzar la URL correcta
if (isServer && BACKEND_API_URL === 'http://localhost:3000') {
  BACKEND_API_URL = 'http://backend:3000';
}

// Verificación adicional: si detectamos que estamos en un contenedor Docker
if (process.env.DOCKER_ENV === 'true' || fs.existsSync('/.dockerenv')) {
  BACKEND_API_URL = 'http://backend:3000';
}

async function checkETD() {
  try {
    const response = await axios.post(`${BACKEND_API_URL}/api/cron/check-etd`);
  } catch (error) {
    console.error('Error en verificación de ETD:', error.message);
  }
}

// Función principal
async function main() {
  try {
    await checkETD();
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error en verificación de ETD:`, error);
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  main();
}

module.exports = { checkETD };
