const fs = require('fs-extra');
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');
const { insertOrderLine, getAllExistingOrderLinesWithHashes, updateOrderLineByKey } = require('./orderItem.service');
const { getOrderIdByPcOnly } = require('./order.service');
const { getItemByCode } = require('./item.service');
const { poolPromise } = require('../config/db');
const crypto = require('crypto');

// Funciones para csv_processing_tracking
async function insertCsvTracking(orderLineId, orderLineHash, fileTimestamp) {
  const pool = await poolPromise;
  await pool.query(`
    INSERT INTO csv_processing_tracking (order_item_id, order_items_hash, csv_file_timestamp, last_processed_at)
    VALUES (?, ?, ?, NOW())
  `, [orderLineId, orderLineHash, fileTimestamp]);
}

async function updateCsvTracking(orderLineId, orderLineHash, fileTimestamp) {
  const pool = await poolPromise;
  await pool.query(`
    UPDATE csv_processing_tracking 
    SET order_items_hash = ?, csv_file_timestamp = ?, last_processed_at = NOW()
    WHERE order_item_id = ?
  `, [orderLineHash, fileTimestamp, orderLineId]);
}

async function fetchOrderLineFilesFromNetwork() {
  const inputPath = 'Z:\\FAC_LIN_SOFTKEY.txt';
  console.log('Ruta del archivo:', inputPath);

  if (!fs.existsSync(inputPath)) {
    console.error('Archivo no disponible en Z:\\FAC_LIN_SOFTKEY.txt');
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
    
    // Generar CSV sin fecha para evitar conflictos
    const filename = `documentos/FAC_LIN_SOFTKEY.csv`;
    
    try {
      fs.writeFileSync(filename, output, 'utf8');
      console.log(`${filename} generado correctamente.`);
    } catch (writeError) {
      console.warn(`No se pudo escribir el archivo CSV: ${writeError.message}`);
      console.log('Continuando con el procesamiento...');
    }

    // Obtener timestamp del archivo para comparación
    const fileStats = fs.statSync(inputPath);
    const fileTimestamp = fileStats.mtime;

    // Obtener líneas de orden existentes con hashes
    const existingOrderLines = await getAllExistingOrderLinesWithHashes();
    console.log(`Líneas de orden ya existentes en BD: ${existingOrderLines.length}`);

    let procesados = 0;
    let insertados = 0;
    let actualizados = 0;
    let omitidos = 0;
    let errores = 0;

    for (const record of records) {
      try {
        procesados++;
        
        // Extraer campos del archivo según el mapeo correcto
        const tipo = record.Tipo?.trim();
        const pc = record.Nro?.trim();
        const linea = record.Linea?.trim();
        const factura = record.Factura?.trim();
        const localizacion = record.Localizacion?.trim();
        const itemCode = record.Item?.trim();
        const descripcion = record.Descripcion?.trim();
        const kgSolicitados = record.Cant_ordenada?.trim();
        const kgEnviados = record.Cant_enviada?.trim();
        const precioUnitario = record.Precio_Unit?.trim();
        const comentario = record.Comentario?.trim();
        const mercado = record.Mercado?.trim();
        const embalaje = record.Embalaje?.trim();
        const volumen = record.Volumen?.trim();
        const etiqueta = record.Etiqueta?.trim();
        const ktoEtiqueta5 = record.Kto_Etiqueta5?.trim();
        const fechaEtd = record.ETD_Item_OV?.trim();
        const fechaEta = record.ETA_Item_OV?.trim();
        const kgFacturados = record.KilosFacturados?.trim();
        
        if (!pc) {
          console.log(`Omitido: PC=N/A, Línea=${record.Linea || 'N/A'}, Item=${record.Item || 'N/A'} - Sin PC`);
          omitidos++;
          continue;
        }

        if (!itemCode) {
          console.log(`Omitido: PC=${pc}, Línea=${record.Linea || 'N/A'}, Item=N/A - Sin item`);
          omitidos++;
          continue;
        }

        // Verificar si la línea de orden ya existe
        const lineKey = `${pc}-${linea}-${factura}`;
        const existingOrderLine = existingOrderLines.find(o => o.key === lineKey);
        
        if (existingOrderLine) {
          // Calcular hash de la fila actual del CSV
          const orderLineHash = crypto.createHash('md5')
            .update(JSON.stringify({
              tipo: tipo,
              pc: pc,
              linea: linea,
              factura: factura,
              localizacion: localizacion,
              itemCode: itemCode,
              descripcion: descripcion,
              kgSolicitados: kgSolicitados,
              kgEnviados: kgEnviados,
              precioUnitario: precioUnitario,
              comentario: comentario,
              mercado: mercado,
              embalaje: embalaje,
              volumen: volumen,
              etiqueta: etiqueta,
              ktoEtiqueta5: ktoEtiqueta5,
              fechaEtd: fechaEtd,
              fechaEta: fechaEta,
              kgFacturados: kgFacturados
            }))
            .digest('hex');

          // Verificar si hay cambios
          const hasChanges = orderLineHash !== existingOrderLine.csv_row_hash || 
                           fileTimestamp > existingOrderLine.csv_file_timestamp;

          if (hasChanges) {
            // Buscar la orden en la base de datos
            const orderId = await getOrderIdByPcOnly(pc);
            if (!orderId) {
              console.log(`Omitido: PC=${pc}, Línea=${linea || 'N/A'}, Item=${itemCode} - Orden no encontrada`);

              omitidos++;
              continue;
            }

            // Buscar el item por código: ${itemCode}
            const item = await getItemByCode(itemCode);
            if (!item) {
              console.log(`Omitido: PC=${pc}, Línea=${linea || 'N/A'}, Item=${itemCode} - Item no encontrado`);
              console.log(`Registro omitido: PC=${pc}, Línea=${linea || 'N/A'}, Item=${itemCode} - Motivo: Item no encontrado`);
              omitidos++;
              continue;
            }

            // Actualizar la línea de orden existente
            await updateOrderLineByKey(lineKey, {
              descripcion: descripcion,
              localizacion: localizacion,
              kg_solicitados: kgSolicitados ? parseFloat(kgSolicitados.replace(',', '.')) : null,
              kg_despachados: kgEnviados ? parseFloat(kgEnviados.replace(',', '.')) : null,
              unit_price: precioUnitario ? parseFloat(precioUnitario.replace(',', '.')) : null,
              observacion: comentario,
              mercado: mercado,
              embalaje: embalaje,
              volumen: volumen ? parseFloat(volumen.replace(',', '.')) : null,
              etiqueta: etiqueta,
              kto_etiqueta5: ktoEtiqueta5,
              tipo: tipo,
              fecha_etd: fechaEtd && fechaEtd.trim() !== '' ? fechaEtd : null,
              fecha_eta: fechaEta && fechaEta.trim() !== '' ? fechaEta : null,
              kg_facturados: kgFacturados ? parseFloat(kgFacturados.replace(',', '.')) : null,
              csv_row_hash: orderLineHash,
              csv_file_timestamp: fileTimestamp
            });

            // Actualizar en csv_processing_tracking
            await updateCsvTracking(existingOrderLine.id, orderLineHash, fileTimestamp);

            console.log(`Actualizado: PC=${pc}, Línea=${linea}, Item=${itemCode}`);
            actualizados++;
          } else {
            console.log(`Omitido: PC=${pc}, Línea=${linea}, Item=${itemCode} - Sin cambios`);
            omitidos++;
          }
          continue;
        }

        // Buscar la orden en la base de datos
        const orderId = await getOrderIdByPcOnly(pc);
        if (!orderId) {
          console.log(`Omitido: PC=${pc}, Línea=${linea || 'N/A'}, Item=${itemCode} - Orden no encontrada`);
          omitidos++;
          continue;
        }

        // Buscar el item en la base de datos
        const item = await getItemByCode(itemCode);
        if (!item) {
          console.log(`Omitido: PC=${pc}, Línea=${linea || 'N/A'}, Item=${itemCode} - Item no encontrado`);
          omitidos++;
          continue;
        }

        // Calcular hash para nueva línea de orden
        const orderLineHash = crypto.createHash('md5')
          .update(JSON.stringify({
            tipo: tipo,
            pc: pc,
            linea: linea,
            factura: factura,
            localizacion: localizacion,
            itemCode: itemCode,
            descripcion: descripcion,
            kgSolicitados: kgSolicitados,
            kgEnviados: kgEnviados,
            precioUnitario: precioUnitario,
            comentario: comentario,
            mercado: mercado,
            embalaje: embalaje,
            volumen: volumen,
            etiqueta: etiqueta,
            ktoEtiqueta5: ktoEtiqueta5,
            fechaEtd: fechaEtd,
            fechaEta: fechaEta,
            kgFacturados: kgFacturados
          }))
          .digest('hex');

        // Insertar la línea de orden
        const orderLineId = await insertOrderLine({
          order_id: orderId,
          item_id: item.id,
          descripcion: descripcion,
          pc: pc,
          linea: linea ? parseInt(linea) : null,
          factura: factura,
          localizacion: localizacion,
          kg_solicitados: kgSolicitados ? parseFloat(kgSolicitados.replace(',', '.')) : null,
          kg_despachados: kgEnviados ? parseFloat(kgEnviados.replace(',', '.')) : null,
          unit_price: precioUnitario ? parseFloat(precioUnitario.replace(',', '.')) : null,
          observacion: comentario,
          mercado: mercado,
          embalaje: embalaje,
          volumen: volumen ? parseFloat(volumen.replace(',', '.')) : null,
          etiqueta: etiqueta,
          kto_etiqueta5: ktoEtiqueta5,
          tipo: tipo,
          fecha_etd: fechaEtd && fechaEtd.trim() !== '' ? fechaEtd : null,
          fecha_eta: fechaEta && fechaEta.trim() !== '' ? fechaEta : null,
          kg_facturados: kgFacturados ? parseFloat(kgFacturados.replace(',', '.')) : null,
          csv_row_hash: orderLineHash,
          csv_file_timestamp: fileTimestamp
        });

        // Insertar en csv_processing_tracking (solo si la orden existe)
        if (orderId) {
          await insertCsvTracking(orderLineId, orderLineHash, fileTimestamp);
        }

        console.log(`Insertado: PC=${pc}, Línea=${linea}, Item=${itemCode}`);
        insertados++;
      } catch (error) {
        console.error(`Error procesando línea de orden ${record.Nro}:`, error.message);
        errores++;
      }
    }

    console.log(`Procesamiento completado. Procesados: ${procesados}, Insertados: ${insertados}, Actualizados: ${actualizados}, Omitidos: ${omitidos}, Errores: ${errores}`);
  } catch (error) {
    console.error('Error procesando archivo de líneas de orden:', error);
  }
}

module.exports = {
  fetchOrderLineFilesFromNetwork
}; 