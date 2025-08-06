require('dotenv').config();
const { generateDefaultFiles } = require('../services/checkDefaultFiles.service');
const cron = require('node-cron');

console.log('Iniciando servicio de generación de documentos por defecto...');

// Función para emitir señal de ready
const emitReady = () => {
  if (process.send) {
    process.send('ready');
  }
};

// Ejecutar inmediatamente al iniciar
generateDefaultFiles().then(() => {
  console.log('Procesamiento inicial de documentos por defecto completado');
  emitReady();
}).catch((error) => {
  console.error('Error en procesamiento inicial de documentos por defecto:', error);
  emitReady();
});

// Ejecutar a las 6:05 AM diariamente
cron.schedule('5 6 * * *', async () => {
  console.log('Ejecutando generación de documentos por defecto programada...');
  await generateDefaultFiles();
  console.log(`[${new Date().toISOString()}] Documentos por defecto generados.`);
}); 