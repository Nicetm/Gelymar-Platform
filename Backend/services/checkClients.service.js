const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');
const { getAllCustomerRuts, insertCustomer } = require('./customer.service');
const { getNetworkFilePath } = require('./networkMount.service');

async function fetchClientFilesFromNetwork() {
    try {
      // Usar el servicio centralizado para obtener la ruta del archivo
      const inputPath = await getNetworkFilePath('CLIENTES_SOFTKEY.txt');
      console.log('Ruta del archivo:', inputPath);
      
      const content = fs.readFileSync(inputPath, 'latin1');
      console.log('Contenido leído (primeras líneas):');
      console.log(content.split('\n').slice(0, 3).join('\n'));
  
      const records = parse(content, {
        delimiter: ';',
        columns: true,
        skip_empty_lines: true,
        relax_quotes: true,
        relax_column_count: true
      });
  
      console.log(`Total de registros parseados: ${records.length}`);
      
      // Debug: mostrar las columnas detectadas y el primer registro
      if (records.length > 0) {
        console.log('Columnas detectadas:', Object.keys(records[0]));
        console.log('Primer registro:', records[0]);
      }
  
      // Guardar CSV en disco
      const output = stringify(records, { header: true, delimiter: ';' });
      fs.ensureDirSync('documentos');
      
      // Usar timestamp para evitar conflictos de archivo
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `documentos/CLIENTES_SOFTKEY_${timestamp}.csv`;
      
      try {
        fs.writeFileSync(filename, output, 'utf8');
        console.log(`${filename} generado correctamente.`);
      } catch (writeError) {
        console.warn(`No se pudo escribir el archivo CSV: ${writeError.message}`);
        console.log('Continuando con el procesamiento...');
      }
  
            // Leer RUTs existentes en la BD
      const existingRuts = await getAllCustomerRuts();
      console.log(`RUTs ya existentes en BD: ${existingRuts.length}`);

      // Procesar todos los registros
      const recordsToProcess = records;
      
      console.log(`[${new Date().toISOString()}] -> Check Client Process -> Procesando ${recordsToProcess.length} registros del CSV`);

      let nuevos = 0;
      let omitidos = 0;
      const totalRecords = recordsToProcess.length;

      // Procesar en lotes de 100 para evitar problemas de memoria y timeout
      const batchSize = 100;
      const totalBatches = Math.ceil(totalRecords / batchSize);
      
      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const startIndex = batchIndex * batchSize;
        const endIndex = Math.min(startIndex + batchSize, totalRecords);
        const currentBatch = recordsToProcess.slice(startIndex, endIndex);
        
        console.log(`[${new Date().toISOString()}] -> Check Client Process -> Procesando lote ${batchIndex + 1}/${totalBatches} (registros ${startIndex + 1}-${endIndex})`);
        
        for (const r of currentBatch) {
                let rut = r.Rut?.trim();
        if (!rut) {
          console.log(`[${new Date().toISOString()}] -> Check Client Process -> Registro omitido: RUT=${r.Rut?.trim() || 'N/A'} - Motivo: Sin RUT`);
          omitidos++;
          continue;
        }
        
        // Quitar la C final del RUT si existe
        if (rut.endsWith('C') || rut.endsWith('c')) {
          rut = rut.slice(0, -1);
        }
        
        if (existingRuts.includes(rut)) {
          console.log(`[${new Date().toISOString()}] -> Check Client Process -> Registro omitido: RUT=${rut} - Motivo: Cliente ya existe`);
          omitidos++;
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

        console.log(`[${new Date().toISOString()}] -> Check Client Process -> insertando fila: RUT=${rut}, Nombre=${r.Nombre?.trim() || 'N/A'}, Cuenta creada OK`);
        nuevos++;
      }
      
      // Log de progreso del lote
      console.log(`[${new Date().toISOString()}] -> Check Client Process -> Lote ${batchIndex + 1}/${totalBatches} completado. Progreso: ${nuevos + omitidos}/${totalRecords} registros procesados`);
    }
  
      console.log(`\n[${new Date().toISOString()}] -> Check Client Process -> RESUMEN DEL PROCESAMIENTO:`);
      console.log(`   • Total procesados: ${recordsToProcess.length}`);
      console.log(`   • Nuevos clientes: ${nuevos}`);
      console.log(`   • Registros omitidos: ${omitidos}`);
      console.log(`\n[${new Date().toISOString()}] -> Check Client Process -> Procesamiento de clientes completado exitosamente.`);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] -> Check Client Process -> Error procesando archivo de clientes:`, error);
    }
}

module.exports = {
  fetchClientFilesFromNetwork
};
