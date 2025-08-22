const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');
const { insertItem, getAllItemCodes } = require('./item.service');

const SERVER = '172.20.10.167';
const SHARE_PATH = 'Users/above/Documents/BotArchivoWeb/archivos';
const FILE_NAME = 'PRODUCTOS_SOFTKEY.txt';
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

async function fetchItemFilesFromNetwork() {
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
      delimiter: ';',
      columns: true,
      skip_empty_lines: true,
      relax_quotes: true,
      relax_column_count: true,
      skip_records_with_error: true
    });

    console.log(`Total de registros parseados: ${records.length}`);
    
    // Mostrar las columnas disponibles en el primer registro
    if (records.length > 0) {
      console.log('Columnas disponibles en el archivo:');
      console.log(Object.keys(records[0]));
      console.log('Primer registro completo:');
      console.log(JSON.stringify(records[0], null, 2));
    }

    // Guardar CSV en disco para verificación
    const output = stringify(records, { header: true, delimiter: ';' });
    fs.ensureDirSync('documentos');
    fs.writeFileSync('documentos/PRODUCTOS_SOFTKEY.csv', output, 'utf8');
    console.log('PRODUCTOS_SOFTKEY.csv generado correctamente.');

    // Obtener códigos de items existentes
    const existingItemCodes = await getAllItemCodes();
    console.log(`Items ya existentes en BD: ${existingItemCodes.length}`);

    let procesados = 0;
    let insertados = 0;
    let omitidos = 0;
    let errores = 0;

    for (const record of records) {
      try {
        procesados++;
        
        const codigo = record.Item?.trim();
        if (!codigo) {
          console.log('Registro omitido sin código:', record);
          omitidos++;
          continue;
        }

        if (existingItemCodes.includes(codigo)) {
          console.log(`Item ya existe: ${codigo}`);
          omitidos++;
          continue;
        }

        await insertItem({
          item_code: codigo,
          item_name: record.Descripcion_1?.trim(),
          item_name_extra: record.Descripcion_2?.trim(),
          unidad_medida: record.Unidad_medida?.trim()
        });

        console.log(`Item insertado: ${codigo}`);
        insertados++;
      } catch (error) {
        console.error(`Error procesando item ${record.Item}:`, error.message);
        errores++;
      }
    }

    console.log(`Procesamiento completado. Procesados: ${procesados}, Insertados: ${insertados}, Omitidos: ${omitidos}, Errores: ${errores}`);
  } catch (error) {
    console.error('Error procesando archivo de items:', error);
  } finally {
    // Siempre desmontar al finalizar
    unmountIfNeeded();
  }
}

module.exports = {
  fetchItemFilesFromNetwork
}; 