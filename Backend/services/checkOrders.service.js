const fs = require('fs-extra');
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');
const { getCustomerByRut } = require('./customer.service');
const { insertOrder } = require('./order.service');
const { createOrderDetail } = require('./orderDetail.service');
const { getNetworkFilePath } = require('./networkMount.service');

// Las variables de entorno ya se cargan automáticamente en app.js

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
    
    // Guardar CSV en disco para verificación
    const output = stringify(records, { header: true, delimiter: ';' });
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
    const recordsToProcess = records;
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
        if (!record.Nro?.trim() || !record.OC?.trim()) {
          console.log(`[${new Date().toISOString()}] -> Check Order Process -> Registro omitido: PC=${record.Nro?.trim() || 'N/A'}, OC=${record.OC?.trim() || 'N/A'} - Motivo: Campos críticos faltantes`);
          omitidos++;
          continue;
        }

        // Extraer número de orden (campo Nro del CSV)
        const orderNumber = record.Nro.trim();
        
        // Extraer OC
        const oc = record.OC.trim();
        
        // Extraer RUT del cliente (campo Rut del CSV)
        let customerRut = record.Rut?.trim();
        
        if (!customerRut) {
          console.log(`[${new Date().toISOString()}] -> Check Order Process -> Registro omitido: PC=${orderNumber}, OC=${oc} - Motivo: Sin RUT`);
          omitidos++;
          continue;
        }

        // Remover la C final si existe
        customerRut = customerRut.replace(/C$/, '');

        // Buscar el cliente en la base de datos
        const customer = await getCustomerByRut(customerRut);
        if (!customer) {
          console.log(`[${new Date().toISOString()}] -> Check Order Process -> Registro omitido: PC=${orderNumber}, OC=${oc} - Motivo: Cliente no encontrado (RUT: ${customerRut})`);
          omitidos++;
          continue;
        }

        // Insertar la orden
        const orderId = await insertOrder({
          customer_id: customer.id,
          rut: customerRut,
          pc: orderNumber,
          oc: oc,
          factura: normalizeValue(record.Factura?.trim()),
          fecha_factura: normalizeDate(record.Fecha_factura?.trim()),
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
          gasto_adicional_flete: normalizeNumber(record.GtoAdicFlete?.trim()),
          fecha_incoterm: normalizeDate(record.FechaOriginalCompromisoCliente?.trim()),
          localizacion: normalizeValue(record.Localizacion?.trim()),
          codigo_impuesto: normalizeValue(record.Cod_Impto?.trim()),
          vendedor: normalizeValue(record.Vendedor?.trim()),
          nave: normalizeValue(record.Nave?.trim()),
          condicion_venta: normalizeValue(record.Condicion_venta?.trim()),
          created_at: new Date(),
          updated_at: new Date()
        });
        
        console.log(`[${new Date().toISOString()}] -> Check Order Process -> insertando fila: PC=${orderNumber}, OC=${oc}, Factura=${record.Factura?.trim() || 'Sin factura'}`);
        insertados++;
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

module.exports = {
  fetchOrderFilesFromNetwork
}; 