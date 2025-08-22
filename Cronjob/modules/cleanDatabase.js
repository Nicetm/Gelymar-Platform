const axios = require('axios');

// Configuración de la API del backend
const BACKEND_API_URL = process.env.BACKEND_API_URL || 'http://localhost:3000';

// Función para emitir señal de ready a PM2
const emitReady = () => {
  if (process.send) {
    process.send('ready');
  }
};

// Función principal de limpieza
async function performCleanup() {
  try {
    console.log('=== INICIANDO LIMPIEZA DE BASE DE DATOS Y DIRECTORIOS ===');
    console.log('Fecha y hora:', new Date().toISOString());
    
    console.log('Llamando al endpoint de limpieza de base de datos...');
    const response = await axios.post(`${BACKEND_API_URL}/api/cron/clean-database`);
    console.log('Limpieza completada:', response.data.message);
    
    console.log('=== LIMPIEZA COMPLETADA ===');
    
  } catch (error) {
    console.error('Error en proceso de limpieza:', error.response?.data?.error || error.message);
  }
}

// Ejecutar limpieza inmediatamente al iniciar (solo ejecución manual)
performCleanup().then(() => {
  console.log('Procesamiento de limpieza completado');
  emitReady();
  // Salir después de completar la limpieza
  process.exit(0);
}).catch((error) => {
  console.error('Error en proceso de limpieza:', error);
  emitReady();
  process.exit(1);
});

console.log('Script de limpieza iniciado - Ejecución manual únicamente');
console.log('El script se ejecutará una vez y luego terminará'); 