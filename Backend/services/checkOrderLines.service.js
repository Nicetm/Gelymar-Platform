const fs = require('fs-extra');
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');
const { insertOrderLine } = require('./orderItem.service');
const { getOrderIdByPcOnly } = require('./order.service');
const { getItemByCode } = require('./item.service');
const { getNetworkFilePath } = require('./networkMount.service');

async function fetchOrderLineFilesFromNetwork() {
  try {
    // Usar el servicio centralizado para obtener la ruta del archivo
    const inputPath = await getNetworkFilePath('FAC_LIN_SOFTKEY.txt');
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
    
    // Generar CSV sin fecha para evitar conflictos
    const filename = `documentos/FAC_LIN_SOFTKEY.csv`;
    
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
    const totalRecords = records.length;

    console.log(`[${new Date().toISOString()}] -> Check Order Line Process -> Procesando ${totalRecords} registros del CSV`);
    
    // Procesar en lotes de 100 para evitar problemas de memoria y timeout
    const batchSize = 100;
    const totalBatches = Math.ceil(totalRecords / batchSize);
    
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const startIndex = batchIndex * batchSize;
      const endIndex = Math.min(startIndex + batchSize, totalRecords);
      const currentBatch = records.slice(startIndex, endIndex);
      
      console.log(`[${new Date().toISOString()}] -> Check Order Line Process -> Procesando lote ${batchIndex + 1}/${totalBatches} (registros ${startIndex + 1}-${endIndex})`);
      
      for (const record of currentBatch) {
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
        
        // Buscar la orden en la base de datos
        const orderId = await getOrderIdByPcOnly(pc);
        if (!orderId) {
          console.log(`[${new Date().toISOString()}] -> Check Order Line Process -> Registro omitido: PC=${pc}, Línea=${linea || 'N/A'}, Item=${itemCode} - Motivo: Orden no encontrada`);
          omitidos++;
          continue;
        }

        // Buscar el item en la base de datos
        const item = await getItemByCode(itemCode);
        if (!item) {
          console.log(`[${new Date().toISOString()}] -> Check Order Line Process -> Registro omitido: PC=${pc}, Línea=${linea || 'N/A'}, Item=${itemCode} - Motivo: Item no encontrado`);
          omitidos++;
          continue;
        }

        // Insertar la línea de orden
        await insertOrderLine({
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
          created_at: new Date(),
          updated_at: new Date()
        });

        console.log(`[${new Date().toISOString()}] -> Check Order Line Process -> insertando fila: PC=${pc}, Línea=${linea}, Item=${itemCode}`);
        insertados++;
      } catch (error) {
        console.error(`[${new Date().toISOString()}] -> Check Order Line Process -> Error procesando línea de orden ${record.Nro}:`, error.message);
        errores++;
      }
      }
      
      // Log de progreso del lote
      console.log(`[${new Date().toISOString()}] -> Check Order Line Process -> Lote ${batchIndex + 1}/${totalBatches} completado. Progreso: ${procesados}/${totalRecords} registros procesados`);
    }

    console.log(`\n[${new Date().toISOString()}] -> Check Order Line Process -> RESUMEN DEL PROCESAMIENTO:`);
    console.log(`   • Total procesados: ${procesados}`);
    console.log(`   • Nuevos registros: ${insertados}`);
    console.log(`   • Registros omitidos: ${omitidos}`);
    console.log(`   • Errores: ${errores}`);
    console.log(`\n[${new Date().toISOString()}] -> Check Order Line Process -> Procesamiento completado exitosamente.`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] -> Check Order Line Process -> Error obteniendo archivo de red:`, error.message);
    return;
  }
}

module.exports = {
  fetchOrderLineFilesFromNetwork
}; 