const crypto = require('crypto');
const { poolPromise } = require('../config/db');
const { getSqlPool } = require('../config/sqlserver');
const { logger: defaultLogger } = require('../utils/logger');
const { normalizeValue, normalizeDate, normalizeDecimal } = require('../mappers/sqlsoftkey/utils');
const { getAdminNotificationRecipients } = require('./user.service');
const { sendAdminNotificationSummary } = require('./email.service');

const LOG_PREFIX = '[OrderChangeDetection]';

// ---------------------------------------------------------------------------
// Pure utility functions (no dependencies needed)
// ---------------------------------------------------------------------------

/**
 * Normaliza un valor individual para el snapshot.
 * undefined, '', 'null', 'undefined' → null; strings se trimmean.
 */
function normalizeSnapshotValue(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '' || trimmed === 'null' || trimmed === 'undefined') return null;
    return trimmed;
  }
  return value;
}

/**
 * Construye un snapshot normalizado a partir de los datos HDR, FACT e ITEM.
 */
function buildSnapshot(hdrData, factData, itemsData) {
  return {
    fecha_eta: normalizeDate(hdrData.ETA_OV),
    fecha_etd: normalizeDate(hdrData.ETD_OV),
    medio_envio_ov: normalizeValue(hdrData.MedioDeEnvioOV),
    incoterm: normalizeValue(hdrData.Clausula),
    puerto_destino: normalizeValue(hdrData.Puerto_Destino),
    puerto_embarque: normalizeValue(hdrData.Puerto_Embarque),
    estado_ov: normalizeValue(hdrData.EstadoOV),
    certificados: normalizeValue(hdrData.Certificados),
    gasto_adicional_flete: normalizeDecimal(hdrData.GtoAdicFlete, 4),
    fecha_incoterm: normalizeDate(hdrData.FechaOriginalCompromisoCliente),
    condicion_venta: normalizeValue(hdrData.Condicion_venta),
    nave: normalizeValue(hdrData.Nave),
    fecha_eta_factura: normalizeDate(factData?.ETA_ENC_FA),
    fecha_etd_factura: normalizeDate(factData?.ETD_ENC_FA),
    medio_envio_factura: normalizeValue(factData?.MedioDeEnvioFact),
    gasto_adicional_flete_factura: normalizeDecimal(factData?.GtoAdicFleteFactura, 4),
    fecha_factura: normalizeDate(factData?.Fecha_factura),
    items: (itemsData || []).map(item => ({
      linea: item.Linea != null ? Number(item.Linea) : null,
      kg_solicitados: normalizeDecimal(item.Cant_ordenada, 4),
      kg_despachados: normalizeDecimal(item.Cant_enviada, 4),
      kg_facturados: normalizeDecimal(item.KilosFacturados, 4),
      unit_price: normalizeDecimal(item.Precio_Unit, 4),
      fecha_etd: normalizeDate(item.ETD_Item_OV),
      fecha_eta: normalizeDate(item.ETA_Item_OV),
    })).sort((a, b) => (a.linea ?? 0) - (b.linea ?? 0)),
  };
}

/**
 * Serialización determinista: ordena claves en todos los niveles del objeto.
 */
function deterministicStringify(obj) {
  return JSON.stringify(obj, (_key, value) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const sorted = {};
      for (const k of Object.keys(value).sort()) {
        sorted[k] = value[k];
      }
      return sorted;
    }
    return value;
  });
}

/**
 * Calcula el hash SHA-256 de un snapshot serializado de forma determinista.
 */
function computeSnapshotHash(snapshot) {
  const serialized = deterministicStringify(snapshot);
  return crypto.createHash('sha256').update(serialized, 'utf8').digest('hex');
}

/**
 * Compara dos snapshots campo a campo y retorna un array de cambios.
 * Para items, compara por `linea` y reporta como `items[linea].campo`.
 */
