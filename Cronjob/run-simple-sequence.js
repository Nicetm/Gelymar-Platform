#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const dotenv = require('dotenv');
const os = require('os');
const fs = require('fs');

// Detectar entorno y cargar variables automáticamente
const networkInterfaces = os.networkInterfaces();
const isServer = Object.values(networkInterfaces)
  .flat()
  .some(iface => iface && iface.address === '172.20.10.151');

// Cargar archivo de configuración según entorno
const envFile = isServer ? './env.server' : './env.local';
if (fs.existsSync(envFile)) {
  dotenv.config({ path: envFile });
} else {
  dotenv.config(); // Fallback a .env si existe
}

async function runSimpleSequence() {
  console.log('Ejecutando Cron Master...');
  
  try {
    const scriptPath = path.join(__dirname, 'cron', 'cronMaster.js');
    const result = await runScript(scriptPath, ['execute-now']);
    
    if (result.success) {
      console.log('Cron Master ejecutado exitosamente');
    } else {
      console.log('Cron Master ejecutado con warnings');
    }
    
  } catch (error) {
    console.error('Error ejecutando Cron Master:', error.message);
  }
}

function runScript(scriptPath, args = []) {
  return new Promise((resolve) => {
    const child = spawn('node', [scriptPath, ...args], {
      stdio: 'pipe',
      cwd: __dirname
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
      process.stdout.write(data);
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
      process.stderr.write(data);
    });

    child.on('close', (code) => {
      resolve({
        success: code === 0,
        stdout,
        stderr,
        code
      });
    });

    child.on('error', (error) => {
      resolve({
        success: false,
        error: error.message,
        stdout,
        stderr
      });
    });
  });
}

// Ejecutar
runSimpleSequence().catch(console.error); 