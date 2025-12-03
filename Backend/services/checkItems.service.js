const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');
const {
  insertItem,
  getAllItemCodes,
  getItemByUniqueKey,
  compareItemFields,
  updateItem,
  getItemByCode
} = require('./item.service');
const { getNetworkFilePath } = require('./networkMount.service');

async function fetchItemFilesFromNetwork() {
  try {
    // Usar el servicio centralizado para obtener la ruta del archivo
    const inputPath = await getNetworkFilePath('PRODUCTOS_SOFTKEY.txt');
    console.log('Ruta del archivo:', inputPath);
    
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

    let procesados = 0;
    let insertados = 0;
    let omitidos = 0;
    let errores = 0;
    const processedKeys = new Set();

    // Procesar en lotes de 100 para evitar problemas de memoria y timeout
    const batchSize = 100;
    const totalBatches = Math.ceil(records.length / batchSize);
    
    console.log(`[${new Date().toISOString()}] -> Check Item Process -> Procesando ${records.length} registros del CSV`);
    
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const startIndex = batchIndex * batchSize;
      const endIndex = Math.min(startIndex + batchSize, records.length);
      const currentBatch = records.slice(startIndex, endIndex);
      
      console.log(`[${new Date().toISOString()}] -> Check Item Process -> Procesando lote ${batchIndex + 1}/${totalBatches} (registros ${startIndex + 1}-${endIndex})`);
      
      for (const record of currentBatch) {
        try {
          procesados++;
          
          // Validaciones para campos críticos
          if (!record.Item?.trim()) {
            console.log(`[${new Date().toISOString()}] -> Check Item Process -> Registro omitido: Item=${record.Item?.trim() || 'N/A'} - Motivo: Campo crítico faltante`);
            omitidos++;
            continue;
          }

          const itemCode = record.Item.trim();
          
          // Generar unique_key para items (solo el código del item)
          const uniqueKey = itemCode;

          if (processedKeys.has(uniqueKey)) {
            console.log(`[${new Date().toISOString()}] -> Check Item Process -> Registro duplicado en archivo omitido: ${uniqueKey}`);
            omitidos++;
            continue;
          }
          processedKeys.add(uniqueKey);
          
          // Buscar item existente por unique_key o por código (para registros antiguos sin unique_key)
          let existingItem = await getItemByUniqueKey(uniqueKey);
          if (!existingItem) {
            existingItem = await getItemByCode(itemCode);
          }
          
          if (!existingItem) {
            // NUEVO ITEM - Insertar
              await insertItem({
                item_code: itemCode,
                unique_key: uniqueKey,
                item_name: record.Descripcion_1?.trim(),
                item_name_extra: record.Descripcion_2?.trim(),
                unidad_medida: record.Unidad_medida?.trim()
            });
            
            //console.log(`[${new Date().toISOString()}] -> Check Item Process -> NUEVO ITEM insertado: Código=${itemCode}, unique_key=${uniqueKey}`);
            insertados++;
          } else {
            // ITEM EXISTENTE - Verificar si hay cambios
            const hasChanges = await compareItemFields(existingItem, record);
            
            if (hasChanges) {
              // ACTUALIZAR item
              await updateItem(existingItem.id, {
                item_code: itemCode,
                unique_key: uniqueKey,
                item_name: record.Descripcion_1?.trim(),
                item_name_extra: record.Descripcion_2?.trim(),
                unidad_medida: record.Unidad_medida?.trim(),
                updated_at: new Date()
              });
              
              console.log(`[${new Date().toISOString()}] -> Check Item Process -> ITEM ACTUALIZADO: Código=${itemCode}, unique_key=${uniqueKey}`);
              insertados++;
            } else {
              //console.log(`[${new Date().toISOString()}] -> Check Item Process -> ITEM SIN CAMBIOS: Código=${itemCode}, unique_key=${uniqueKey}`);
              omitidos++;
            }
          }
        } catch (error) {
          console.error(`[${new Date().toISOString()}] -> Check Item Process -> Error procesando item:`, error.message);
          errores++;
        }
      }
      
      // Log de progreso del lote
      console.log(`[${new Date().toISOString()}] -> Check Item Process -> Lote ${batchIndex + 1}/${totalBatches} completado. Progreso: ${procesados}/${records.length} registros procesados`);
    }

    console.log(`\n[${new Date().toISOString()}] -> Check Item Process -> RESUMEN DEL PROCESAMIENTO:`);
    console.log(`   • Total procesados: ${procesados}`);
    console.log(`   • Nuevos registros: ${insertados}`);
    console.log(`   • Registros omitidos: ${omitidos}`);
    console.log(`   • Errores: ${errores}`);
    console.log(`\n[${new Date().toISOString()}] -> Check Item Process -> Procesamiento completado exitosamente.`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] -> Check Item Process -> Error obteniendo archivo de red:`, error.message);
    return;
  }
}

module.exports = {
  fetchItemFilesFromNetwork
}; 
