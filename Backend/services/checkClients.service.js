const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');
const { getAllCustomerRuts, getCustomerByRutForUpdate, updateCustomerByRut, insertCustomer } = require('./customer.service');
const { getNetworkFilePath } = require('./networkMount.service');

async function fetchClientFilesFromNetwork() {
  try {
    // Usar el servicio centralizado para obtener la ruta del archivo
    const inputPath = await getNetworkFilePath('CLIENTES_SOFTKEY.txt');
    console.log('Ruta del archivo:', inputPath);
    
    const content = fs.readFileSync(inputPath, 'latin1');
    const records = parse(content, {
      delimiter: ';',
      columns: true,
      skip_empty_lines: true,
      relax_quotes: true,
      relax_column_count: true
    });

    console.log(`Total de registros parseados: ${records.length}`);
      
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

    // Procesar todos los registros
    const recordsToProcess = records;
    
    console.log(`[${new Date().toISOString()}] -> Check Client Process -> Procesando ${recordsToProcess.length} registros del CSV`);

    let nuevos = 0;
    let actualizados = 0;
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
      
        // Función para normalizar valores vacíos a null
        const normalizeToNull = (value) => {
          if (!value || value.trim() === '') return null;
          return value.trim();
        };

        // Preparar datos del cliente
        const clientData = {
          name: normalizeToNull(r.Nombre),
          address: normalizeToNull(r.Direccion),
          address_alt: normalizeToNull(r.Direccion2),
          city: normalizeToNull(r.Ciudad),
          country: normalizeToNull(r.Pais),
          contact_name: normalizeToNull(r.Contacto),
          contact_secondary: normalizeToNull(r.Contacto2),
          fax: normalizeToNull(r.Fax),
          phone: normalizeToNull(r.Telefono),
          email: normalizeToNull(r.Correo),
          mobile: normalizeToNull(r.Mobile),
        };

        if (existingRuts.includes(rut)) {
          // Cliente existe, verificar si hay cambios
          const existingClient = await getCustomerByRutForUpdate(rut);
          if (existingClient) {
            // Función para normalizar valores (segunda comprobación de seguridad)
            const normalize = (value) => {
              if (value === undefined || value === '' || value === null) return null;
              return value;
            };

            // Comparar campos para detectar cambios
            const hasChanges = 
              normalize(existingClient.name) !== normalize(clientData.name) ||
              normalize(existingClient.email) !== normalize(clientData.email) ||
              normalize(existingClient.contact_name) !== normalize(clientData.contact_name) ||
              normalize(existingClient.contact_secondary) !== normalize(clientData.contact_secondary) ||
              normalize(existingClient.phone) !== normalize(clientData.phone) ||
              normalize(existingClient.fax) !== normalize(clientData.fax) ||
              normalize(existingClient.mobile) !== normalize(clientData.mobile) ||
              normalize(existingClient.address) !== normalize(clientData.address) ||
              normalize(existingClient.address_alt) !== normalize(clientData.address_alt) ||
              normalize(existingClient.country) !== normalize(clientData.country) ||
              normalize(existingClient.city) !== normalize(clientData.city);

            if (hasChanges) {
              await updateCustomerByRut(rut, clientData);
              console.log(`[${new Date().toISOString()}] -> Check Client Process -> ACTUALIZANDO: RUT=${rut}, Nombre=${clientData.name || 'N/A'}`);
              actualizados++;
            } else {
              //console.log(`[${new Date().toISOString()}] -> Check Client Process -> SIN CAMBIOS: RUT=${rut}, Nombre=${clientData.name || 'N/A'}`);
              omitidos++;
            }
          } else {
            console.log(`[${new Date().toISOString()}] -> Check Client Process -> Registro omitido: RUT=${rut} - Motivo: Cliente no encontrado en BD`);
            omitidos++;
          }
        } else {
          // Cliente no existe, insertarlo
          await insertCustomer({
            rut,
            ...clientData
          });

          console.log(`[${new Date().toISOString()}] -> Check Client Process -> INSERTANDO: RUT=${rut}, Nombre=${clientData.name || 'N/A'}, Cuenta creada OK`);
          nuevos++;
        }
      }
      // Log de progreso del lote
      console.log(`[${new Date().toISOString()}] -> Check Client Process -> Lote ${batchIndex + 1}/${totalBatches} completado. Progreso: ${nuevos + actualizados + omitidos}/${totalRecords} registros procesados`);
    }

    console.log(`\n[${new Date().toISOString()}] -> Check Client Process -> RESUMEN DEL PROCESAMIENTO:`);
    console.log(`   • Total procesados: ${recordsToProcess.length}`);
    console.log(`   • Nuevos clientes: ${nuevos}`);
    console.log(`   • Clientes actualizados: ${actualizados}`);
    console.log(`   • Registros omitidos: ${omitidos}`);
    console.log(`\n[${new Date().toISOString()}] -> Check Client Process -> Procesamiento de clientes completado exitosamente.`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] -> Check Client Process -> Error procesando archivo de clientes:`, error);
  }
}

module.exports = {
fetchClientFilesFromNetwork
};
