const { poolPromise } = require('../config/db');
const { sql, getSqlPool } = require('../config/sqlserver');

const formatDateOnly = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const normalizeDateInput = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return null;
  }
  return trimmed;
};

const clampDateRange = (startInput, endInput) => {
  const today = new Date();
  const defaultEnd = formatDateOnly(today);
  const defaultStartDate = new Date(today);
  defaultStartDate.setMonth(defaultStartDate.getMonth() - 11);
  defaultStartDate.setDate(1);
  const defaultStart = formatDateOnly(defaultStartDate);

  let startDate = normalizeDateInput(startInput) || defaultStart;
  let endDate = normalizeDateInput(endInput) || defaultEnd;

  if (startDate > endDate) {
    const temp = startDate;
    startDate = endDate;
    endDate = temp;
  }

  return { startDate, endDate };
};

const shiftYear = (dateString, years = 1) => {
  const date = new Date(`${dateString}T00:00:00`);
  date.setFullYear(date.getFullYear() - years);
  return formatDateOnly(date);
};

const addMonths = (dateString, months) => {
  const date = new Date(`${dateString}T00:00:00`);
  const day = date.getDate();
  date.setMonth(date.getMonth() + months);
  // Ajuste simple para evitar overflow de meses cortos
  while (date.getDate() < day) {
    date.setDate(date.getDate() + 1);
  }
  return formatDateOnly(date);
};

const getYearStart = (year) => `${year}-01-01`;
const getYearEnd = (year) => `${year}-12-31`;

const alignCutoffToBaseYear = (cutoffDate, baseYear) => {
  const [year, month, day] = String(cutoffDate).split('-').map(Number);
  if (!year || !month || !day) return cutoffDate;
  const tentative = new Date(`${baseYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00`);
  if (Number.isNaN(tentative.getTime()) || tentative.getMonth() + 1 !== month) {
    const lastDay = new Date(baseYear, month, 0);
    return formatDateOnly(lastDay);
  }
  return formatDateOnly(tentative);
};