function compareSnapshots(oldSnapshot, newSnapshot) {
  const changes = [];

  const scalarKeys = Object.keys(newSnapshot).filter(k => k !== 'items');
  for (const key of scalarKeys) {
    const oldVal = oldSnapshot[key] ?? null;
    const newVal = newSnapshot[key] ?? null;
    if (String(oldVal) !== String(newVal)) {
      changes.push({
        field_name: key,
        old_value: oldVal != null ? String(oldVal) : null,
        new_value: newVal != null ? String(newVal) : null,
      });
    }
  }

  const oldItems = oldSnapshot.items || [];
  const newItems = newSnapshot.items || [];
  const oldItemMap = new Map(oldItems.map(i => [i.linea, i]));
  const newItemMap = new Map(newItems.map(i => [i.linea, i]));

  const allLineas = new Set([...oldItemMap.keys(), ...newItemMap.keys()]);
  for (const linea of allLineas) {
    const oldItem = oldItemMap.get(linea) || {};
    const newItem = newItemMap.get(linea) || {};
    const itemKeys = new Set([
      ...Object.keys(oldItem).filter(k => k !== 'linea'),
      ...Object.keys(newItem).filter(k => k !== 'linea'),
    ]);
    for (const key of itemKeys) {
      const oldVal = oldItem[key] ?? null;
      const newVal = newItem[key] ?? null;
      if (String(oldVal) !== String(newVal)) {
        changes.push({
          field_name: `items[${linea}].${key}`,
          old_value: oldVal != null ? String(oldVal) : null,
          new_value: newVal != null ? String(newVal) : null,
        });
      }
    }
  }

  return changes;
}

// ---------------------------------------------------------------------------
// Factory con inyección de dependencias (mismo patrón que order.service.js)
// ---------------------------------------------------------------------------

