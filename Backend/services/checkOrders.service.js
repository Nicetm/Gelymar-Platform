const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');
const { getCustomerByRut } = require('./customer.service');
const { insertOrder, getAllExistingOrders } = require('./order.service');

const SERVER = '172.20.10.167';
const SHARE_PATH = 'Users/above/Documents/BotArchivoWeb/archivos';
const FILE_NAME = 'FAC_HDR_SOFTKEY.txt';
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

async function fetchOrderFilesFromNetwork() {
  const inputPath = mountIfNeeded();
  console.log('Ruta del archivo montado:', inputPath);

  if (!inputPath) {
    console.error('No se pudo obtener la ruta del archivo');
    return;
  }

  console.log('Verificando si existe el archivo:', inputPath);
  if (!fs.existsSync(inputPath)) {
    console.error('Archivo no disponible o no montado:', inputPath);
    console.log('Intentando listar directorio Z:\\');
    try {
      const files = fs.readdirSync('Z:\\');
      console.log('Archivos en Z:\\:', files);
    } catch (err) {
      console.log('No se puede acceder a Z:\\:', err.message);
    }
    return;
  }

  try {
    console.log('Intentando leer archivo desde:', inputPath);
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
      
      // Verificar si existe algún campo que contenga RUT
      const firstRecord = records[0];
      const rutFields = Object.keys(firstRecord).filter(key => 
        key.toLowerCase().includes('rut') || 
        key.toLowerCase().includes('cliente') ||
        key.toLowerCase().includes('customer')
      );
      
      if (rutFields.length > 0) {
        console.log('Campos que podrían contener RUT:', rutFields);
        rutFields.forEach(field => {
          console.log(`   ${field}: "${firstRecord[field]}"`);
        });
      } else {
        console.log('No se encontraron campos que contengan RUT');
      }
    }

    // Guardar CSV en disco para verificación
    const output = stringify(records, { header: true, delimiter: ';' });
    fs.ensureDirSync('documentos');
    fs.writeFileSync('documentos/FAC_HDR_SOFTKEY.csv', output, 'utf8');
    console.log('FAC_HDR_SOFTKEY.csv generado correctamente.');

    // Obtener órdenes existentes
    const existingOrders = await getAllExistingOrders();
    console.log(`Órdenes ya existentes en BD: ${existingOrders.length}`);

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
        
        // Extraer RUT sin la C final
        let rut = record.Rut?.trim();
        if (!rut) {
          console.log(`Registro ${procesados} omitido: sin RUT`);
          continue;
        }
        
        // Remover la C final si existe
        const rutOriginal = rut;
        rut = rut.replace(/C$/, '');
        
        if (procesados <= 3) {
          console.log(`RUT original: "${rutOriginal}" -> RUT procesado: "${rut}"`);
        }
        
        // Buscar el cliente por RUT
        console.log(`Buscando cliente con RUT: "${rut}" (registro ${procesados})`);
        const customer = await getCustomerByRut(rut);
        if (!customer) {
          if (procesados <= 10) { // Solo mostrar los primeros 10 errores
            console.log(`Cliente no encontrado para RUT: "${rut}" (registro ${procesados})`);
          }
          errores++;
          continue;
        }

        console.log(`Cliente encontrado: ID=${customer.id}, Nombre=${customer.name}, RUT=${customer.rut}`);

        // Extraer campos del registro
        const orderData = {
          customer_id: customer.id,
          rut: rut,
          pc: record.Nro || '', // Nro del txt
          oc: record.OC || '',
          factura: record.Factura || '',
          fec_factura: record.Fecha_factura && record.Fecha_factura !== '0' ? record.Fecha_factura : new Date().toISOString().split('T')[0],
          name: record.OC || '', // Usar OC como nombre
          path: '' // Campo path vacío por defecto
        };

        // Verificar si la orden ya existe (por PC y OC)
        const orderKey = `${orderData.pc}-${orderData.oc}`;
        if (existingOrders.includes(orderKey)) {
          if (procesados <= 10) { // Solo mostrar los primeros 10 omitidos
            console.log(`Orden ya existe: PC=${orderData.pc}, OC=${orderData.oc}`);
          }
          omitidos++;
          continue;
        }

        if (procesados <= 3) {
          console.log(`Datos de orden a insertar:`, JSON.stringify(orderData, null, 2));
        }

        // Insertar la orden
        await insertOrder(orderData);
        
        if (procesados <= 10) { // Solo mostrar los primeros 10 éxitos
          console.log(`Orden insertada para cliente ${rut}: PC=${orderData.pc}, OC=${orderData.oc}`);
        }
        insertados++;
        
      } catch (err) {
        console.error(`Error procesando registro ${procesados}:`, err.message);
        errores++;
      }
    }

    console.log(`Proceso completado:`);
    console.log(`- Registros procesados: ${procesados}`);
    console.log(`- Órdenes insertadas: ${insertados}`);
    console.log(`- Órdenes omitidas (ya existían): ${omitidos}`);
    console.log(`- Errores: ${errores}`);
    
  } catch (err) {
    console.error('Error al procesar archivo:', err.message);
  }
}

module.exports = { fetchOrderFilesFromNetwork }; 