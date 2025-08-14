const { cleanDatabaseAndDirectories } = require('../services/cleanDatabase.service');

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
    
    await cleanDatabaseAndDirectories();
    
    console.log('=== LIMPIEZA COMPLETADA ===');
    
  } catch (error) {
    console.error('Error en proceso de limpieza:', error.message);
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