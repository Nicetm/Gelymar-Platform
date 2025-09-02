const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');
const { getCustomerByRut } = require('./customer.service');
const { insertOrder, getAllExistingOrders, updateOrderByPc, getOrderIdByPc } = require('./order.service');
const { insertOrderDetail, getOrderDetailByOrderId, createOrUpdateOrderDetail } = require('./orderDetail.service');
const { poolPromise } = require('../config/db');
const crypto = require('crypto');

require('dotenv').config();

// Funciones para csv_processing_tracking
async function insertCsvTracking(orderId, ordersHash, orderDetailHash, fileTimestamp) {
  const pool = await poolPromise;
  await pool.query(`
    INSERT INTO csv_processing_tracking (order_id, orders_hash, order_detail_hash, csv_file_timestamp, last_processed_at)
    VALUES (?, ?, ?, ?, NOW())
  `, [orderId, ordersHash, orderDetailHash, fileTimestamp]);
}

async function updateCsvTracking(orderId, ordersHash, orderDetailHash, fileTimestamp) {
  const pool = await poolPromise;
  await pool.query(`
    UPDATE csv_processing_tracking 
    SET orders_hash = ?, order_detail_hash = ?, csv_file_timestamp = ?, last_processed_at = NOW()
    WHERE order_id = ?
  `, [ordersHash, orderDetailHash, fileTimestamp, orderId]);
}

