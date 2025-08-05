const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');
const { insertOrderLine, getAllExistingOrderLines } = require('./orderItem.service');
const { getOrderIdByPc } = require('./order.service');
const { getItemByCode } = require('./item.service');

const SERVER = '172.20.10.167';
const SHARE_PATH = 'Users/above/Documents/BotArchivoWeb/archivos';
const FILE_NAME = 'FAC_LIN_SOFTKEY.txt';
const USER = 'softkey';
const PASSWORD = 'sK06.2025#';

function mountIfNeeded() {
  const platform = os.platform();
  if (platform === 'win32') {
    const filePath = `Z:\\${FILE_NAME}`;
    if (!fs.existsSync(filePath)) {
      try {
        execSync(`net use Z: \\\\${SERVER}\\${SHARE_PATH} /user:${USER} ${PASSWORD} /persistent:no`, { stdio: 'ignore' });
      } catch (err) {
        console.error('Error montando red en Windows:', err.message);
        return null;
      }
    }
    return filePath;
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

async function fetchOrderLineFilesFromNetwork() {
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
    fs.writeFileSync('documentos/FAC_LIN_SOFTKEY.csv', output, 'utf8');
    console.log('FAC_LIN_SOFTKEY.csv generado correctamente.');

    // Obtener líneas de orden existentes
    const existingOrderLines = await getAllExistingOrderLines();
    console.log(`Líneas de orden ya existentes en BD: ${existingOrderLines.length}`);

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
        
        // Extraer campos del registro
        const pc = record.Nro?.trim() || '';
        if (!pc) {
          console.log(`Registro ${procesados} omitido: sin PC`);
          continue;
        }

        // Buscar el order_id por PC
        const orderId = await getOrderIdByPc(pc);
        if (!orderId) {
          if (procesados <= 10) { // Solo mostrar los primeros 10 errores
            console.log(`Orden no encontrada para PC: ${pc}`);
          }
          errores++;
          continue;
        }

        if (procesados <= 3) {
          console.log(`Orden encontrada: PC=${pc}, Order ID=${orderId}`);
        }

        // Buscar el item_id por código
        const itemCode = record.Item?.trim() || '';
        if (!itemCode) {
          console.log(`Registro ${procesados} omitido: sin código de item`);
          continue;
        }

        const item = await getItemByCode(itemCode);
        if (!item) {
          if (procesados <= 10) { // Solo mostrar los primeros 10 errores
            console.log(`Item no encontrado para código: ${itemCode}`);
          }
          errores++;
          continue;
        }

        if (procesados <= 3) {
          console.log(`Item encontrado: Código=${itemCode}, ID=${item.id}`);
        }

        const orderLineData = {
          order_id: orderId,
          pc: pc,
          linea: record.Linea?.trim() || '',
          factura: record.Factura?.trim() || '',
          localizacion: record.Localizacion?.trim() || '',
          item_id: item.id, // Usar el ID numérico del item
          descripcion: record.Descripcion?.trim() || '',
          kg_solicitados: record.Cant_ordenada?.trim() || '',
          kg_despachados: record.Cant_enviada?.trim() || '',
          unit_price: record.Precio_Unit_US?.trim() || '',
          observacion: record.Comentario?.trim() || '',
          mercado: record.Mercado?.trim() || '',
          embalaje: record.Embalaje?.trim() || '',
          volumen: record.Volumen?.trim() || '',
          etiqueta: record.Etiqueta?.trim() || '',
          kto_etiqueta5: record.Kto_Etiqueta5?.trim() || ''
        };

        // Verificar si la línea de orden ya existe (por PC, línea y factura)
        const orderLineKey = `${orderLineData.pc}-${orderLineData.linea}-${orderLineData.factura}`;
        if (existingOrderLines.includes(orderLineKey)) {
          if (procesados <= 10) { // Solo mostrar los primeros 10 omitidos
            console.log(`Línea de orden ya existe: PC=${orderLineData.pc}, Línea=${orderLineData.linea}, Factura=${orderLineData.factura}`);
          }
          omitidos++;
          continue;
        }

        if (procesados <= 3) {
          console.log(`Datos de línea de orden a insertar:`, JSON.stringify(orderLineData, null, 2));
        }

        // Insertar la línea de orden
        await insertOrderLine(orderLineData);
        
        if (procesados <= 10) { // Solo mostrar los primeros 10 éxitos
          console.log(`Línea de orden insertada: PC=${orderLineData.pc}, Línea=${orderLineData.linea}, Item=${orderLineData.item_id}`);
        }
        insertados++;
        
      } catch (err) {
        console.error(`Error procesando registro ${procesados}:`, err.message);
        errores++;
      }
    }

    console.log(`Proceso completado:`);
    console.log(`- Registros procesados: ${procesados}`);
    console.log(`- Líneas de orden insertadas: ${insertados}`);
    console.log(`- Líneas de orden omitidas (ya existían): ${omitidos}`);
    console.log(`- Errores: ${errores}`);
    
  } catch (err) {
    console.error('Error al procesar archivo:', err.message);
  }
}

module.exports = { fetchOrderLineFilesFromNetwork }; 