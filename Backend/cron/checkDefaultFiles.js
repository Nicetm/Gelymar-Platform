require('dotenv').config();
const { generateDefaultFiles } = require('../services/checkDefaultFiles.service');
const cron = require('node-cron');

console.log('Iniciando servicio de generación de documentos por defecto...');

// Ejecutar inmediatamente al iniciar
generateDefaultFiles().then(() => {
  console.log('Procesamiento inicial completado');
}).catch((error) => {
  console.error('Error en procesamiento inicial:', error);
});

// Ejecutar a las 6:05 AM diariamente
cron.schedule('5 6 * * *', async () => {
  console.log('Ejecutando generación de documentos por defecto programada...');
  await generateDefaultFiles();
  console.log(`[${new Date().toISOString()}] Documentos por defecto generados.`);
}); 