async function fetchOrderFilesFromNetwork() {
  const inputPath = 'Z:\\FAC_HDR_SOFTKEY.txt';
  console.log('Ruta del archivo:', inputPath);

  if (!fs.existsSync(inputPath)) {
    console.error('Archivo no disponible en Z:\\FAC_HDR_SOFTKEY.txt');
    console.log('Conéctate manualmente a la red compartida antes de ejecutar el cron');
    return;
  }

  try {
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

    // Obtener órdenes existentes
    const existingOrders = await getAllExistingOrders();
    console.log(`Órdenes ya existentes en BD: ${existingOrders.length}`);

    // Obtener timestamp del archivo para comparación
    const fileStats = fs.statSync(inputPath);
    const fileTimestamp = fileStats.mtime;

    let procesados = 0;
    let insertados = 0;
    let actualizados = 0;
    let omitidos = 0;
    let errores = 0;

    for (const record of records) {
      try {
        procesados++;
        
        // Extraer RUT del cliente (campo Rut del CSV)
        let customerRut = record.Rut?.trim();
        
        if (!customerRut) {
          console.log(`Registro omitido: PC=${record.Nro || 'N/A'}, OC=${record.OC?.trim() || 'N/A'} - Motivo: Sin RUT`);
          omitidos++;
          continue;
        }

        // Remover la C final si existe
        customerRut = customerRut.replace(/C$/, '');

        // Extraer número de orden (campo Nro del CSV)
        const orderNumber = record.Nro?.trim();
        
        if (!orderNumber) {
          console.log(`Registro omitido: PC=N/A, OC=${record.OC?.trim() || 'N/A'} - Motivo: Sin Número de Orden`);
          omitidos++;
          continue;
        }

        // Verificar si la orden ya existe
        const orderKey = `${orderNumber}-${record.OC?.trim() || ''}-${record.Factura?.trim() || ''}`;
        const existingOrder = existingOrders.find(o => o.key === orderKey);
        
        if (existingOrder) {
          // Calcular hashes separados para orders y order_detail
          const ordersHash = crypto.createHash('md5')
            .update(JSON.stringify({
              rut: customerRut,
              nro: orderNumber,
              factura: record.Factura?.trim() || '',
              fecha_factura: record.Fecha_factura?.trim() || '',
              oc: record.OC?.trim() || ''
            }))
            .digest('hex');

          const orderDetailHash = crypto.createHash('md5')
            .update(JSON.stringify({
              fecha: record.Fecha?.trim() || '',
              tipo: record.Tipo?.trim() || '',
              clausula: record.Clausula?.trim() || '',
              job: record.Job?.trim() || '',
              direccion: record.Direccion?.trim() || '',
              direccion_alterna: record.Direccion_Alterna?.trim() || '',
              puerto_embarque: record.Puerto_Embarque?.trim() || '',
              puerto_destino: record.Puerto_Destino?.trim() || '',
              eta_ov: record.ETA_OV?.trim() || '',
              etd_ov: record.ETD_OV?.trim() || '',
              certificados: record.Certificados?.trim() || '',
              estado_ov: record.EstadoOV?.trim() || '',
              medio_envio_factura: record.MedioDeEnvioFact?.trim() || '',
              gasto_adicional_flete: record.GtoAdicFlete?.trim() || '',
              localizacion: record.Localizacion?.trim() || '',
              codigo_impuesto: record.Cod_Impto?.trim() || '',
              vendedor: record.Vendedor?.trim() || '',
              nave: record.Nave?.trim() || '',
              condicion_venta: record.Condicion_venta?.trim() || ''
            }))
            .digest('hex');

          // Verificar si hay cambios
          const hasChanges = ordersHash !== existingOrder.csv_row_hash || 
                           fileTimestamp > existingOrder.csv_file_timestamp;

          if (hasChanges) {
            // Extraer campos del archivo
            const factura = record.Factura?.trim() || '';
            const fecFactura = record.Fecha_factura?.trim() || '';
            const oc = record.OC?.trim() || '';

            // Actualizar orden
            await updateOrderByPc(orderNumber, {
              factura: factura,
              fecha_factura: fecFactura && fecFactura !== '0' ? fecFactura : null,
              csv_row_hash: ordersHash,
              csv_file_timestamp: fileTimestamp
            });

            // Obtener order_id para actualizar order detail
            const orderId = await getOrderIdByPc(orderNumber, oc, factura);
            
            // Actualizar order detail
            await createOrUpdateOrderDetail(orderId, {
              fecha: record.Fecha?.trim() || null,
              tipo: record.Tipo?.trim() || null,
              incoterm: record.Clausula?.trim() || null,
              currency: record.Job?.trim() || null,
              direccion_destino: record.Direccion?.trim() || null,
              direccion_alterna: record.Direccion_Alterna?.trim() || null,
              puerto_embarque: record.Puerto_Embarque?.trim() || null,
              puerto_destino: record.Puerto_Destino?.trim() || null,
              fecha_eta: record.ETA_OV && record.ETA_OV.trim() !== '' ? record.ETA_OV.trim() : null,
              fecha_etd: record.ETD_OV && record.ETD_OV.trim() !== '' ? record.ETD_OV.trim() : null,
              certificados: record.Certificados?.trim() || null,
              estado_ov: record.EstadoOV?.trim() || null,
              medio_envio_factura: record.MedioDeEnvioFact?.trim() || null,
              gasto_adicional_flete: record.GtoAdicFlete?.trim() || null,
              localizacion: record.Localizacion?.trim() || null,
              codigo_impuesto: record.Cod_Impto?.trim() || null,
              vendedor: record.Vendedor?.trim() || null,
              nave: record.Nave?.trim() || null,
              condicion_venta: record.Condicion_venta?.trim() || null,
              csv_row_hash: orderDetailHash,
              csv_file_timestamp: fileTimestamp
            });

            // Actualizar en csv_processing_tracking
            await updateCsvTracking(orderId, ordersHash, orderDetailHash, fileTimestamp);

            // Identificar qué campos cambiaron en orders
            const cambiosOrders = [];
            if (existingOrder.rut !== customerRut) cambiosOrders.push(`rut: ${existingOrder.rut || 'null'} → ${customerRut}`);
            if (existingOrder.pc !== orderNumber) cambiosOrders.push(`pc: ${existingOrder.pc || 'null'} → ${orderNumber}`);
            if (existingOrder.oc !== oc) cambiosOrders.push(`oc: ${existingOrder.oc || 'null'} → ${oc}`);
            if (existingOrder.factura !== factura) cambiosOrders.push(`factura: ${existingOrder.factura || 'null'} → ${factura}`);
            if (existingOrder.fecha_factura !== (fecFactura && fecFactura !== '0' ? fecFactura : null)) cambiosOrders.push(`fecha_factura: ${existingOrder.fecha_factura || 'null'} → ${fecFactura && fecFactura !== '0' ? fecFactura : null}`);
            
            // Identificar qué campos cambiaron en order_detail
            const cambiosOrderDetail = [];
            if (record.Fecha?.trim() !== existingOrder.fecha) cambiosOrderDetail.push(`fecha: ${existingOrder.fecha || 'null'} → ${record.Fecha?.trim() || 'null'}`);
            if (record.Tipo?.trim() !== existingOrder.tipo) cambiosOrderDetail.push(`tipo: ${existingOrder.tipo || 'null'} → ${record.Tipo?.trim() || 'null'}`);
            if (record.Clausula?.trim() !== existingOrder.incoterm) cambiosOrderDetail.push(`incoterm: ${existingOrder.incoterm || 'null'} → ${record.Clausula?.trim() || 'null'}`);
            if (record.Job?.trim() !== existingOrder.currency) cambiosOrderDetail.push(`currency: ${existingOrder.currency || 'null'} → ${record.Job?.trim() || 'null'}`);
            if (record.Direccion?.trim() !== existingOrder.direccion_destino) cambiosOrderDetail.push(`direccion_destino: ${existingOrder.direccion_destino || 'null'} → ${record.Direccion?.trim() || 'null'}`);
            if (record.Direccion_Alterna?.trim() !== existingOrder.direccion_alterna) cambiosOrderDetail.push(`direccion_alterna: ${existingOrder.direccion_alterna || 'null'} → ${record.Direccion_Alterna?.trim() || 'null'}`);
            if (record.Puerto_Embarque?.trim() !== existingOrder.puerto_embarque) cambiosOrderDetail.push(`puerto_embarque: ${existingOrder.puerto_embarque || 'null'} → ${record.Puerto_Embarque?.trim() || 'null'}`);
            if (record.Puerto_Destino?.trim() !== existingOrder.puerto_destino) cambiosOrderDetail.push(`puerto_destino: ${existingOrder.puerto_destino || 'null'} → ${record.Puerto_Destino?.trim() || 'null'}`);
            if (record.ETA_OV?.trim() !== existingOrder.fecha_eta) cambiosOrderDetail.push(`fecha_eta: ${existingOrder.fecha_eta || 'null'} → ${record.ETA_OV?.trim() || 'null'}`);
            if (record.ETD_OV?.trim() !== existingOrder.fecha_etd) cambiosOrderDetail.push(`fecha_etd: ${existingOrder.fecha_etd || 'null'} → ${record.ETD_OV?.trim() || 'null'}`);
            if (record.Certificados?.trim() !== existingOrder.certificados) cambiosOrderDetail.push(`certificados: ${existingOrder.certificados || 'null'} → ${record.Certificados?.trim() || 'null'}`);
            if (record.EstadoOV?.trim() !== existingOrder.estado_ov) cambiosOrderDetail.push(`estado_ov: ${existingOrder.estado_ov || 'null'} → ${record.EstadoOV?.trim() || 'null'}`);
            if (record.MedioDeEnvioFact?.trim() !== existingOrder.medio_envio_factura) cambiosOrderDetail.push(`medio_envio_factura: ${existingOrder.medio_envio_factura || 'null'} → ${record.MedioDeEnvioFact?.trim() || 'null'}`);
            if (record.GtoAdicFlete?.trim() !== existingOrder.gasto_adicional_flete) cambiosOrderDetail.push(`gasto_adicional_flete: ${existingOrder.gasto_adicional_flete || 'null'} → ${record.GtoAdicFlete?.trim() || 'null'}`);
            if (record.Localizacion?.trim() !== existingOrder.localizacion) cambiosOrderDetail.push(`localizacion: ${existingOrder.localizacion || 'null'} → ${record.Localizacion?.trim() || 'null'}`);
            if (record.Cod_Impto?.trim() !== existingOrder.codigo_impuesto) cambiosOrderDetail.push(`codigo_impuesto: ${existingOrder.codigo_impuesto || 'null'} → ${record.Cod_Impto?.trim() || 'null'}`);
            if (record.Vendedor?.trim() !== existingOrder.vendedor) cambiosOrderDetail.push(`vendedor: ${existingOrder.vendedor || 'null'} → ${record.Vendedor?.trim() || 'null'}`);
            if (record.Nave?.trim() !== existingOrder.nave) cambiosOrderDetail.push(`nave: ${existingOrder.nave || 'null'} → ${record.Nave?.trim() || 'null'}`);
            if (record.Condicion_venta?.trim() !== existingOrder.condicion_venta) cambiosOrderDetail.push(`condicion_venta: ${existingOrder.condicion_venta || 'null'} → ${record.Condicion_venta?.trim() || 'null'}`);
            
            const cambios = [...cambiosOrders];
            if (cambiosOrderDetail.length > 0) cambios.push(`order_detail: ${cambiosOrderDetail.join(', ')}`);
            
            console.log(`Registro actualizado: PC=${orderNumber}, OC=${oc} - Cambios: ${cambios.join(', ')}`);
            actualizados++;
          } else {
            console.log(`Registro omitido: PC=${orderNumber}, OC=${record.OC?.trim() || 'N/A'} - Motivo: Sin cambios`);
            omitidos++;
          }
          continue;
        }

        // Buscar el cliente en la base de datos
        const customer = await getCustomerByRut(customerRut);
        if (!customer) {
          console.log(`Registro omitido: PC=${orderNumber}, OC=${record.OC?.trim() || 'N/A'} - Motivo: Cliente no encontrado`);
          omitidos++;
          continue;
        }

        // Extraer campos del archivo
        const factura = record.Factura?.trim() || '';
        const fecFactura = record.Fecha_factura?.trim() || '';
        const oc = record.OC?.trim() || '';

        // Calcular hashes separados para orders y order_detail
        const ordersHash = crypto.createHash('md5')
          .update(JSON.stringify({
            rut: customerRut,
            nro: orderNumber,
            factura: record.Factura?.trim() || '',
            fecha_factura: record.Fecha_factura?.trim() || '',
            oc: record.OC?.trim() || ''
          }))
          .digest('hex');

        const orderDetailHash = crypto.createHash('md5')
          .update(JSON.stringify({
            fecha: record.Fecha?.trim() || '',
            tipo: record.Tipo?.trim() || '',
            clausula: record.Clausula?.trim() || '',
            job: record.Job?.trim() || '',
            direccion: record.Direccion?.trim() || '',
            direccion_alterna: record.Direccion_Alterna?.trim() || '',
            puerto_embarque: record.Puerto_Embarque?.trim() || '',
            puerto_destino: record.Puerto_Destino?.trim() || '',
            eta_ov: record.ETA_OV?.trim() || '',
            etd_ov: record.ETD_OV?.trim() || '',
            certificados: record.Certificados?.trim() || '',
            estado_ov: record.EstadoOV?.trim() || '',
            medio_envio_factura: record.MedioDeEnvioFact?.trim() || '',
            gasto_adicional_flete: record.GtoAdicFlete?.trim() || '',
            localizacion: record.Localizacion?.trim() || '',
            codigo_impuesto: record.Cod_Impto?.trim() || '',
            vendedor: record.Vendedor?.trim() || '',
            nave: record.Nave?.trim() || '',
            condicion_venta: record.Condicion_venta?.trim() || ''
          }))
          .digest('hex');

        // Insertar la orden con hash
        const orderId = await insertOrder({
          customer_id: customer.id,
          rut: customerRut,
          pc: orderNumber,
          oc: oc,
          factura: factura,
          fecha_factura: fecFactura && fecFactura !== '0' ? fecFactura : null,
          csv_row_hash: ordersHash,
          csv_file_timestamp: fileTimestamp
        });

        // Insertar order detail
        await createOrUpdateOrderDetail(orderId, {
          fecha: record.Fecha?.trim() || null,
          tipo: record.Tipo?.trim() || null,
          incoterm: record.Clausula?.trim() || null,
          currency: record.Job?.trim() || null,
          direccion_destino: record.Direccion?.trim() || null,
          direccion_alterna: record.Direccion_Alterna?.trim() || null,
          puerto_embarque: record.Puerto_Embarque?.trim() || null,
          puerto_destino: record.Puerto_Destino?.trim() || null,
          fecha_eta: record.ETA_OV && record.ETA_OV.trim() !== '' ? record.ETA_OV.trim() : null,
          fecha_etd: record.ETD_OV && record.ETD_OV.trim() !== '' ? record.ETD_OV.trim() : null,
          certificados: record.Certificados?.trim() || null,
          estado_ov: record.EstadoOV?.trim() || null,
          medio_envio_factura: record.MedioDeEnvioFact?.trim() || null,
          gasto_adicional_flete: record.GtoAdicFlete?.trim() || null,
          localizacion: record.Localizacion?.trim() || null,
          codigo_impuesto: record.Cod_Impto?.trim() || null,
          vendedor: record.Vendedor?.trim() || null,
          nave: record.Nave?.trim() || null,
          condicion_venta: record.Condicion_venta?.trim() || null,
          csv_row_hash: orderDetailHash,
          csv_file_timestamp: fileTimestamp
        });

        // Insertar en csv_processing_tracking
        await insertCsvTracking(orderId, ordersHash, orderDetailHash, fileTimestamp);
        
        console.log(`Registro insertado #${insertados + 1}: PC=${orderNumber}, OC=${oc}`);
        insertados++;
      } catch (error) {
        console.error(`Error procesando orden:`, error.message);
        errores++;
      }
    }

    console.log(`Procesamiento completado. Procesados: ${procesados}, Insertados: ${insertados}, Actualizados: ${actualizados}, Omitidos: ${omitidos}, Errores: ${errores}`);
  } catch (error) {
    console.error('Error procesando archivo de órdenes:', error);
  }
}

module.exports = {
  fetchOrderFilesFromNetwork
}; 