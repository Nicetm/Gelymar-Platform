const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');
const { getAllCustomerRuts, insertCustomer } = require('./customer.service');

const SERVER = '172.20.10.167';
const SHARE_PATH = 'Users/above/Documents/BotArchivoWeb/archivos';
const FILE_NAME = 'CLIENTES.txt';
const USER = 'softkey';
const PASSWORD = 'sK06.2025#';

let isMounted = false;

function mountIfNeeded() {
  const platform = os.platform();
  if (platform === 'win32') {
    const filePath = `Z:\\${FILE_NAME}`;
    
    // Verificar si la unidad Z: ya está montada y el archivo existe
    if (fs.existsSync(filePath)) {
      console.log('Unidad Z: ya está montada y accesible');
      return filePath;
    }
    
    // Si el archivo no existe, intentar montar la red compartida
    console.log('Unidad Z: no está montada o archivo no encontrado, intentando montar...');
    try {
      const mountCmd = `net use Z: \\\\${SERVER}\\${SHARE_PATH} /user:${USER} ${PASSWORD}`;
      execSync(mountCmd, { stdio: 'pipe' });
      isMounted = true;
      console.log('Red compartida montada correctamente en Windows');
      
      // Verificar si ahora existe el archivo
      if (fs.existsSync(filePath)) {
        console.log('Archivo encontrado después del montaje');
        return filePath;
      } else {
        console.log('Archivo no encontrado después del montaje');
        return filePath;
      }
    } catch (mountErr) {
      console.error('Error montando red en Windows:', mountErr.message);
      return filePath;
    }
  } else {
    const mountPoint = '/mnt/red';
    const filePath = path.join(mountPoint, FILE_NAME);
    if (!fs.existsSync(filePath)) {
      try {
        execSync(`mkdir -p ${mountPoint}`);
        const mountCmd = `mount -t cifs //${SERVER}/${SHARE_PATH} ${mountPoint} -o username=${USER},password='${PASSWORD}',iocharset=utf8,vers=1.0`;
        execSync(mountCmd);
        isMounted = true;
        console.log('Red compartida montada correctamente');
      } catch (err) {
        console.error('Error montando red en Linux:', err.message);
        return null;
      }
    } else {
      console.log('Red compartida ya está montada');
    }
    return filePath;
  }
}

function unmountIfNeeded() {
  const platform = os.platform();
  if (platform === 'win32') {
    if (isMounted) {
      try {
        execSync('net use Z: /delete', { stdio: 'pipe' });
        console.log('Red compartida desmontada correctamente en Windows');
        isMounted = false;
      } catch (err) {
        console.error('Error desmontando red en Windows:', err.message);
      }
    } else {
      console.log('Red compartida no estaba montada por este proceso en Windows');
    }
  } else {
    if (isMounted) {
      try {
        const mountPoint = '/mnt/red';
        execSync(`umount ${mountPoint}`);
        console.log('Red compartida desmontada correctamente');
        isMounted = false;
      } catch (err) {
        console.error('Error desmontando red en Linux:', err.message);
      }
    } else {
      console.log('Red compartida no estaba montada por este proceso');
    }
  }
}

async function fetchClientFilesFromNetwork() {
    const inputPath = mountIfNeeded();
    console.log('Ruta del archivo montado:', inputPath);
  
    if (!inputPath || !fs.existsSync(inputPath)) {
      console.error('Archivo no disponible o no montado:', inputPath);
      unmountIfNeeded();
      return;
    }
  
    try {
      const content = fs.readFileSync(inputPath, 'latin1');
      console.log('Contenido leído (primeras líneas):');
      console.log(content.split('\n').slice(0, 3).join('\n'));
  
      const records = parse(content, {
        delimiter: '\t',
        columns: true,
        skip_empty_lines: true,
        relax_quotes: true
      });
  
      console.log(`Total de registros parseados: ${records.length}`);
  
      // Guardar CSV en disco
      const output = stringify(records, { header: true, delimiter: ';' });
      fs.ensureDirSync('documentos');
      fs.writeFileSync('documentos/CLIENTES.csv', output, 'utf8');
      console.log('CLIENTES.csv generado correctamente.');
  
      // Leer RUTs existentes en la BD
      const existingRuts = await getAllCustomerRuts();
      console.log(`RUTs ya existentes en BD: ${existingRuts.length}`);
  
      let nuevos = 0;
  
      for (const r of records) {
        const rut = r.Rut?.trim();
        if (!rut) {
          console.log('Registro omitido sin RUT:', r);
          continue;
        }
        if (existingRuts.includes(rut)) {
          console.log(`Cliente ya existe: ${rut}`);
          continue;
        }
  
        await insertCustomer({
          rut,
          name: r.Nombre?.trim(),
          address: r.Direccion?.trim(),
          address_alt: r.Direccion2?.trim(),
          city: r.Ciudad?.trim(),
          country: r.Pais?.trim(),
          contact_name: r.Contacto?.trim(),
          contact_secondary: r.Contacto2?.trim(),
          fax: r.Fax?.trim(),
          phone: r.Telefono?.trim()
        });
  
        console.log(`Cliente insertado: ${rut}`);
        nuevos++;
      }
  
      console.log(`Procesamiento completado. Nuevos clientes: ${nuevos}`);
    } catch (error) {
      console.error('Error procesando archivo de clientes:', error);
    } finally {
      // Siempre desmontar al finalizar
      unmountIfNeeded();
    }
}

module.exports = {
  fetchClientFilesFromNetwork
};
