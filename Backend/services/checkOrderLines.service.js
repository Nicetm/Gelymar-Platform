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

async function fetchOrderLineFilesFromNetwork() {
  const inputPath = mountIfNeeded();
  console.log('Ruta del archivo montado:', inputPath);

  if (!inputPath || !fs.existsSync(inputPath)) {
    console.error('Archivo no disponible o no montado:', inputPath);
    unmountIfNeeded();
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
        
        // Extraer campos del archivo según el mapeo correcto
        const pc = record.Nro?.trim();
        const linea = record.Linea?.trim();
        const itemCode = record.Item?.trim();
        const factura = record.Factura?.trim();
        const localizacion = record.Localizacion?.trim();
        const kgSolicitados = record.Cant_ordenada?.trim();
        const precioUnitario = record.Precio_Unit_US?.trim();
        const comentario = record.Comentario?.trim();
        const mercado = record.Mercado?.trim();
        const embalaje = record.Embalaje?.trim();
        const volumen = record.Volumen?.trim();
        const etiqueta = record.Etiqueta?.trim();
        const ktoEtiqueta5 = record.Kto_Etiqueta5?.trim();
        
        if (!pc) {
          console.log('Registro omitido sin PC (Nro):', record);
          omitidos++;
          continue;
        }

        if (!itemCode) {
          console.log('Registro omitido sin código de item:', record);
          omitidos++;
          continue;
        }

        // Verificar si la línea de orden ya existe
        const lineKey = `${pc}-${linea}-${factura}`;
        if (existingOrderLines.includes(lineKey)) {
          console.log(`Línea de orden ya existe: ${lineKey}`);
          omitidos++;
          continue;
        }

        // Buscar la orden en la base de datos
        const orderId = await getOrderIdByPc(pc);
        if (!orderId) {
          console.log(`Orden no encontrada para PC: ${pc}`);
          console.log(`Verificando si existe en la tabla orders...`);
          omitidos++;
          continue;
        }

        console.log(`Orden encontrada: PC=${pc}, Order ID=${orderId}`);

        // Buscar el item en la base de datos
        const item = await getItemByCode(itemCode);
        if (!item) {
          console.log(`Item no encontrado: ${itemCode}`);
          omitidos++;
          continue;
        }

        // Insertar la línea de orden
        await insertOrderLine({
          order_id: orderId,
          item_id: item.id,
          pc: pc,
          linea: linea ? parseInt(linea) : null,
          factura: factura,
          localizacion: localizacion,
          kg_solicitados: kgSolicitados ? parseFloat(kgSolicitados.replace(',', '.')) : null,
          unit_price: precioUnitario ? parseFloat(precioUnitario.replace(',', '.')) : null,
          observacion: comentario,
          mercado: mercado,
          embalaje: embalaje,
          volumen: volumen ? parseFloat(volumen.replace(',', '.')) : null,
          etiqueta: etiqueta,
          kto_etiqueta5: ktoEtiqueta5
        });

        console.log(`Línea de orden insertada: ${lineKey}`);
        insertados++;
      } catch (error) {
        console.error(`Error procesando línea de orden ${record.Nro}:`, error.message);
        errores++;
      }
    }

    console.log(`Procesamiento completado. Procesados: ${procesados}, Insertados: ${insertados}, Omitidos: ${omitidos}, Errores: ${errores}`);
  } catch (error) {
    console.error('Error procesando archivo de líneas de orden:', error);
  } finally {
    // Siempre desmontar al finalizar
    unmountIfNeeded();
  }
}

module.exports = {
  fetchOrderLineFilesFromNetwork
}; 