const createOrderChangeDetectionService = ({
  mysqlPoolPromise = poolPromise,
  getSqlPoolFn = getSqlPool,
  logger = defaultLogger,
} = {}) => {

  /**
   * Envía correo de notificación a todos los administradores con el resumen de cambios.
   */
  async function notifyAdmins(allChanges) {
    let admins;
    try {
      admins = await getAdminNotificationRecipients();
    } catch (err) {
      logger.error(`${LOG_PREFIX} Error obteniendo admins para notificación: ${err.message}`);
      return;
    }

    if (!admins || admins.length === 0) {
      logger.warn(`${LOG_PREFIX} No hay administradores para notificar`);
      return;
    }

    const lines = [`Se detectaron cambios en ${allChanges.length} orden(es):\n`];
    for (const { pc, factura, changes } of allChanges) {
      const facturaLabel = factura ? `Factura: ${factura}` : 'Sin factura';
      lines.push(`📦 PC: ${pc} | ${facturaLabel}`);
      for (const c of changes) {
        lines.push(`  - ${c.field_name}: ${c.old_value ?? '(vacío)'} → ${c.new_value ?? '(vacío)'}`);
      }
      lines.push('');
    }
    const summaryText = lines.join('\n');
    const portalUrl = process.env.PORTAL_URL || '';

    for (const admin of admins) {
      try {
        await sendAdminNotificationSummary({
          adminEmail: admin.email,
          adminName: admin.name || 'Administrador',
          summaryText,
          portalUrl,
        });
      } catch (err) {
        logger.warn(`${LOG_PREFIX} Error enviando correo a ${admin.email}: ${err.message}`);
      }
    }
  }

  /**
   * Ejecuta un ciclo completo de detección de cambios en órdenes.
   */
  async function runDetectionCycle() {
    const startTime = Date.now();
    let ordersProcessed = 0;
    let changesDetected = 0;
    let errorsCount = 0;
    const allChanges = [];

    // 1. Verify SQL Server connection (Req 6.2)
    let sqlPool;
    try {
      sqlPool = await getSqlPoolFn();
    } catch (err) {
      logger.error(`${LOG_PREFIX} Error de conexión a SQL Server al inicio del ciclo: ${err.message}`);
      throw err;
    }

    // 2. Query all active orders with HDR + FACT + ITEM join
    let rows;
    try {
      const request = sqlPool.request();
      const result = await request.query(`
        SELECT
          h.Nro AS pc,
          f.Factura AS factura,
          h.ETA_OV, h.ETD_OV, h.MedioDeEnvioOV, h.Clausula,
          h.Puerto_Destino, h.Puerto_Embarque, h.EstadoOV, h.Certificados,
          h.GtoAdicFlete, h.FechaOriginalCompromisoCliente, h.Condicion_venta, h.Nave,
          f.ETA_ENC_FA, f.ETD_ENC_FA, f.MedioDeEnvioFact,
          f.GtoAdicFleteFactura, f.Fecha_factura,
          i.Linea, i.Cant_ordenada, i.Cant_enviada, i.KilosFacturados,
          i.Precio_Unit, i.ETD_Item_OV, i.ETA_Item_OV
        FROM jor_imp_HDR_90_softkey h
        LEFT JOIN jor_imp_FACT_90_softkey f ON f.Nro = h.Nro
        LEFT JOIN jor_imp_item_90_softkey i ON i.Nro = h.Nro
          AND (i.Factura = f.Factura OR (i.Factura IS NULL AND f.Factura IS NULL))
      `);
      rows = result.recordset || [];
    } catch (err) {
      logger.error(`${LOG_PREFIX} Error consultando órdenes desde SQL Server: ${err.message}`);
      throw err;
    }

    // 3. Group rows by (pc, factura)
    const grouped = new Map();
    for (const row of rows) {
      const pc = normalizeValue(row.pc);
      const factura = normalizeValue(row.factura);
      const key = `${pc}||${factura}`;
      if (!grouped.has(key)) {
        grouped.set(key, { pc, factura, hdr: row, fact: row, items: [] });
      }
      if (row.Linea != null) {
        grouped.get(key).items.push(row);
      }
    }

    const pool = await mysqlPoolPromise;

    // 4. Process each order
    for (const [, orderData] of grouped) {
      const { pc, factura } = orderData;
      try {
        const snapshot = buildSnapshot(orderData.hdr, orderData.fact, orderData.items);
        const hash = computeSnapshotHash(snapshot);

        const [prevRows] = await pool.execute(
          'SELECT snapshot_hash, snapshot_data FROM order_snapshots WHERE pc = ? AND factura <=> ?',
          [pc, factura]
        );

        if (prevRows.length === 0) {
          // First time: insert initial snapshot, no changes (Req 2.5)
          await pool.execute(
            'INSERT INTO order_snapshots (pc, factura, snapshot_hash, snapshot_data) VALUES (?, ?, ?, ?)',
            [pc, factura, hash, JSON.stringify(snapshot)]
          );
        } else if (prevRows[0].snapshot_hash === hash) {
          // Hash matches: skip (Req 2.4)
        } else {
          // Hash differs: compare field by field (Req 2.1, 2.2, 2.3)
          let oldSnapshot;
          try {
            oldSnapshot = typeof prevRows[0].snapshot_data === 'string'
              ? JSON.parse(prevRows[0].snapshot_data)
              : prevRows[0].snapshot_data;
          } catch (_) {
            oldSnapshot = {};
          }

          const changes = compareSnapshots(oldSnapshot, snapshot);

          if (changes.length > 0) {
            for (const change of changes) {
              await pool.execute(
                'INSERT INTO order_changes (pc, factura, field_name, old_value, new_value) VALUES (?, ?, ?, ?, ?)',
                [pc, factura, change.field_name, change.old_value, change.new_value]
              );
            }
            changesDetected += changes.length;
            allChanges.push({ pc, factura, changes });
          }

          await pool.execute(
            'UPDATE order_snapshots SET snapshot_hash = ?, snapshot_data = ? WHERE pc = ? AND factura <=> ?',
            [hash, JSON.stringify(snapshot), pc, factura]
          );
        }

        ordersProcessed++;
      } catch (err) {
        errorsCount++;
        logger.error(`${LOG_PREFIX} Error procesando pc=${pc} factura=${factura}: ${err.message}`);
      }
    }

    const executionTimeMs = Date.now() - startTime;
    logger.info(
      `${LOG_PREFIX} Procesadas: ${ordersProcessed} órdenes, ${changesDetected} cambios detectados, ${errorsCount} errores, ${(executionTimeMs / 1000).toFixed(1)}s`
    );

    // 5. Send email to admins if changes detected (Req 5.1-5.5)
    if (allChanges.length > 0) {
      await notifyAdmins(allChanges);
    }

    return { ordersProcessed, changesDetected, errorsCount, executionTimeMs };
  }

  return {
    runDetectionCycle,
  };
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  normalizeSnapshotValue,
  buildSnapshot,
  deterministicStringify,
  computeSnapshotHash,
  compareSnapshots,
  createOrderChangeDetectionService,
};
