const fs = require('fs-extra');
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');
const { insertOrderLine } = require('./orderItem.service');
const { getOrderIdByPcOnly } = require('./order.service');
const { getItemByCode } = require('./item.service');
const { getNetworkFilePath } = require('./networkMount.service');
const crypto = require('crypto');

// Función para generar SHA corto (15 caracteres)
function generateShortHash(input) {
  const hash = crypto.createHash('sha256').update(input).digest('hex');
  return hash.substring(0, 15); // Solo los primeros 15 caracteres
}

async function fetchOrderLineFilesFromNetwork() {
  try {
    // Usar el servicio centralizado para obtener la ruta del archivo
    const inputPath = await getNetworkFilePath('FAC_LIN_SOFTKEY.txt');
    console.log('Ruta del archivo:', inputPath);
    
    const content = fs.readFileSync(inputPath, 'latin1');
    const normalizedContent = content.replace(/\|\|/g, ';');
    const records = parse(normalizedContent, {
      delimiter: ';',
      columns: true,
      skip_empty_lines: true,
      relax_quotes: true,
      relax_column_count: true,
      skip_records_with_error: true
    });

    console.log(`Total de registros parseados: ${records.length}`);
    
    // Agregar columna 'sublinea' a cada registro
    const recordsWithSublinea = records.map((record, index) => {
      const pc = record.Nro?.trim();
      const linea = record.Linea?.trim();
      const itemCode = record.Item?.trim();
      
      // Contar cuántas veces aparece esta combinación antes del índice actual
      let sublinea = 0;
      for (let i = 0; i < index; i++) {
        if (records[i].Nro?.trim() === pc && 
            records[i].Linea?.trim() === linea && 
            records[i].Item?.trim() === itemCode) {
          sublinea++;
        }
      }
      
      return {
        ...record,
        sublinea: sublinea.toString()
      };
    });

    console.log(`Total de registros con sublinea: ${recordsWithSublinea.length}`);
    
    // Mostrar las columnas disponibles en el primer registro
    if (recordsWithSublinea.length > 0) {
      console.log('Columnas disponibles en el archivo:');
      console.log(Object.keys(recordsWithSublinea[0]));
    }

    // Guardar CSV en disco para verificación
    const output = stringify(recordsWithSublinea, { header: true, delimiter: '||' });
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
    
    // Procesar todos los registros
    const recordsToProcess = recordsWithSublinea;
    const totalRecords = recordsToProcess.length;
    
    console.log(`[${new Date().toISOString()}] -> Check Order Line Process -> Procesando ${totalRecords} registros del CSV`);
    
    // Procesar en lotes de 100 para evitar problemas de memoria y timeout
    const batchSize = 100;
    const totalBatches = Math.ceil(totalRecords / batchSize);
    
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const startIndex = batchIndex * batchSize;
      const endIndex = Math.min(startIndex + batchSize, totalRecords);
      const currentBatch = recordsToProcess.slice(startIndex, endIndex);
      
      console.log(`[${new Date().toISOString()}] -> Check Order Line Process -> Procesando lote ${batchIndex + 1}/${totalBatches} (registros ${startIndex + 1}-${endIndex})`);
      
      for (const record of currentBatch) {
      try {
        procesados++;
        
        // Validaciones para campos críticos
        if (!record.Nro?.trim() || !record.Linea?.trim()) {
          console.log(`[${new Date().toISOString()}] -> Check Order Line Process -> Registro omitido: PC=${record.Nro?.trim() || 'N/A'}, Línea=${record.Linea?.trim() || 'N/A'} - Motivo: Campos críticos faltantes`);
          omitidos++;
          continue;
        }
        
        // Extraer campos para unique_key
        const pc = record.Nro.trim();
        const linea = record.Linea.trim();
        
        // Obtener la orden completa para acceder a fecha_ingreso y oc
        const order = await getOrderByPc(pc);
        if (!order) {
          console.log(`[${new Date().toISOString()}] -> Check Order Line Process -> Registro omitido: PC=${pc}, Línea=${linea} - Motivo: Orden no encontrada`);
          omitidos++;
          continue;
        }
        
        const oc = order.oc;
        let fechaIngreso = '';
        if (order.fecha_ingreso) {
          if (order.fecha_ingreso instanceof Date) {
            // Si es un objeto Date, formatear a YYYYMMDD
            const year = order.fecha_ingreso.getFullYear();
            const month = String(order.fecha_ingreso.getMonth() + 1).padStart(2, '0');
            const day = String(order.fecha_ingreso.getDate()).padStart(2, '0');
            fechaIngreso = `${year}${month}${day}`;
          } else {
            // Si es string, quitar guiones
            fechaIngreso = String(order.fecha_ingreso).replace(/-/g, '');
          }
        }
        
        const sublinea = record.sublinea?.trim() || '0';
        
        // Extraer campos del archivo según el mapeo correcto
        const itemCode = record.Item?.trim();
        const tipo = record.Tipo?.trim();
        const localizacion = record.Localizacion?.trim();
        
        // Generar unique_key usando SHA corto con sublinea
        const uniqueKey = generateShortHash(`${pc}-${fechaIngreso}-${linea}-${sublinea}`);
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
        const fechaEtdFactura = record.ETD_ENC_FA?.trim();
        const fechaEtaFactura = record.ETA_ENC_FA?.trim();
        const kgFacturados = record.KilosFacturados?.trim();
        const factura = record.Factura?.trim() || '';
        
        // Usar el orderId de la orden ya obtenida
        const orderId = order.id;

        // Buscar el item en la base de datos
        const item = await getItemByCode(itemCode);
        if (!item) {
          console.log(`[${new Date().toISOString()}] -> Check Order Line Process -> Registro omitido: PC=${pc}, Línea=${linea}, Item=${itemCode} - Motivo: Item no encontrado`);
          omitidos++;
          continue;
        }

        // Buscar línea de orden existente por unique_key
        const existingLine = await getOrderLineByUniqueKey(uniqueKey);
        
        if (!existingLine) {
          // NUEVA LÍNEA - Insertar
          await insertOrderLine({
            order_id: orderId,
            item_id: item.id,
            descripcion: descripcion,
            pc: pc,
            linea: linea ? parseInt(linea) : null,
            sublinea: parseInt(sublinea),
            factura: factura,
            localizacion: localizacion,
            kg_solicitados: kgSolicitados ? normalizeDecimal(kgSolicitados, 4) : null,
            kg_despachados: kgEnviados ? normalizeDecimal(kgEnviados, 4) : null,
            unit_price: precioUnitario ? normalizeDecimal(precioUnitario, 4) : null,
            observacion: comentario,
            mercado: mercado,
            embalaje: embalaje,
            volumen: volumen ? normalizeDecimal(volumen, 4) : null,
            etiqueta: etiqueta,
            kto_etiqueta5: ktoEtiqueta5,
            tipo: tipo,
            fecha_etd: fechaEtd && fechaEtd.trim() !== '' ? fechaEtd : null,
            fecha_eta: fechaEta && fechaEta.trim() !== '' ? fechaEta : null,
            fecha_etd_factura: fechaEtdFactura && fechaEtdFactura.trim() !== '' ? fechaEtdFactura : null,
            fecha_eta_factura: fechaEtaFactura && fechaEtaFactura.trim() !== '' ? fechaEtaFactura : null,
            kg_facturados: kgFacturados ? normalizeDecimal(kgFacturados, 4) : null,
            unique_key: uniqueKey,
            created_at: new Date(),
            updated_at: new Date()
          });

          console.log(`[${new Date().toISOString()}] -> Check Order Line Process -> NUEVA LÍNEA insertada: PC=${pc}, Línea=${linea}, unique_key=${uniqueKey}`);
          insertados++;
        } else {
          // LÍNEA EXISTENTE - Verificar si hay cambios
          const hasChanges = await compareOrderLineFields(existingLine, record);
          
          if (hasChanges) {
            // ACTUALIZAR línea de orden
            await updateOrderLine(existingLine.id, {
              order_id: orderId,
              item_id: item.id,
              descripcion: descripcion,
              pc: pc,
              linea: linea ? parseInt(linea) : null,
              sublinea: sublinea,
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
              fecha_etd_factura: fechaEtdFactura && fechaEtdFactura.trim() !== '' ? fechaEtdFactura : null,
              fecha_eta_factura: fechaEtaFactura && fechaEtaFactura.trim() !== '' ? fechaEtaFactura : null,
              kg_facturados: kgFacturados ? parseFloat(kgFacturados.replace(',', '.')) : null,
              unique_key: uniqueKey,
              updated_at: new Date()
            });
            
            console.log(`[${new Date().toISOString()}] -> Check Order Line Process -> LÍNEA ACTUALIZADA: PC=${pc}, Línea=${linea}, unique_key=${uniqueKey}`);
            insertados++;
          } else {
            //console.log(`[${new Date().toISOString()}] -> Check Order Line Process -> LÍNEA SIN CAMBIOS: PC=${pc}, Línea=${linea}, unique_key=${uniqueKey}`);
            omitidos++;
          }
        }
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

// Función para buscar orden por PC
async function getOrderByPc(pc) {
  const { poolPromise } = require('../config/db');
  const pool = await poolPromise;
  
  try {
    const [rows] = await pool.query(
      'SELECT * FROM orders WHERE pc = ? LIMIT 1',
      [pc]
    );
    return rows[0] || null;
  } catch (error) {
    console.error('Error buscando orden por PC:', error);
    return null;
  }
}

// Función para buscar línea de orden por unique_key
async function getOrderLineByUniqueKey(uniqueKey) {
  const { poolPromise } = require('../config/db');
  const pool = await poolPromise;
  
  try {
    const [rows] = await pool.query(
      'SELECT * FROM order_items WHERE unique_key = ?',
      [uniqueKey]
    );
    return rows[0] || null;
  } catch (error) {
    console.error('Error buscando línea de orden por unique_key:', error);
    return null;
  }
}

// Función para comparar campos de línea de orden
async function compareOrderLineFields(existingLine, newRecord) {
  const fieldsToCompare = [
    'factura', 'descripcion', 'kg_solicitados', 'kg_despachados', 'unit_price', 
    'observacion', 'mercado', 'embalaje', 'volumen', 'etiqueta', 'kto_etiqueta5',
    'tipo', 'fecha_etd', 'fecha_eta', 'fecha_etd_factura', 'fecha_eta_factura', 'kg_facturados', 'localizacion'
  ];
  
  for (const field of fieldsToCompare) {
    const existingValue = existingLine[field];
    let newValue;
    
    // Normalizar valores según el tipo de campo
    if (field === 'kg_solicitados') {
      newValue = newRecord.Cant_ordenada ? normalizeDecimal(newRecord.Cant_ordenada, 4) : null;
    } else if (field === 'kg_despachados') {
      newValue = newRecord.Cant_enviada ? normalizeDecimal(newRecord.Cant_enviada, 4) : null;
    } else if (field === 'unit_price') {
      newValue = newRecord.Precio_Unit ? normalizeDecimal(newRecord.Precio_Unit, 4) : null;
    } else if (field === 'kg_facturados') {
      newValue = newRecord.KilosFacturados ? normalizeDecimal(newRecord.KilosFacturados, 4) : null;
    } else if (field === 'volumen') {
      newValue = newRecord.Volumen ? normalizeDecimal(newRecord.Volumen, 4) : null;
    } else if (field === 'fecha_etd') {
      newValue = newRecord.ETD_Item_OV && newRecord.ETD_Item_OV.trim() !== '' ? normalizeDate(newRecord.ETD_Item_OV) : null;
    } else if (field === 'fecha_eta') {
      newValue = newRecord.ETA_Item_OV && newRecord.ETA_Item_OV.trim() !== '' ? normalizeDate(newRecord.ETA_Item_OV) : null;
    } else if (field === 'fecha_etd_factura') {
      newValue = newRecord.ETD_ENC_FA && newRecord.ETD_ENC_FA.trim() !== '' ? normalizeDate(newRecord.ETD_ENC_FA) : null;
    } else if (field === 'fecha_eta_factura') {
      newValue = newRecord.ETA_ENC_FA && newRecord.ETA_ENC_FA.trim() !== '' ? normalizeDate(newRecord.ETA_ENC_FA) : null;
    } else if (field === 'factura') {
      newValue = normalizeValue(newRecord.Factura?.trim());
    } else if (field === 'descripcion') {
      newValue = newRecord.Descripcion?.trim() || null;
    } else if (field === 'observacion') {
      newValue = newRecord.Comentario?.trim() || null;
    } else if (field === 'mercado') {
      newValue = newRecord.Mercado?.trim() || null;
    } else if (field === 'embalaje') {
      newValue = newRecord.Embalaje?.trim() || null;
    } else if (field === 'etiqueta') {
      newValue = newRecord.Etiqueta?.trim() || null;
    } else if (field === 'kto_etiqueta5') {
      newValue = newRecord.Kto_Etiqueta5?.trim() || null;
    } else if (field === 'tipo') {
      newValue = newRecord.Tipo?.trim() || null;
    } else if (field === 'localizacion') {
      newValue = newRecord.Localizacion?.trim() || null;
    }
    
    // Normalizar el valor existente también para comparación
    let normalizedExistingValue = existingValue;
    
    // Normalizar fechas
    if (field === 'fecha_etd' || field === 'fecha_eta' || field === 'fecha_etd_factura' || field === 'fecha_eta_factura') {
      normalizedExistingValue = normalizeDate(existingValue);
    }
    // Normalizar decimales
    else if (field === 'kg_solicitados' || field === 'kg_despachados' || field === 'unit_price' || 
             field === 'kg_facturados' || field === 'volumen') {
      normalizedExistingValue = normalizeDecimal(existingValue, 4);
    }
    // Normalizar strings vacíos
    else {
      normalizedExistingValue = normalizeValue(existingValue);
    }
    
    if (normalizedExistingValue !== newValue) {
      console.log(`Campo ${field} cambió: ${normalizedExistingValue} -> ${newValue}`);
      console.log(`  - existingValue original: "${existingValue}" (tipo: ${typeof existingValue})`);
      console.log(`  - newValue original: "${newRecord.Factura}" (tipo: ${typeof newRecord.Factura})`);
      console.log(`  - normalizedExistingValue: "${normalizedExistingValue}" (tipo: ${typeof normalizedExistingValue})`);
      console.log(`  - newValue normalizado: "${newValue}" (tipo: ${typeof newValue})`);
      return true;
    }
  }
  
  return false;
}

// Funciones de normalización
function normalizeDate(value) {
  if (value === null || value === undefined || value === 'null' || value === 'undefined') return null;
  const trimmed = String(value).trim();
  if (trimmed === '') return null;
  
  // Si es un objeto Date, convertirlo a string YYYY-MM-DD
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  // Si es string, normalizar formato
  if (typeof value === 'string') {
    // Remover tiempo si existe (2013-08-26 00:00:00 -> 2013-08-26)
    const dateOnly = trimmed.split(' ')[0];
    
    // Convertir formato YYYY-M-D a YYYY-MM-DD
    const parts = dateOnly.split('-');
    if (parts.length === 3) {
      const year = parts[0];
      const month = parts[1].padStart(2, '0');
      const day = parts[2].padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    return dateOnly;
  }
  
  return value;
}

function normalizeValue(value) {
  if (value === null || value === undefined || value === 'null' || value === 'undefined') return null;
  const trimmed = String(value).trim();
  return trimmed === '' ? null : trimmed;
}

function normalizeNumber(value) {
  if (value === null || value === undefined || value === 'null' || value === 'undefined') return null;
  const trimmed = String(value).trim();
  if (trimmed === '') return null;
  const parsed = parseFloat(trimmed.replace(',', '.'));
  return isNaN(parsed) ? null : parsed;
}

// Función para normalizar decimales con precisión específica
function normalizeDecimal(value, decimals = 2) {
  if (value === null || value === undefined || value === 'null' || value === 'undefined') return null;
  const trimmed = String(value).trim();
  if (trimmed === '') return null;
  const parsed = parseFloat(trimmed.replace(',', '.'));
  if (isNaN(parsed)) return null;
  return parseFloat(parsed.toFixed(decimals));
}

// Función para actualizar línea de orden
async function updateOrderLine(lineId, lineData) {
  const { poolPromise } = require('../config/db');
  const pool = await poolPromise;
  
  try {
    const fields = Object.keys(lineData).map(key => `${key} = ?`).join(', ');
    const values = Object.values(lineData);
    values.push(lineId);
    
    await pool.query(
      `UPDATE order_items SET ${fields} WHERE id = ?`,
      values
    );
  } catch (error) {
    console.error('Error actualizando línea de orden:', error);
    throw error;
  }
}


module.exports = {
  fetchOrderLineFilesFromNetwork
}; 
