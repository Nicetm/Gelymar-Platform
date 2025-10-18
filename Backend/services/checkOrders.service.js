const fs = require('fs-extra');
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');
const { getCustomerByRut } = require('./customer.service');
const { insertOrder } = require('./order.service');
const { createOrderDetail } = require('./orderDetail.service');
const { getNetworkFilePath } = require('./networkMount.service');
const crypto = require('crypto');
const { poolPromise } = require('../config/db');

// Las variables de entorno ya se cargan automáticamente en app.js

// Función para generar SHA corto (15 caracteres)
function generateShortHash(input) {
  const hash = crypto.createHash('sha256').update(input).digest('hex');
  return hash.substring(0, 15); // Solo los primeros 15 caracteres
}

// Función para normalizar fechas
function normalizeDate(dateValue) {
  if (!dateValue) return null;
  
  // Si es string, intentar parsearlo
  if (typeof dateValue === 'string') {
    const trimmed = dateValue.trim();
    if (!trimmed || trimmed === '0' || trimmed === '') return null;
    
    // Intentar parsear diferentes formatos
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      // Retornar en formato YYYY-MM-DD consistente
      const year = parsed.getFullYear();
      const month = String(parsed.getMonth() + 1).padStart(2, '0');
      const day = String(parsed.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }
  
  // Si es objeto Date, convertirlo a formato YYYY-MM-DD
  if (dateValue instanceof Date) {
    const year = dateValue.getFullYear();
    const month = String(dateValue.getMonth() + 1).padStart(2, '0');
    const day = String(dateValue.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  return null;
}

// Función para normalizar valores null/undefined/vacíos
function normalizeValue(value) {
  if (value === null || value === undefined || value === 'null' || value === 'undefined') return null;
  const trimmed = String(value).trim();
  return trimmed === '' ? null : trimmed;
}

// Función para normalizar valores numéricos
function normalizeNumber(value) {
  if (value === null || value === undefined || value === 'null' || value === 'undefined') return null;
  const trimmed = String(value).trim();
  if (trimmed === '' || trimmed === '0') return null;
  
  const num = parseFloat(trimmed);
  return isNaN(num) ? null : num;
}

async function fetchOrderFilesFromNetwork() {
  try {
    // Usar el servicio centralizado para obtener la ruta del archivo
    const inputPath = await getNetworkFilePath('FAC_HDR_SOFTKEY.txt');
    console.log('Ruta del archivo:', inputPath);
    
    console.log('Intentando leer archivo desde:', inputPath);
    const content = fs.readFileSync(inputPath, 'latin1');

    const records = parse(content, {
      delimiter: ';',
      columns: true,
      skip_empty_lines: true,
      relax_quotes: true,
      relax_column_count: true,
      skip_records_with_error: true
    });

    console.log(`Total de registros parseados: ${records.length}`);
    
    // Agregar columna 'linea' a cada registro
    const recordsWithLinea = records.map((record, index) => {
      const pc = record.Nro?.trim();
      const oc = record.OC?.trim();
      const fecha = record.Fecha?.trim();
      
      // Contar cuántas veces aparece esta combinación antes del índice actual
      let linea = 0;
      for (let i = 0; i < index; i++) {
        if (records[i].Nro?.trim() === pc && 
            records[i].OC?.trim() === oc && 
            records[i].Fecha?.trim() === fecha) {
          linea++;
        }
      }
      
      return {
        ...record,
        linea: linea.toString()
      };
    });

    console.log(`Total de registros con linea: ${recordsWithLinea.length}`);
    
    // Guardar CSV en disco para verificación
    const output = stringify(recordsWithLinea, { header: true, delimiter: ';' });
    fs.ensureDirSync('documentos');
    
    // Usar timestamp para evitar conflictos de archivo
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `documentos/FAC_HDR_SOFTKEY_${timestamp}.csv`;
    
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
    const recordsToProcess = recordsWithLinea;
    const totalRecords = recordsToProcess.length;
    
    console.log(`[${new Date().toISOString()}] -> Check Order Process -> Procesando ${totalRecords} registros del CSV`);
    
    // Procesar en lotes de 100 para evitar problemas de memoria y timeout
    const batchSize = 100;
    const totalBatches = Math.ceil(totalRecords / batchSize);
    
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const startIndex = batchIndex * batchSize;
      const endIndex = Math.min(startIndex + batchSize, totalRecords);
      const currentBatch = recordsToProcess.slice(startIndex, endIndex);
      
      console.log(`[${new Date().toISOString()}] -> Check Order Process -> Procesando lote ${batchIndex + 1}/${totalBatches} (registros ${startIndex + 1}-${endIndex})`);
      
      for (const record of currentBatch) {
      try {
        procesados++;
        
        // Validaciones para campos críticos
        if (!record.Nro?.trim() || !record.OC?.trim() || !record.Fecha?.trim()) {
          console.log(`[${new Date().toISOString()}] -> Check Order Process -> Registro omitido: PC=${record.Nro?.trim() || 'N/A'}, OC=${record.OC?.trim() || 'N/A'} - Motivo: Campos críticos faltantes`);
          omitidos++;
          continue;
        }

        // Extraer campos para unique_key
        const pc = record.Nro.trim();
        const oc = record.OC.trim();
        const fechaIngreso = record.Fecha.trim().replace(/-/g, ''); // Quitar guiones
        const linea = record.linea?.trim() || '0';
        
        // Generar unique_key usando SHA corto con linea
        const uniqueKey = generateShortHash(`${pc}-${oc}-${fechaIngreso}-${linea}`);
        
        // Extraer RUT del cliente (campo Rut del CSV)
        let customerRut = record.Rut?.trim();
        
        if (!customerRut) {
          console.log(`[${new Date().toISOString()}] -> Check Order Process -> Registro omitido: PC=${pc}, OC=${oc} - Motivo: Sin RUT`);
          omitidos++;
          continue;
        }

        // Remover la C final si existe
        customerRut = customerRut.replace(/C$/, '');

        // Buscar el cliente en la base de datos
        const customer = await getCustomerByRut(customerRut);
        if (!customer) {
          console.log(`[${new Date().toISOString()}] -> Check Order Process -> Registro omitido: PC=${pc}, OC=${oc} - Motivo: Cliente no encontrado (RUT: ${customerRut})`);
          omitidos++;
          continue;
        }

        // Buscar orden existente por unique_key
        const existingOrder = await getOrderByUniqueKey(uniqueKey);
        
        if (!existingOrder) {
          // NUEVA ORDEN - Insertar
          const orderId = await insertOrder({
            customer_id: customer.id,
            rut: customerRut,
            pc: pc,
            oc: oc,
            factura: normalizeValue(record.Factura?.trim()),
            fecha_factura: normalizeDate(record.Fecha_factura?.trim()),
            fecha_ingreso: normalizeDate(record.Fecha?.trim()),
            linea: parseInt(linea),
            unique_key: uniqueKey,
            created_at: new Date(),
            updated_at: new Date()
          });

          // Insertar order detail
          await createOrderDetail(orderId, {
            fecha: normalizeDate(record.Fecha?.trim()),
            tipo: normalizeValue(record.Tipo?.trim()),
            incoterm: normalizeValue(record.Clausula?.trim()),
            currency: normalizeValue(record.Job?.trim()),
            direccion_destino: normalizeValue(record.Direccion?.trim()),
            direccion_alterna: normalizeValue(record.Direccion_Alterna?.trim()),
            puerto_embarque: normalizeValue(record.Puerto_Embarque?.trim()),
            puerto_destino: normalizeValue(record.Puerto_Destino?.trim()),
            fecha_eta: normalizeDate(record.ETA_OV?.trim()),
            fecha_etd: normalizeDate(record.ETD_OV?.trim()),
            certificados: normalizeValue(record.Certificados?.trim()),
            estado_ov: normalizeValue(record.EstadoOV?.trim()),
            medio_envio_factura: normalizeValue(record.MedioDeEnvioFact?.trim()),
            gasto_adicional_flete: normalizeDecimal(record.GtoAdicFlete?.trim(), 4),
            fecha_incoterm: normalizeDate(record.FechaOriginalCompromisoCliente?.trim()),
            localizacion: normalizeValue(record.Localizacion?.trim()),
            codigo_impuesto: normalizeValue(record.Cod_Impto?.trim()),
            vendedor: normalizeValue(record.Vendedor?.trim()),
            nave: normalizeValue(record.Nave?.trim()),
            condicion_venta: normalizeValue(record.Condicion_venta?.trim()),
            linea: parseInt(linea),
            unique_key: uniqueKey,
            created_at: new Date(),
            updated_at: new Date()
          });
          
          // Insertar en tabla new_orders para procesamiento posterior
          await insertNewOrderRecord(orderId);
          
          console.log(`[${new Date().toISOString()}] -> Check Order Process -> NUEVA ORDEN insertada: PC=${pc}, OC=${oc}, unique_key=${uniqueKey}`);
          insertados++;
        } else {
          // ORDEN EXISTENTE - Verificar si hay cambios
          const hasOrderChanges = await compareOrderFields(existingOrder, record);
          
          // También verificar cambios en order_detail
          const existingDetail = await getOrderDetailByOrderId(existingOrder.id);
          const hasDetailChanges = existingDetail ? await compareOrderDetailFields(existingDetail, record) : false;
          
          if (hasOrderChanges || hasDetailChanges) {
            // ACTUALIZAR orden
            await updateOrder(existingOrder.id, {
              customer_id: customer.id,
              rut: customerRut,
              pc: pc,
              oc: oc,
              factura: normalizeValue(record.Factura?.trim()),
              fecha_factura: normalizeDate(record.Fecha_factura?.trim()),
              fecha_ingreso: normalizeDate(record.Fecha?.trim()),
              linea: parseInt(linea),
              unique_key: uniqueKey,
              updated_at: new Date()
            });

            // ACTUALIZAR order detail
            await updateOrderDetail(existingOrder.id, {
              fecha: normalizeDate(record.Fecha?.trim()),
              tipo: normalizeValue(record.Tipo?.trim()),
              incoterm: normalizeValue(record.Clausula?.trim()),
              currency: normalizeValue(record.Job?.trim()),
              direccion_destino: normalizeValue(record.Direccion?.trim()),
              direccion_alterna: normalizeValue(record.Direccion_Alterna?.trim()),
              puerto_embarque: normalizeValue(record.Puerto_Embarque?.trim()),
              puerto_destino: normalizeValue(record.Puerto_Destino?.trim()),
              fecha_eta: normalizeDate(record.ETA_OV?.trim()),
              fecha_etd: normalizeDate(record.ETD_OV?.trim()),
              certificados: normalizeValue(record.Certificados?.trim()),
              estado_ov: normalizeValue(record.EstadoOV?.trim()),
              medio_envio_factura: normalizeValue(record.MedioDeEnvioFact?.trim()),
              gasto_adicional_flete: normalizeDecimal(record.GtoAdicFlete?.trim(), 4),
              fecha_incoterm: normalizeDate(record.FechaOriginalCompromisoCliente?.trim()),
              localizacion: normalizeValue(record.Localizacion?.trim()),
              codigo_impuesto: normalizeValue(record.Cod_Impto?.trim()),
              vendedor: normalizeValue(record.Vendedor?.trim()),
              nave: normalizeValue(record.Nave?.trim()),
              condicion_venta: normalizeValue(record.Condicion_venta?.trim()),
              linea: parseInt(linea),
              unique_key: uniqueKey,
              updated_at: new Date()
            });
            
            console.log(`[${new Date().toISOString()}] -> Check Order Process -> ORDEN ACTUALIZADA: PC=${pc}, OC=${oc}, unique_key=${uniqueKey}`);
            insertados++;
          } else {
            console.log(`[${new Date().toISOString()}] -> Check Order Process -> ORDEN SIN CAMBIOS: PC=${pc}, OC=${oc}, unique_key=${uniqueKey}`);
            omitidos++;
          }
        }
      } catch (error) {
        console.error(`[${new Date().toISOString()}] -> Check Order Process -> Error procesando orden:`, error.message);
        errores++;
      }
      }
      
      // Log de progreso del lote
      console.log(`[${new Date().toISOString()}] -> Check Order Process -> Lote ${batchIndex + 1}/${totalBatches} completado. Progreso: ${procesados}/${totalRecords} registros procesados`);
    }

    console.log(`\n[${new Date().toISOString()}] -> Check Order Process -> RESUMEN DEL PROCESAMIENTO:`);
    console.log(`   • Total procesados: ${procesados}`);
    console.log(`   • Nuevos registros: ${insertados}`);
    console.log(`   • Registros omitidos: ${omitidos}`);
    console.log(`   • Errores: ${errores}`);
    console.log(`\n[${new Date().toISOString()}] -> Check Order Process -> Procesamiento completado exitosamente.`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] -> Check Order Process -> Error obteniendo archivo de red:`, error.message);
    return;
  }
}

// Función para buscar orden por unique_key
async function getOrderByUniqueKey(uniqueKey) {
  const { poolPromise } = require('../config/db');
  const pool = await poolPromise;
  
  try {
    const [rows] = await pool.query(
      'SELECT * FROM orders WHERE unique_key = ?',
      [uniqueKey]
    );
    return rows[0] || null;
  } catch (error) {
    console.error('Error buscando orden por unique_key:', error);
    return null;
  }
}

// Función para buscar order_detail por order_id
async function getOrderDetailByOrderId(orderId) {
  const { poolPromise } = require('../config/db');
  const pool = await poolPromise;
  
  try {
    const [rows] = await pool.query(
      'SELECT * FROM order_detail WHERE order_id = ?',
      [orderId]
    );
    return rows[0] || null;
  } catch (error) {
    console.error('Error buscando order_detail por order_id:', error);
    return null;
  }
}

// Función para comparar campos de orden
async function compareOrderFields(existingOrder, newRecord) {
  const fieldsToCompare = [
    'factura', 'fecha_factura', 'fecha_ingreso'
  ];
  
  for (const field of fieldsToCompare) {
    const existingValue = existingOrder[field];
    let newValue;
    
    // Mapear campos del CSV a campos de BD
    if (field === 'factura') {
      newValue = normalizeNumber(newRecord.Factura?.trim());
    } else if (field === 'fecha_factura') {
      newValue = normalizeDate(newRecord.Fecha_factura?.trim());
    } else if (field === 'fecha_ingreso') {
      newValue = normalizeDate(newRecord.Fecha?.trim());
    }
    
    // Normalizar el valor existente también para comparación
    let normalizedExistingValue;
    if (field === 'fecha_factura' || field === 'fecha_ingreso') {
      normalizedExistingValue = normalizeExistingValue(existingValue, 'date');
    } else if (field === 'factura') {
      normalizedExistingValue = normalizeExistingValue(existingValue, 'number');
    } else {
      normalizedExistingValue = normalizeExistingValue(existingValue, 'string');
    }
    
    if (normalizedExistingValue !== newValue) {
      console.log(`Campo ${field} cambió: ${normalizedExistingValue} -> ${newValue}`);
      return true;
    }
  }
  
  return false;
}

// Función para comparar campos de order_detail
async function compareOrderDetailFields(existingDetail, newRecord) {
  const fieldsToCompare = [
    'fecha', 'tipo', 'incoterm', 'currency', 'direccion_destino', 
    'direccion_alterna', 'puerto_embarque', 'puerto_destino', 
    'fecha_eta', 'fecha_etd', 'certificados', 'estado_ov', 
    'medio_envio_factura', 'gasto_adicional_flete', 'fecha_incoterm', 
    'localizacion', 'codigo_impuesto', 'vendedor', 'nave', 'condicion_venta'
  ];
  
  for (const field of fieldsToCompare) {
    const existingValue = existingDetail[field];
    let newValue;
    
    // Mapear campos del CSV a campos de BD
    if (field === 'fecha') {
      newValue = normalizeDate(newRecord.Fecha?.trim());
    } else if (field === 'tipo') {
      newValue = normalizeValue(newRecord.Tipo?.trim());
    } else if (field === 'incoterm') {
      newValue = normalizeValue(newRecord.Clausula?.trim());
    } else if (field === 'currency') {
      newValue = normalizeValue(newRecord.Job?.trim());
    } else if (field === 'direccion_destino') {
      newValue = normalizeValue(newRecord.Direccion?.trim());
    } else if (field === 'direccion_alterna') {
      newValue = normalizeValue(newRecord.Direccion_Alterna?.trim());
    } else if (field === 'puerto_embarque') {
      newValue = normalizeValue(newRecord.Puerto_Embarque?.trim());
    } else if (field === 'puerto_destino') {
      newValue = normalizeValue(newRecord.Puerto_Destino?.trim());
    } else if (field === 'fecha_eta') {
      newValue = normalizeDate(newRecord.ETA_OV?.trim());
    } else if (field === 'fecha_etd') {
      newValue = normalizeDate(newRecord.ETD_OV?.trim());
    } else if (field === 'certificados') {
      newValue = normalizeValue(newRecord.Certificados?.trim());
    } else if (field === 'estado_ov') {
      newValue = normalizeValue(newRecord.EstadoOV?.trim());
    } else if (field === 'medio_envio_factura') {
      newValue = normalizeValue(newRecord.MedioDeEnvioFact?.trim());
    } else if (field === 'gasto_adicional_flete') {
      newValue = normalizeDecimal(newRecord.GtoAdicFlete?.trim(), 4);
    } else if (field === 'kg_solicitados' || field === 'kg_planificados' || field === 'kg_programados' || 
               field === 'kg_despachados' || field === 'kg_fabricados' || field === 'kg_facturados' || 
               field === 'unit_price' || field === 'volumen') {
      // Mapear campos del CSV a campos de BD para decimales
      let csvField = '';
      if (field === 'kg_solicitados') csvField = newRecord.Cant_ordenada;
      else if (field === 'kg_planificados') csvField = newRecord.Cant_planificada;
      else if (field === 'kg_programados') csvField = newRecord.Cant_programada;
      else if (field === 'kg_despachados') csvField = newRecord.Cant_enviada;
      else if (field === 'kg_fabricados') csvField = newRecord.Cant_fabricada;
      else if (field === 'kg_facturados') csvField = newRecord.KilosFacturados;
      else if (field === 'unit_price') csvField = newRecord.Precio_Unit;
      else if (field === 'volumen') csvField = newRecord.Volumen;
      
      newValue = normalizeDecimal(csvField?.trim(), 4);
    } else if (field === 'fecha_incoterm') {
      newValue = normalizeDate(newRecord.FechaOriginalCompromisoCliente?.trim());
    } else if (field === 'localizacion') {
      newValue = normalizeValue(newRecord.Localizacion?.trim());
    } else if (field === 'codigo_impuesto') {
      newValue = normalizeValue(newRecord.Cod_Impto?.trim());
    } else if (field === 'vendedor') {
      newValue = normalizeNumber(newRecord.Vendedor?.trim());
    } else if (field === 'nave') {
      newValue = normalizeValue(newRecord.Nave?.trim());
    } else if (field === 'condicion_venta') {
      newValue = normalizeValue(newRecord.Condicion_venta?.trim());
    }
    
    // Normalizar el valor existente también para comparación
    let normalizedExistingValue;
    if (field === 'fecha' || field === 'fecha_eta' || field === 'fecha_etd' || field === 'fecha_incoterm') {
      normalizedExistingValue = normalizeExistingValue(existingValue, 'date');
    } else if (field === 'gasto_adicional_flete' || field === 'kg_solicitados' || field === 'kg_planificados' || 
               field === 'kg_programados' || field === 'kg_despachados' || field === 'kg_fabricados' || 
               field === 'kg_facturados' || field === 'unit_price' || field === 'volumen') {
      normalizedExistingValue = normalizeDecimal(existingValue, 4);
    } else if (field === 'vendedor') {
      normalizedExistingValue = normalizeExistingValue(existingValue, 'number');
    } else {
      normalizedExistingValue = normalizeExistingValue(existingValue, 'string');
    }
    
    if (normalizedExistingValue !== newValue) {
      console.log(`Campo ${field} cambió: ${normalizedExistingValue} -> ${newValue}`);
      return true;
    }
  }
  
  return false;
}

// Funciones de normalización
function normalizeValue(value) {
  if (!value || value === '' || value === 'null' || value === 'NULL') {
    return null;
  }
  return value;
}

// Función para normalizar valores existentes de la BD
function normalizeExistingValue(value) {
  if (!value || value === '' || value === 'null' || value === 'NULL') {
    return null;
  }
  return value;
}

function normalizeDate(value) {
  if (!value || value === '' || value === 'null' || value === 'NULL') {
    return null;
  }
  
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
    const dateOnly = value.split(' ')[0];
    
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

function normalizeNumber(value) {
  if (!value || value === '' || value === 'null' || value === 'NULL') {
    return null;
  }
  return parseFloat(value.replace(',', '.')) || null;
}

// Función para normalizar decimales con precisión específica
function normalizeDecimal(value, decimals = 2) {
  if (!value || value === '' || value === 'null' || value === 'NULL') {
    return null;
  }
  const parsed = parseFloat(value.replace(',', '.'));
  if (isNaN(parsed)) return null;
  return parseFloat(parsed.toFixed(decimals));
}

// Función para normalizar valores existentes de la BD (números y fechas)
function normalizeExistingValue(value, fieldType = 'string') {
  if (!value || value === '' || value === 'null' || value === 'NULL') {
    return null;
  }
  
  if (fieldType === 'date') {
    return normalizeDate(value);
  } else if (fieldType === 'number') {
    return parseFloat(value) || null;
  }
  
  // Para strings, normalizar usando la misma función que el CSV
  return normalizeValue(value);
}

// Función para actualizar orden
async function updateOrder(orderId, orderData) {
  const { poolPromise } = require('../config/db');
  const pool = await poolPromise;
  
  try {
    const fields = Object.keys(orderData).map(key => `${key} = ?`).join(', ');
    const values = Object.values(orderData);
    values.push(orderId);
    
    await pool.query(
      `UPDATE orders SET ${fields} WHERE id = ?`,
      values
    );
  } catch (error) {
    console.error('Error actualizando orden:', error);
    throw error;
  }
}

// Función para actualizar order detail
async function updateOrderDetail(orderId, detailData) {
  const { poolPromise } = require('../config/db');
  const pool = await poolPromise;
  
  try {
    const fields = Object.keys(detailData).map(key => `${key} = ?`).join(', ');
    const values = Object.values(detailData);
    values.push(orderId);
    
    await pool.query(
      `UPDATE order_detail SET ${fields} WHERE order_id = ?`,
      values
    );
  } catch (error) {
    console.error('Error actualizando order detail:', error);
    throw error;
  }
}

// Función para insertar orden nueva en tabla new_orders
async function insertNewOrderRecord(orderId) {
  try {
    const pool = await poolPromise;
    await pool.query('INSERT INTO new_orders (order_id) VALUES (?)', [orderId]);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] -> New Order Record -> Error insertando orden ${orderId} en new_orders:`, error.message);
    // No lanzar error para no interrumpir el proceso principal
  }
}

module.exports = {
  fetchOrderFilesFromNetwork
}; 