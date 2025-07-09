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

function mountIfNeeded() {
  const platform = os.platform();
  if (platform === 'win32') {
    const filePath = `Z:\\${FILE_NAME}`;
    if (!fs.existsSync(filePath)) {
      try {
        execSync(`net use Z: \\\\${SERVER}\\${SHARE_PATH} /user:${USER} ${PASSWORD} /persistent:no`, { stdio: 'ignore' });
      } catch (err) {
        console.error('Error montando red en Windows:', err.message);
        return null;
      }
    }
    return filePath;
  } else {
    const mountPoint = '/mnt/red';
    const filePath = path.join(mountPoint, FILE_NAME);
    if (!fs.existsSync(filePath)) {
      try {
        execSync(`mkdir -p ${mountPoint}`);
        const mountCmd = `mount -t cifs //${SERVER}/${SHARE_PATH} ${mountPoint} -o username=${USER},password='${PASSWORD}',iocharset=utf8,vers=1.0`;
        execSync(mountCmd);
      } catch (err) {
        console.error('Error montando red en Linux:', err.message);
        return null;
      }
    }
    return filePath;
  }
}

async function fetchClientFilesFromNetwork() {
    const inputPath = mountIfNeeded();
    console.log('Ruta del archivo montado:', inputPath);
  
    if (!inputPath || !fs.existsSync(inputPath)) {
      console.error('Archivo no disponible o no montado:', inputPath);
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
  
      console.log(`Proceso completado. Clientes nuevos insertados: ${nuevos}`);
    } catch (err) {
      console.error('Error al procesar archivo:', err.message);
    }
  }
  

module.exports = { fetchClientFilesFromNetwork };
