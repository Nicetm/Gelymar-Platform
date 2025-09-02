const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');
const { getAllCustomerRuts, insertCustomer } = require('./customer.service');

async function fetchClientFilesFromNetwork() {
    const inputPath = 'Z:\\CLIENTES.txt';
    console.log('Ruta del archivo:', inputPath);
  
    if (!fs.existsSync(inputPath)) {
      console.error('Archivo no disponible en Z:\\CLIENTES.txt');
      console.log('Conéctate manualmente a la red compartida antes de ejecutar el cron');
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
      
      // Usar timestamp para evitar conflictos de archivo
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `documentos/CLIENTES_${timestamp}.csv`;
      
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
    }
}

module.exports = {
  fetchClientFilesFromNetwork
};
