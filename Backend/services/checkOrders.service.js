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

async function fetchOrderFilesFromNetwork() {
  const inputPath = mountIfNeeded();
  console.log('Ruta del archivo montado:', inputPath);

  if (!inputPath) {
    console.error('No se pudo obtener la ruta del archivo');
    unmountIfNeeded();
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
    unmountIfNeeded();
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
      console.log('Campos que podrían contener RUT:', rutFields);
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
        
        // Buscar el campo que contiene el RUT del cliente
        let customerRut = null;
        const possibleRutFields = ['Rut', 'Cliente', 'Customer', 'RUT', 'CLIENTE'];
        
        for (const field of possibleRutFields) {
          if (record[field]) {
            customerRut = record[field].trim();
            break;
          }
        }
        
        if (!customerRut) {
          console.log('Registro omitido sin RUT de cliente:', record);
          omitidos++;
          continue;
        }

        // Remover la C final si existe
        const rutOriginal = customerRut;
        customerRut = customerRut.replace(/C$/, '');
        
        console.log(`RUT original: "${rutOriginal}" -> RUT procesado: "${customerRut}"`);

        // Buscar el campo que contiene el número de orden
        let orderNumber = null;
        const possibleOrderFields = ['Orden', 'Order', 'Numero', 'Number', 'PC', 'Pedido', 'Nro'];
        
        for (const field of possibleOrderFields) {
          if (record[field]) {
            orderNumber = record[field].trim();
            break;
          }
        }
        
        if (!orderNumber) {
          console.log('Registro omitido sin número de orden:', record);
          omitidos++;
          continue;
        }

        // Verificar si la orden ya existe
        const orderKey = `${customerRut}-${orderNumber}`;
        if (existingOrders.includes(orderKey)) {
          console.log(`Orden ya existe: ${orderKey}`);
          omitidos++;
          continue;
        }

        // Buscar el cliente en la base de datos
        const customer = await getCustomerByRut(customerRut);
        if (!customer) {
          console.log(`Cliente no encontrado: ${customerRut}`);
          omitidos++;
          continue;
        }

        // Extraer campos del archivo
        const factura = record.Factura?.trim() || '';
        const fecFactura = record.Fecha_factura?.trim() || '';
        const oc = record.OC?.trim() || '';

        // Insertar la orden
        await insertOrder({
          customer_id: customer.id,
          rut: customerRut,
          pc: orderNumber,
          oc: oc,
          factura: factura,
          fec_factura: fecFactura && fecFactura !== '0' ? fecFactura : null,
          name: oc || orderNumber, // Usar OC como nombre o el número de orden
          path: '' // Campo path vacío por defecto
        });

        console.log(`Orden insertada: ${orderKey}`);
        insertados++;
      } catch (error) {
        console.error(`Error procesando orden ${record.Orden || record.Order}:`, error.message);
        errores++;
      }
    }

    console.log(`Procesamiento completado. Procesados: ${procesados}, Insertados: ${insertados}, Omitidos: ${omitidos}, Errores: ${errores}`);
  } catch (error) {
    console.error('Error procesando archivo de órdenes:', error);
  } finally {
    // Siempre desmontar al finalizar
    unmountIfNeeded();
  }
}

module.exports = {
  fetchOrderFilesFromNetwork
}; 
module.exports = { fetchOrderFilesFromNetwork }; 