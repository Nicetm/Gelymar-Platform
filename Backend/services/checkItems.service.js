const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');
const { insertItem, getAllItemCodes } = require('./item.service');



async function fetchItemFilesFromNetwork() {
  const inputPath = 'Z:\\PRODUCTOS_SOFTKEY.txt';
  console.log('Ruta del archivo:', inputPath);

  if (!fs.existsSync(inputPath)) {
    console.error('Archivo no disponible en Z:\\PRODUCTOS_SOFTKEY.txt');
    console.log('Conéctate manualmente a la red compartida antes de ejecutar el cron');
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
    }

    // Guardar CSV en disco para verificación
    const output = stringify(records, { header: true, delimiter: ';' });
    fs.ensureDirSync('documentos');
    
    // Usar timestamp para evitar conflictos de archivo
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `documentos/PRODUCTOS_SOFTKEY_${timestamp}.csv`;
    
    try {
      fs.writeFileSync(filename, output, 'utf8');
      console.log(`${filename} generado correctamente.`);
    } catch (writeError) {
      console.warn(`No se pudo escribir el archivo CSV: ${writeError.message}`);
      console.log('Continuando con el procesamiento...');
    }

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
  }
}

module.exports = {
  fetchItemFilesFromNetwork
}; 