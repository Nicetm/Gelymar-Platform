const axios = require('axios');
const dotenv = require('dotenv');
const os = require('os');
const fs = require('fs');

// Detectar entorno y cargar variables automáticamente
const networkInterfaces = os.networkInterfaces();
const isServer = Object.values(networkInterfaces)
  .flat()
  .some(iface => iface && iface.address === '172.20.10.151');

console.log(`🔧 [ETD Checker] Detección de entorno:`);
console.log(`🔧 [ETD Checker] - isServer: ${isServer}`);

// Cargar archivo de configuración según entorno
const envFile = isServer ? '../env.server' : '../env.local';
console.log(`🔧 [ETD Checker] Intentando cargar archivo: ${envFile}`);

if (fs.existsSync(envFile)) {
  dotenv.config({ path: envFile });
  console.log(`🔧 [ETD Checker] Entorno detectado: ${isServer ? 'Servidor Ubuntu (172.20.10.151)' : 'Desarrollo local'}`);
} else {
  console.log(`⚠️ [ETD Checker] Archivo de configuración no encontrado: ${envFile}`);
  dotenv.config(); // Fallback a .env si existe
}

// Configuración de la API del backend
let BACKEND_API_URL = process.env.BACKEND_API_URL || 'http://localhost:3000';

// Si estamos en Docker y no se cargó la configuración, forzar la URL correcta
if (isServer && BACKEND_API_URL === 'http://localhost:3000') {
  console.log(`⚠️ [ETD Checker] Forzando configuración para Docker...`);
  BACKEND_API_URL = 'http://backend:3000';
}

// Verificación adicional: si detectamos que estamos en un contenedor Docker
if (process.env.DOCKER_ENV === 'true' || fs.existsSync('/.dockerenv')) {
  console.log(`🐳 [ETD Checker] Detectado entorno Docker, usando backend:3000`);
  BACKEND_API_URL = 'http://backend:3000';
}

console.log(`🔧 [ETD Checker] BACKEND_API_URL configurado: ${BACKEND_API_URL}`);

async function checkETD() {
  try {
    console.log('Llamando al endpoint de verificación de ETD...');
    const response = await axios.post(`${BACKEND_API_URL}/api/cron/check-etd`);
    console.log('Verificación de ETD completada');
  } catch (error) {
    console.error('Error en verificación de ETD:', error.message);
  }
}

// Función principal
async function main() {
  console.log(`[${new Date().toISOString()}] Iniciando verificación de ETD...`);
  
  try {
    console.log('Llamando al endpoint de verificación de ETD...');
    await checkETD();
    console.log(`[${new Date().toISOString()}] Verificación de ETD completada.`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error en verificación de ETD:`, error);
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  main();
}

module.exports = { checkETD };