const createProjectionService = ({
  mysqlPoolPromise = poolPromise,
  getSqlPoolFn = getSqlPool,
  sqlModule = sql,
  logger = console
} = {}) => {
  const getSellerCodesByRut = async (rut) => {
    const rawRut = String(rut || '').trim();
    if (!rawRut) return [];
    const pool = await mysqlPoolPromise;
    const normalizedRut = rawRut.toLowerCase().replace(/\./g, '').trim();
    const [sellerRows] = await pool.query(
      `SELECT codigo
       FROM sellers
       WHERE REPLACE(LOWER(TRIM(rut)), '.', '') = ?
       LIMIT 1`,
      [normalizedRut]
    );
    return sellerRows
      .map((row) => String(row.codigo || '').trim())
      .filter((code) => code.length > 0);
  };

  const buildSellerFilterClause = (sellerCodes = []) => {
    if (!sellerCodes.length) {
      return '1=0';
    }
    const placeholders = sellerCodes.map((_, idx) => `@sellerCode${idx}`);
    return `h.Vendedor IN (${placeholders.join(', ')})`;
  };

  const getOptions = async ({ sellerRut, customerRut }) => {
    const sqlPool = await getSqlPoolFn();
    const request = sqlPool.request();
    const sellerCodes = await getSellerCodesByRut(sellerRut);
    const sellerFilterClause = buildSellerFilterClause(sellerCodes);

    if (sellerCodes.length) {
      sellerCodes.forEach((code, idx) => {
        request.input(`sellerCode${idx}`, sqlModule.VarChar, String(code).trim());
      });
    }

    const where = [sellerFilterClause];
    if (customerRut) {
      where.push('h.Rut = @customerRut');
      request.input('customerRut', sqlModule.VarChar, customerRut);
    }

    const baseWhere = where.filter(Boolean).join(' AND ');
    // REFACTORING NOTE: Updated to use Vista_HDR with LEFT JOIN to Vista_ITEM
    // This aggregates all items per order (across all invoices)
    const baseFrom = `
      FROM jor_imp_HDR_90_softkey h
      LEFT JOIN jor_imp_item_90_softkey i ON i.Nro = h.Nro
      LEFT JOIN jor_imp_CLI_01_softkey c ON c.Rut = h.Rut
      WHERE ${baseWhere}
    `;

    const customersQuery = `
      SELECT DISTINCT
        h.Rut AS id,
        c.Nombre AS name
      ${baseFrom}
      ORDER BY name ASC
    `;

    const productsQuery = `
      SELECT DISTINCT
        i.Item AS id,
        COALESCE(NULLIF(i.Descripcion, ''), i.Item, 'Producto') AS name
      ${baseFrom}
        AND i.Item IS NOT NULL
      ORDER BY name ASC
    `;
    const currenciesQuery = `
      SELECT DISTINCT
        h.Job AS currency
      ${baseFrom}
      ORDER BY h.Job ASC
    `;

    const customersResult = await request.query(customersQuery);
    const productsResult = await request.query(productsQuery);
    const currenciesResult = await request.query(currenciesQuery);

    return {
      customers: customersResult.recordset || [],
      products: productsResult.recordset || [],
      currencies: (currenciesResult.recordset || [])
        .map((row) => String(row.currency || '').trim())
        .filter((val) => val.length > 0)
    };
  };

  const getProjectionData = async ({
    sellerRut,
    customerRut,
    productId,
    startDate,
    endDate,
    cutoffDate,
    period = 'monthly',
    metric = 'kg',
    growthPercent = 0,
    currency,
    baseYear,
    compareMode = 'LY',
    forecastType = 'RUN_RATE',
    cutoffMode = 'YTD_SAME_CUTOFF',
    debug = false
  }) => {
    const sqlPool = await getSqlPoolFn();
    const range = clampDateRange(startDate, endDate);
    const cutoffRaw = normalizeDateInput(cutoffDate) || range.endDate;
    const baseYearNum = Number(baseYear) || new Date(`${cutoffRaw}T00:00:00`).getFullYear();
    const cutoffAligned = alignCutoffToBaseYear(cutoffRaw, baseYearNum);
    const cutoff = (cutoffMode === 'YTD_SAME_CUTOFF' || cutoffMode === 'ROLLING_12M')
      ? cutoffAligned
      : cutoffRaw;
    const startOfCurrentYear = getYearStart(baseYearNum);
    const endOfCurrentYear = getYearEnd(baseYearNum);
    const startOfLastYear = getYearStart(baseYearNum - 1);
    const endOfLastYear = getYearEnd(baseYearNum - 1);
    const cutoffLastYear = shiftYear(cutoff, 1);

    const metricRaw = String(metric || 'kg').toLowerCase();
    const metricKey = metricRaw === 'kg' ? 'kg' : 'amount';
    const amountExpr = 'ISNULL(i.KilosFacturados, 0) * ISNULL(i.Precio_Unit, 0)';

    const buildRequest = (codes = []) => {
      const request = sqlPool.request();
      if (codes.length) {
        codes.forEach((code, idx) => {
          request.input(`sellerCode${idx}`, sqlModule.VarChar, String(code).trim());
        });
      }
      return request;
    };

    const sellerCodes = await getSellerCodesByRut(sellerRut);
    const sellerFilterClause = buildSellerFilterClause(sellerCodes);

    const buildWhere = (request, rangeStart, rangeEnd, currencyFilter) => {
      const where = [
        sellerFilterClause,
        // REFACTORING NOTE: Filter for valid invoices in Vista_FACT
        'f.Factura IS NOT NULL',
        "LTRIM(RTRIM(CONVERT(varchar(50), f.Factura))) <> ''",
        'f.Factura <> 0',
        'f.Fecha_factura IS NOT NULL',
        'CAST(f.Fecha_factura AS date) BETWEEN @start AND @end'
      ];
      request.input('start', sqlModule.Date, rangeStart);
      request.input('end', sqlModule.Date, rangeEnd);

      if (customerRut) {
        where.push('h.Rut = @customerRut');
        request.input('customerRut', sqlModule.VarChar, customerRut);
      }
      if (productId) {
        where.push('i.Item = @productId');
        request.input('productId', sqlModule.VarChar, productId);
      }
      if (currencyFilter) {
        where.push('h.Job = @currency');
        request.input('currency', sqlModule.VarChar, currencyFilter);
      }
      return where.join(' AND ');
    };

    // REFACTORING NOTE: Separate query builders for order-level vs invoice-level
    // Order-level: Vista_HDR with LEFT JOIN to Vista_ITEM (aggregates all items per order)
    // Invoice-level: Vista_FACT with INNER JOIN to Vista_ITEM (aggregates items per invoice)
    
    const buildOrderLevelFrom = () => `
      FROM jor_imp_HDR_90_softkey h
      LEFT JOIN jor_imp_item_90_softkey i ON i.Nro = h.Nro
    `;

    const buildInvoiceLevelFrom = () => `
      FROM jor_imp_FACT_90_softkey f
      INNER JOIN jor_imp_HDR_90_softkey h ON h.Nro = f.Nro
      INNER JOIN jor_imp_item_90_softkey i ON i.Nro = f.Nro AND i.Factura = f.Factura
    `;

    // For this service, we use invoice-level queries (filtering by Fecha_factura)
    const baseFrom = buildInvoiceLevelFrom();

    const aggregatesQuery = (whereClause) => `
      SELECT
        COALESCE(SUM(ISNULL(i.KilosFacturados, 0)), 0) AS total_kg,
        COALESCE(SUM(${amountExpr}), 0) AS total_amt,
        COUNT(DISTINCT CONCAT(f.Nro, '-', f.Factura)) AS total_orders,
        SUM(CASE WHEN i.KilosFacturados IS NULL OR i.Precio_Unit IS NULL THEN 1 ELSE 0 END) AS missing_values
      ${baseFrom}
      WHERE ${whereClause}
    `;

    const seriesQuery = (whereClause) => {
      // REFACTORING NOTE: Using f.Fecha_factura from Vista_FACT for invoice-level aggregation
      if (period === 'annual') {
        return `
          SELECT
            YEAR(f.Fecha_factura) AS period,
            COALESCE(SUM(${metricKey === 'kg' ? 'ISNULL(i.KilosFacturados, 0)' : amountExpr}), 0) AS total_value
          ${baseFrom}
          WHERE ${whereClause}
          GROUP BY YEAR(f.Fecha_factura)
          ORDER BY YEAR(f.Fecha_factura)
        `;
      }
      if (period === 'quarterly') {
        return `
          SELECT
            CONCAT(YEAR(f.Fecha_factura), '-Q', DATEPART(QUARTER, f.Fecha_factura)) AS period,
            COALESCE(SUM(${metricKey === 'kg' ? 'ISNULL(i.KilosFacturados, 0)' : amountExpr}), 0) AS total_value
          ${baseFrom}
          WHERE ${whereClause}
          GROUP BY YEAR(f.Fecha_factura), DATEPART(QUARTER, f.Fecha_factura)
          ORDER BY YEAR(f.Fecha_factura), DATEPART(QUARTER, f.Fecha_factura)
        `;
      }
      return `
        SELECT
          FORMAT(CONVERT(date, f.Fecha_factura), 'yyyy-MM') AS period,
          COALESCE(SUM(${metricKey === 'kg' ? 'ISNULL(i.KilosFacturados, 0)' : amountExpr}), 0) AS total_value
        ${baseFrom}
        WHERE ${whereClause}
        GROUP BY FORMAT(CONVERT(date, f.Fecha_factura), 'yyyy-MM')
        ORDER BY FORMAT(CONVERT(date, f.Fecha_factura), 'yyyy-MM')
      `;
    };

    const runAggregates = async (rangeStart, rangeEnd, currencyFilter) => {
      const request = buildRequest(sellerCodes);
      const whereClause = buildWhere(request, rangeStart, rangeEnd, currencyFilter);
      const result = await request.query(aggregatesQuery(whereClause));
      const row = result.recordset?.[0] || {};
      return {
        kg: Number(row.total_kg || 0),
        amt: Number(row.total_amt || 0),
        orders: Number(row.total_orders || 0),
        missing: Number(row.missing_values || 0)
      };
    };

    const runSeries = async (rangeStart, rangeEnd, currencyFilter) => {
      const request = buildRequest(sellerCodes);
      const whereClause = buildWhere(request, rangeStart, rangeEnd, currencyFilter);
      const result = await request.query(seriesQuery(whereClause));
      return result.recordset || [];
    };

    const currenciesRequest = buildRequest(sellerCodes);
    const currenciesWhere = buildWhere(currenciesRequest, startOfLastYear, cutoff, null);
    // REFACTORING NOTE: Query currencies from Vista_FACT (invoice-level)
    const currenciesResult = await currenciesRequest.query(`
      SELECT DISTINCT h.Job AS currency
      ${baseFrom}
      WHERE ${currenciesWhere}
      ORDER BY h.Job
    `);
    const availableCurrencies = (currenciesResult.recordset || [])
      .map((row) => String(row.currency || '').trim())
      .filter((val) => val.length > 0);

    const selectedCurrency = currency || availableCurrencies[0] || '';
    const currencyFilter = metricKey === 'amount' ? selectedCurrency : '';

    const resolveRanges = () => {
      if (cutoffMode === 'FULL_YEAR') {
        return {
          current: { start: startOfCurrentYear, end: endOfCurrentYear },
          last: { start: startOfLastYear, end: endOfLastYear }
        };
      }
      if (cutoffMode === 'ROLLING_12M') {
        const startRolling = addMonths(cutoff, -11);
        const prevEnd = addMonths(cutoff, -12);
        const prevStart = addMonths(cutoff, -23);
        return {
          current: { start: startRolling, end: cutoff },
          last: { start: prevStart, end: prevEnd }
        };
      }
      return {
        current: { start: startOfCurrentYear, end: cutoff },
        last: { start: startOfLastYear, end: cutoffLastYear }
      };
    };

    const ranges = resolveRanges();

    const currentAgg = await runAggregates(ranges.current.start, ranges.current.end, currencyFilter);
    const lastYtdAgg = await runAggregates(startOfLastYear, cutoffLastYear, currencyFilter);
    const hasLyBase = lastYtdAgg.amt > 0 || lastYtdAgg.kg > 0;
    const lastAgg = await runAggregates(ranges.last.start, ranges.last.end, currencyFilter);

    const compareAgg = async (yearsBack) => {
      if (cutoffMode === 'FULL_YEAR') {
        return runAggregates(getYearStart(baseYearNum - yearsBack), getYearEnd(baseYearNum - yearsBack), currencyFilter);
      }
      if (cutoffMode === 'ROLLING_12M') {
        const end = addMonths(cutoff, -12 * yearsBack);
        const start = addMonths(cutoff, -(12 * yearsBack + 11));
        return runAggregates(start, end, currencyFilter);
      }
      const start = shiftYear(startOfCurrentYear, yearsBack);
      const end = shiftYear(cutoff, yearsBack);
      return runAggregates(start, end, selectedCurrency);
    };

    let compareAggResult = lastAgg;
    let compareYearsUsed = [baseYearNum - 1];
    if (compareMode === 'AVG_3Y') {
      const agg1 = await compareAgg(1);
      const agg2 = await compareAgg(2);
      const agg3 = await compareAgg(3);
      compareAggResult = {
        kg: (agg1.kg + agg2.kg + agg3.kg) / 3,
        amt: (agg1.amt + agg2.amt + agg3.amt) / 3,
        orders: (agg1.orders + agg2.orders + agg3.orders) / 3,
        missing: agg1.missing + agg2.missing + agg3.missing
      };
      compareYearsUsed = [baseYearNum - 3, baseYearNum - 2, baseYearNum - 1];
    } else if (compareMode === 'LAST_FULL_YEAR') {
      const agg = await runAggregates(startOfLastYear, endOfLastYear, currencyFilter);
      compareAggResult = agg;
      compareYearsUsed = [baseYearNum - 1];
    }

    const growth = Number(growthPercent || 0) / 100;
    const daysElapsed = Math.max(
      1,
      Math.floor((new Date(`${ranges.current.end}T00:00:00`).getTime() - new Date(`${ranges.current.start}T00:00:00`).getTime()) / 86400000) + 1
    );
    const daysInYear = new Date(baseYearNum, 1, 29).getDate() === 29 ? 366 : 365;

    const runRateKg = (currentAgg.kg / daysElapsed) * daysInYear;
    const runRateAmt = (currentAgg.amt / daysElapsed) * daysInYear;

    const historicalAvg = async () => {
      const agg1 = await runAggregates(getYearStart(baseYearNum - 1), getYearEnd(baseYearNum - 1), currencyFilter);
      const agg2 = await runAggregates(getYearStart(baseYearNum - 2), getYearEnd(baseYearNum - 2), currencyFilter);
      const agg3 = await runAggregates(getYearStart(baseYearNum - 3), getYearEnd(baseYearNum - 3), currencyFilter);
      return {
        kg: (agg1.kg + agg2.kg + agg3.kg) / 3,
        amt: (agg1.amt + agg2.amt + agg3.amt) / 3
      };
    };

    const lastYearFull = await runAggregates(startOfLastYear, endOfLastYear, currencyFilter);

    let forecastTypeEffective = forecastType || 'RUN_RATE';
    if (!hasLyBase && (forecastTypeEffective === 'LAST_YEAR_TOTAL' || forecastTypeEffective === 'MANUAL_TARGET')) {
      forecastTypeEffective = 'RUN_RATE';
    }

    let estKgCurrentYear = runRateKg;
    let estAmtCurrentYear = runRateAmt;

    if (forecastTypeEffective === 'HISTORICAL_AVG') {
      const avg = await historicalAvg();
      estKgCurrentYear = avg.kg;
      estAmtCurrentYear = avg.amt;
    } else if (forecastTypeEffective === 'LAST_YEAR_TOTAL') {
      estKgCurrentYear = lastYearFull.kg;
      estAmtCurrentYear = lastYearFull.amt;
    } else if (forecastTypeEffective === 'MANUAL_TARGET') {
      const baseRefKg = lastYearFull.kg > 0 ? lastYearFull.kg : runRateKg;
      const baseRefAmt = lastYearFull.amt > 0 ? lastYearFull.amt : runRateAmt;
      estKgCurrentYear = baseRefKg * (1 + growth);
      estAmtCurrentYear = baseRefAmt * (1 + growth);
    }

    const forecastKgNextBase = estKgCurrentYear;
    const forecastAmtNextBase = estAmtCurrentYear;
    const forecastKgNextGrowth = estKgCurrentYear * (1 + growth);
    const forecastAmtNextGrowth = estAmtCurrentYear * (1 + growth);

    const seriesStart = ranges.current.start;
    const seriesEnd = ranges.current.end;
    const currentSeriesRows = await runSeries(seriesStart, seriesEnd, currencyFilter);

    const getSeriesForOffset = async (yearsBack) => {
      if (cutoffMode === 'FULL_YEAR') {
        return runSeries(getYearStart(baseYearNum - yearsBack), getYearEnd(baseYearNum - yearsBack), currencyFilter);
      }
      if (cutoffMode === 'ROLLING_12M') {
        const end = addMonths(cutoff, -12 * yearsBack);
        const start = addMonths(cutoff, -(12 * yearsBack + 11));
        return runSeries(start, end, currencyFilter);
      }
      const start = shiftYear(startOfCurrentYear, yearsBack);
      const end = shiftYear(cutoff, yearsBack);
      return runSeries(start, end, currencyFilter);
    };

    const lastYearSeriesRows = await getSeriesForOffset(1);
    const lastYear2SeriesRows = compareMode === 'AVG_3Y' ? await getSeriesForOffset(2) : [];
    const lastYear3SeriesRows = compareMode === 'AVG_3Y' ? await getSeriesForOffset(3) : [];

    const seriesMap = (rows) => new Map(rows.map((row) => [String(row.period), Number(row.total_value || 0)]));
    const currentMap = seriesMap(currentSeriesRows);
    const lastYearMap = seriesMap(lastYearSeriesRows);
    const lastYear2Map = seriesMap(lastYear2SeriesRows);
    const lastYear3Map = seriesMap(lastYear3SeriesRows);

    const labels = [];
    const currentSeries = [];
    const lastYearSeries = [];
    const projectionSeries = [];
    const compareValuesPerPeriod = {};

    const hasComparableBase = compareAggResult.amt > 0 || compareAggResult.kg > 0;
    const getCompareValue = (label, yearOffset = 1) => {
      if (period === 'annual') {
        const compareLabel = String(Number(label) - yearOffset);
        const map = yearOffset === 1 ? lastYearMap : yearOffset === 2 ? lastYear2Map : lastYear3Map;
        return map.has(compareLabel) ? map.get(compareLabel) : null;
      }
      if (period === 'quarterly') {
        const [yearPart, quarterPart] = label.split('-Q');
        const compareLabel = `${Number(yearPart) - yearOffset}-Q${quarterPart}`;
        const map = yearOffset === 1 ? lastYearMap : yearOffset === 2 ? lastYear2Map : lastYear3Map;
        return map.has(compareLabel) ? map.get(compareLabel) : null;
      }
      const [year, month] = label.split('-');
      const compareLabel = `${Number(year) - yearOffset}-${month}`;
      const map = yearOffset === 1 ? lastYearMap : yearOffset === 2 ? lastYear2Map : lastYear3Map;
      return map.has(compareLabel) ? map.get(compareLabel) : null;
    };

    const projectionValue = metricKey === 'kg' ? forecastKgNextGrowth : forecastAmtNextGrowth;
    if (period === 'annual') {
      const startYear = new Date(`${ranges.current.start}T00:00:00`).getFullYear();
      const endYear = new Date(`${ranges.current.end}T00:00:00`).getFullYear();
      for (let year = startYear; year <= endYear; year += 1) {
        const label = String(year);
        labels.push(label);
        const currentVal = currentMap.has(label) ? currentMap.get(label) : null;
        const val1 = getCompareValue(label, 1);
        const val2 = getCompareValue(label, 2);
        const val3 = getCompareValue(label, 3);
        const lastYearVal = val1;
        const avgCandidates = [val1, val2, val3].filter((val) => val !== null && val !== undefined);
        const avg3 = avgCandidates.length ? avgCandidates.reduce((sum, val) => sum + val, 0) / avgCandidates.length : null;
        const compareVal = compareMode === 'AVG_3Y' ? avg3 : lastYearVal;
        currentSeries.push(currentVal);
        const canShowCompare = compareMode === 'LY' ? hasLyBase : hasComparableBase;
        lastYearSeries.push(canShowCompare ? compareVal : null);
        projectionSeries.push(projectionValue);
        compareValuesPerPeriod[label] = canShowCompare ? compareVal : null;
      }
    } else if (period === 'ytd') {
      labels.push('YTD');
      const currentVal = metricKey === 'kg' ? currentAgg.kg : currentAgg.amt;
      const lastVal = metricKey === 'kg' ? compareAggResult.kg : compareAggResult.amt;
      currentSeries.push(currentVal);
      const canShowCompare = compareMode === 'LY' ? hasLyBase : hasComparableBase;
      lastYearSeries.push(canShowCompare ? lastVal : null);
      projectionSeries.push(projectionValue);
      compareValuesPerPeriod.YTD = canShowCompare ? lastVal : null;
    } else {
      const cursor = new Date(`${ranges.current.start}T00:00:00`);
      const end = new Date(`${ranges.current.end}T00:00:00`);
      cursor.setDate(1);
      end.setDate(1);
      while (cursor <= end) {
        const label = period === 'quarterly'
          ? `${cursor.getFullYear()}-Q${Math.floor(cursor.getMonth() / 3) + 1}`
          : `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
        const currentVal = currentMap.has(label) ? currentMap.get(label) : null;
        const val1 = getCompareValue(label, 1);
        const val2 = getCompareValue(label, 2);
        const val3 = getCompareValue(label, 3);
        const lastYearVal = val1;
        const avgCandidates = [val1, val2, val3].filter((val) => val !== null && val !== undefined);
        const avg3 = avgCandidates.length ? avgCandidates.reduce((sum, val) => sum + val, 0) / avgCandidates.length : null;
        const compareVal = compareMode === 'AVG_3Y' ? avg3 : lastYearVal;
        labels.push(label);
        currentSeries.push(currentVal);
        const canShowCompare = compareMode === 'LY' ? hasLyBase : hasComparableBase;
        lastYearSeries.push(canShowCompare ? compareVal : null);
        projectionSeries.push(projectionValue);
        compareValuesPerPeriod[label] = canShowCompare ? compareVal : null;
        cursor.setMonth(cursor.getMonth() + 1);
      }
    }

    const deltaKg = currentAgg.kg - compareAggResult.kg;
    const deltaAmt = currentAgg.amt - compareAggResult.amt;
    const deltaOrders = currentAgg.orders - compareAggResult.orders;
    const allowDeltaPct = compareMode === 'LY' ? hasLyBase : (compareAggResult.kg > 0 || compareAggResult.amt > 0);
    const deltaKgPct = allowDeltaPct && compareAggResult.kg > 0 ? deltaKg / compareAggResult.kg : null;
    const deltaAmtPct = allowDeltaPct && compareAggResult.amt > 0 ? deltaAmt / compareAggResult.amt : null;
    const deltaOrdersPct = allowDeltaPct && compareAggResult.orders > 0 ? deltaOrders / compareAggResult.orders : null;

    const avgPriceCurrent = currentAgg.kg > 0 ? currentAgg.amt / currentAgg.kg : null;
    const avgPriceLast = compareAggResult.kg > 0 ? compareAggResult.amt / compareAggResult.kg : null;
    const deltaPricePct = avgPriceLast ? (avgPriceCurrent - avgPriceLast) / avgPriceLast : null;

    const kgPerOrderCurrent = currentAgg.orders > 0 ? currentAgg.kg / currentAgg.orders : null;
    const kgPerOrderLast = compareAggResult.orders > 0 ? compareAggResult.kg / compareAggResult.orders : null;

    const lastOrderRequest = buildRequest(sellerCodes);
    const lastOrderWhere = buildWhere(lastOrderRequest, startOfLastYear, cutoff, currencyFilter);
    // REFACTORING NOTE: Query last order date from Vista_FACT (invoice-level)
    const lastOrderResult = await lastOrderRequest.query(`
      SELECT MAX(f.Fecha_factura) AS last_order_date
      ${baseFrom}
      WHERE ${lastOrderWhere}
    `);
    const lastOrderDate = lastOrderResult.recordset?.[0]?.last_order_date;
    const daysSinceLastOrder = lastOrderDate
      ? Math.floor((new Date(`${cutoff}T00:00:00`).getTime() - new Date(lastOrderDate).getTime()) / 86400000)
      : null;
    const noOrdersInLastNDays = daysSinceLastOrder === null ? true : daysSinceLastOrder > 30;

    const statusYoy = allowDeltaPct ? (deltaAmt < 0 ? 'BELOW' : deltaAmt > 0 ? 'ABOVE' : 'FLAT') : 'FLAT';
    const alertCallClient = (deltaAmtPct !== null && deltaAmtPct <= -0.05)
      || (deltaOrdersPct !== null && deltaOrdersPct <= -0.2)
      || noOrdersInLastNDays;

    const formatPct = (val) => (val === null ? 'N/A' : `${(val * 100).toFixed(1)}%`);
    let messageSales = deltaAmtPct === null
      ? `A la fecha ${cutoff}, llevamos ${currentAgg.kg} KG y ${currentAgg.amt} ${selectedCurrency}, sin base comparable histórica.`
      : `A la fecha ${cutoff}, llevamos ${currentAgg.kg} KG y ${currentAgg.amt} ${selectedCurrency}, vs ${compareAggResult.kg} KG y ${compareAggResult.amt} ${selectedCurrency} (${compareMode}). Gap: ${deltaAmt} ${selectedCurrency} (${formatPct(deltaAmtPct)}). Pedidos YTD: ${currentAgg.orders} vs ${compareAggResult.orders}.`;
    if (currentAgg.kg === 0 && currentAgg.amt === 0) {
      messageSales = `Sin ventas en el periodo seleccionado (hasta ${cutoff}).`;
    }

    const compareRangePayload = (() => {
      if (compareMode === 'AVG_3Y') {
        if (cutoffMode === 'FULL_YEAR') {
          return {
            startDate: getYearStart(baseYearNum - 3),
            endDate: getYearEnd(baseYearNum - 1)
          };
        }
        if (cutoffMode === 'ROLLING_12M') {
          return {
            startDate: addMonths(cutoff, -35),
            endDate: addMonths(cutoff, -12)
          };
        }
        return {
          startDate: shiftYear(startOfLastYear, 2),
          endDate: cutoffLastYear
        };
      }
      return {
        startDate: ranges.last.start,
        endDate: ranges.last.end
      };
    })();

    const debugData = debug
      ? {
          cutoff_date: cutoff,
          base_year: baseYearNum,
          cutoff_last_year: cutoffLastYear,
          ytd_current: metricKey === 'kg' ? currentAgg.kg : currentAgg.amt,
          ytd_last: metricKey === 'kg' ? lastYtdAgg.kg : lastYtdAgg.amt,
          days_elapsed: daysElapsed,
          days_year: daysInYear,
          est_full_year: metricKey === 'kg' ? estKgCurrentYear : estAmtCurrentYear,
          next_base: metricKey === 'kg' ? forecastKgNextBase : forecastAmtNextBase,
          next_growth: metricKey === 'kg' ? forecastKgNextGrowth : forecastAmtNextGrowth,
          forecastType_requested: forecastType,
          forecastType_effective: forecastTypeEffective,
          compareMode_requested: compareMode,
          compareMode_effective: compareMode,
          compare_years_used: compareYearsUsed,
          compare_values_per_period: compareValuesPerPeriod,
          message_sales: messageSales,
          ytd_range_used: { start: ranges.current.start, end: ranges.current.end },
          compare_range_used: { start: compareRangePayload.startDate, end: compareRangePayload.endDate },
          cutoff_mode: cutoffMode,
          start_param: startDate || null,
          end_param: endDate || null
        }
      : null;

    return {
      range: {
        startDate: ranges.current.start,
        endDate: ranges.current.end
      },
      compareRange: {
        startDate: compareRangePayload.startDate,
        endDate: compareRangePayload.endDate
      },
      cutoffDate: cutoff,
      currency: selectedCurrency,
      availableCurrencies,
      period,
      metric: metricKey,
      growthPercent: Number(growthPercent || 0),
      baseYear: baseYearNum,
      compareMode,
      cutoffMode,
      forecastType: forecastTypeEffective,
      summary: {
        ytd_kg_current: currentAgg.kg,
        ytd_amt_current: currentAgg.amt,
        ytd_orders_current: currentAgg.orders,
        ytd_kg_last: compareAggResult.kg,
        ytd_amt_last: compareAggResult.amt,
        ytd_orders_last: compareAggResult.orders,
        delta_kg: deltaKg,
        delta_kg_pct: deltaKgPct,
        delta_amt: deltaAmt,
        delta_amt_pct: deltaAmtPct,
        avg_price_current: avgPriceCurrent,
        avg_price_last: avgPriceLast,
        delta_price_pct: deltaPricePct,
        kg_per_order_current: kgPerOrderCurrent,
        kg_per_order_last: kgPerOrderLast,
        est_kg_current_year: estKgCurrentYear,
        est_amt_current_year: estAmtCurrentYear,
        forecast_kg_next_base: forecastKgNextBase,
        forecast_amt_next_base: forecastAmtNextBase,
        forecast_kg_next_growth: forecastKgNextGrowth,
        forecast_amt_next_growth: forecastAmtNextGrowth,
        status_yoy: statusYoy,
        alert_call_client: alertCallClient,
        data_quality_flag: currentAgg.missing > 0 || compareAggResult.missing > 0,
        message_sales: messageSales,
        has_comparable_base: compareMode === 'LY' ? hasLyBase : hasComparableBase,
        has_ly_base: hasLyBase,
        forecast_type_effective: forecastTypeEffective
      },
      series: {
        labels,
        current: currentSeries,
        lastYear: lastYearSeries,
        projection: projectionSeries
      },
      debug: debugData
    };
  };

  return {
    getOptions,
    getProjectionData
  };
};

module.exports = { createProjectionService };
