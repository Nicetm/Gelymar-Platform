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

function mountIfNeeded() {
  const platform = os.platform();
  if (platform === 'win32') {
    const filePath = `Z:\\${FILE_NAME}`;
    
    // Solo verificar si existe, no intentar montar
    try {
      if (fs.existsSync(filePath)) {
        console.log('Unidad Z: ya está montada y accesible');
        return filePath;
      } else {
        console.log('Archivo no encontrado en Z:, pero la unidad puede estar montada');
        return filePath;
      }
    } catch (err) {
      console.log('Error accediendo a Z:, pero continuando...');
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
      } catch (err) {
        console.error('Error montando red en Linux:', err.message);
        return null;
      }
    }
    return filePath;
  }
}

async function fetchItemFilesFromNetwork() {
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
        
        // Debug: mostrar los primeros 3 registros
        if (procesados <= 3) {
          console.log(`Registro ${procesados}:`, JSON.stringify(record, null, 2));
        }
        
        // Extraer código del item
        const itemCode = record.Item?.trim();
        if (!itemCode) {
          console.log(`Registro ${procesados} omitido: sin código de item`);
          continue;
        }

        // Verificar si el item ya existe
        if (existingItemCodes.includes(itemCode)) {
          if (procesados <= 10) { // Solo mostrar los primeros 10 omitidos
            console.log(`Item ya existe: ${itemCode}`);
          }
          omitidos++;
          continue;
        }

        // Extraer campos del registro
        const itemData = {
          item_code: itemCode,
          item_name: record.Descripcion_1?.trim() || '',
          item_name_extra: record.Descripcion_2?.trim() || '',
          unidad_medida: record.Unidad_medida?.trim() || ''
        };

        if (procesados <= 3) {
          console.log(`Datos de item a insertar:`, JSON.stringify(itemData, null, 2));
          console.log(`Campo Unidad_medida del archivo: "${record.Unidad_medida}"`);
          console.log(`Campo unidad_medida procesado: "${itemData.unidad_medida}"`);
        }

        // Insertar el item
        await insertItem(itemData);
        
        if (procesados <= 10) { // Solo mostrar los primeros 10 éxitos
          console.log(`Item insertado: ${itemData.item_code} - ${itemData.item_name}`);
        }
        insertados++;
        
      } catch (err) {
        console.error(`Error procesando registro ${procesados}:`, err.message);
        errores++;
      }
    }

    console.log(`Proceso completado:`);
    console.log(`- Registros procesados: ${procesados}`);
    console.log(`- Items insertados: ${insertados}`);
    console.log(`- Items omitidos (ya existían): ${omitidos}`);
    console.log(`- Errores: ${errores}`);
    
  } catch (err) {
    console.error('Error al procesar archivo:', err.message);
  }
}

module.exports = { fetchItemFilesFromNetwork }; 