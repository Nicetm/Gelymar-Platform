#!/usr/bin/env node

const path = require('path');
const dotenv = require('dotenv');

const envPath = process.env.ENV_FILE
  ? path.resolve(process.env.ENV_FILE)
  : path.resolve(__dirname, '../../docker/.env.local');
dotenv.config({ path: envPath });

const { poolPromise } = require('../config/db');
const { getSqlPool, sql } = require('../config/sqlserver');
const { cleanDirectoryName } = require('../utils/directoryUtils');
const { logger } = require('../utils/logger');
const { normalizeOcForCompare } = require('../utils/oc.util');

function parseArgs() {
  const args = new Set(process.argv.slice(2));
  return {
    apply: args.has('--apply'),
    dryRun: args.has('--dry-run') || !args.has('--apply'),
  };
}

function extractClientDirFromPath(filePath) {
  if (!filePath) return '';
  const normalized = String(filePath).replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  const uploadsIndex = parts.findIndex(part => part.toLowerCase() === 'uploads');
  if (uploadsIndex === -1) {
    return parts[0] || '';
  }
  return parts[uploadsIndex + 1] || '';
}

async function resolveSqlHeader({ pc, oc, factura }) {
  const sqlPool = await getSqlPool();
  const normalizedFactura =
    factura !== null && factura !== undefined && factura !== '' && factura !== 0 && factura !== '0'
      ? String(factura).trim()
      : null;

  const buildRequest = () => {
    const request = sqlPool.request();
    request.input('pc', sql.VarChar, String(pc).trim());
    if (oc) {
      request.input('oc', sql.VarChar, normalizeOcForCompare(oc));
    }
    if (normalizedFactura) {
      request.input('factura', sql.VarChar, normalizedFactura);
    }
    return request;
  };

  const baseQuery = `
    SELECT TOP 1
      h.Nro AS pc,
      h.OC AS oc,
      h.Factura AS factura,
      c.Nombre AS customer_name
    FROM jor_imp_HDR_90_softkey h
    LEFT JOIN jor_imp_CLI_01_softkey c ON c.Rut = h.Rut
    WHERE h.Nro = @pc
      ${oc ? "AND REPLACE(REPLACE(REPLACE(REPLACE(UPPER(h.OC), ' ', ''), '(', ''), ')', ''), '-', '') = @oc" : ''}
  `;

  if (normalizedFactura) {
    const request = buildRequest();
    const result = await request.query(`
      ${baseQuery}
        AND h.Factura = @factura
      ORDER BY ISNULL(h.Fecha, h.Fecha_factura) DESC
    `);
    return result.recordset?.[0] || null;
  }

  // 1) Intentar sin factura (NULL/0)
  const requestNoFactura = buildRequest();
  const resultNoFactura = await requestNoFactura.query(`
    ${baseQuery}
      AND (h.Factura IS NULL OR h.Factura = '' OR h.Factura = 0 OR h.Factura = '0')
    ORDER BY ISNULL(h.Fecha, h.Fecha_factura) DESC
  `);
  if (resultNoFactura.recordset?.[0]) {
    return resultNoFactura.recordset[0];
  }

  // 2) Fallback: cualquier factura (última)
  const requestAny = buildRequest();
  const resultAny = await requestAny.query(`
    ${baseQuery}
    ORDER BY ISNULL(h.Fecha, h.Fecha_factura) DESC
  `);
  return resultAny.recordset?.[0] || null;
}

async function run() {
  const { apply, dryRun } = parseArgs();
  logger.info(`[backfillOrderFiles] start mode=${apply ? 'apply' : 'dry-run'}`);

  const pool = await poolPromise;
  const [rows] = await pool.query(
    `
      SELECT id, pc, oc, factura, path
      FROM order_files
      WHERE
        (factura IS NULL OR factura = '' OR factura = 0 OR factura = '0')
    `
  );

  let updated = 0;
  let skipped = 0;
  let noMatch = 0;
  let mismatch = 0;

  for (const row of rows) {
    const pc = row.pc;
    const oc = row.oc;
    const sqlHeader = await resolveSqlHeader({ pc, oc, factura: row.factura });

    if (!sqlHeader) {
      noMatch++;
      logger.warn(`[backfillOrderFiles] NO_MATCH id=${row.id} pc=${pc || 'N/A'} oc=${oc || 'N/A'}`);
      continue;
    }

    const clientDir = extractClientDirFromPath(row.path);
    const sqlCustomerDir = cleanDirectoryName(sqlHeader.customer_name || '');
    if (clientDir && sqlCustomerDir && clientDir !== sqlCustomerDir) {
      mismatch++;
      logger.warn(`[backfillOrderFiles] SKIP_MISMATCH id=${row.id} pc=${pc || 'N/A'} oc=${oc || 'N/A'} pathClient=${clientDir} sqlClient=${sqlCustomerDir}`);
      continue;
    }

    const resolvedFactura = sqlHeader.factura ?? null;

    const needsFactura = row.factura === null || row.factura === '' || row.factura === 0 || row.factura === '0';

    if (!needsFactura) {
      skipped++;
      continue;
    }

    if (dryRun) {
      updated++;
      logger.info(`[backfillOrderFiles] DRY_RUN id=${row.id} pc=${pc || 'N/A'} oc=${oc || 'N/A'} factura=${resolvedFactura ?? 'N/A'}`);
      continue;
    }

    await pool.query(
      `
        UPDATE order_files
        SET factura = ?
        WHERE id = ?
      `,
      [resolvedFactura, row.id]
    );

    updated++;
    logger.info(`[backfillOrderFiles] UPDATED id=${row.id} pc=${pc || 'N/A'} oc=${oc || 'N/A'} factura=${resolvedFactura ?? 'N/A'}`);
  }

  logger.info(`[backfillOrderFiles] done total=${rows.length} updated=${updated} skipped=${skipped} noMatch=${noMatch} mismatch=${mismatch}`);
}

run().catch((error) => {
  logger.error(`[backfillOrderFiles] fatal error: ${error.message}`);
  process.exit(1);
});
