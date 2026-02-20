const { poolPromise } = require('../config/db');
const { sql, getSqlPool } = require('../config/sqlserver');
const { mapHdrRowToOrder } = require('../mappers/sqlsoftkey/hdr.mapper');
const { mapItemRowToOrderItem } = require('../mappers/sqlsoftkey/item.mapper');
const Order = require('../models/order.model');

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
  defaultStartDate.setDate(defaultStartDate.getDate() - 29);
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

  const normalizeOcForCompare = (value) => {
    if (value === null || value === undefined) return '';
    return String(value).toUpperCase().replace(/[\s()-]+/g, '');
  };

const subtractDays = (endDate, days) => {
  const base = new Date(`${endDate}T00:00:00`);
  base.setDate(base.getDate() - days);
  return formatDateOnly(base);
};

const createOrderService = ({
  mysqlPoolPromise = poolPromise,
  getSqlPoolFn = getSqlPool,
  sqlModule = sql,
  hdrMapper = mapHdrRowToOrder,
  itemMapper = mapItemRowToOrderItem,
  logger = console
} = {}) => {
  const resolveOrderKey = async (orderId) => {
    if (typeof orderId === 'string' && orderId.includes('|')) {
      const [pc, oc] = orderId.split('|');
      return { pc: pc?.trim(), oc: oc?.trim() };
    }
    return null;
  };
  /**
   * Busca órdenes por filtros opcionales
   * @param {object} filters
   * @returns {Promise<Order[]>}
   */
  const getSellerCodesByRut = async (rut) => {
    const rawRut = String(rut || '').trim();
    if (!rawRut) return [];
    const pool = await mysqlPoolPromise;
    const [sellerRows] = await pool.query(
      'SELECT codigo FROM sellers WHERE rut = ?',
      [rawRut]
    );
    return sellerRows
      .map((row) => String(row.codigo || '').trim())
      .filter((code) => code.length > 0);
  };

  const getOrdersByFilters = async (filters = {}) => {
    const pool = await mysqlPoolPromise;
    const sqlPool = await getSqlPoolFn();

  let baseQuery = `
    SELECT 
      h.Nro,
      h.OC,
      h.Rut,
      h.Fecha,
      h.Factura,
      h.Fecha_factura,
      h.ETD_OV,
      h.ETA_OV,
      h.ETD_ENC_FA,
      h.ETA_ENC_FA,
      h.Job,
      h.MedioDeEnvioFact,
      h.MedioDeEnvioOV,
      h.Clausula,
      h.Puerto_Destino,
      h.Certificados,
      h.EstadoOV,
      h.Vendedor,
      h.IDNroOvMasFactura,
      c.Nombre AS customer_name
    FROM jor_imp_HDR_90_softkey h
    LEFT JOIN jor_imp_CLI_01_softkey c ON c.Rut = h.Rut
  `;

  const conditions = [];
  const request = sqlPool.request();

  if (filters.customerRut) {
    conditions.push('h.Rut = @customerRut');
    request.input('customerRut', sqlModule.VarChar, filters.customerRut);
  }

  let sellerCodes = [];
  if (filters.salesRut) {
    sellerCodes = await getSellerCodesByRut(filters.salesRut);
    if (sellerCodes.length === 0) {
      return [];
    }
    const placeholders = sellerCodes.map((_, idx) => `@sellerCode${idx}`);
    conditions.push(`h.Vendedor IN (${placeholders.join(', ')})`);
    sellerCodes.forEach((code, idx) => {
      request.input(`sellerCode${idx}`, sqlModule.VarChar, String(code).trim());
    });
  }

  if (conditions.length) {
    baseQuery += ` WHERE ${conditions.join(' AND ')}`;
  }

  baseQuery += ' ORDER BY CAST(h.Fecha AS date) DESC';

  const result = await request.query(baseQuery);
  const rows = result.recordset || [];

  if (rows.length === 0) {
    return [];
  }

  const mappedRows = rows.map((row) => ({
    raw: row,
    mapped: hdrMapper(row)
  }));

  const orderPairs = mappedRows
    .map((row) => ({ pc: row.mapped.pc, oc: row.mapped.oc, id: row.mapped.id_nro_ov_mas_factura }))
    .filter((pair) => pair.pc && pair.oc);

  const documentCountMap = new Map();
  if (orderPairs.length) {
    const pairConditions = orderPairs.map(() => '(pc = ? AND oc = ? AND id_nro_ov_mas_factura = ?)').join(' OR ');
    const pairParams = [];
    orderPairs.forEach((pair) => {
      pairParams.push(pair.pc, pair.oc, pair.id || null);
    });
    const [docRows] = await pool.query(
      `SELECT pc, oc, id_nro_ov_mas_factura, COUNT(*) AS document_count
       FROM order_files
       WHERE ${pairConditions}
       GROUP BY pc, oc, id_nro_ov_mas_factura`,
      pairParams
    );
    docRows.forEach((row) => {
      documentCountMap.set(`${row.pc}|${row.oc}|${row.id_nro_ov_mas_factura || ''}`, row.document_count);
    });
  }

  return mappedRows.map(({ raw, mapped }) => {
    const docCountKey = `${mapped.pc}|${mapped.oc}|${mapped.id_nro_ov_mas_factura || ''}`;
    const order = new Order({
      id: `${mapped.pc}|${mapped.oc}`,
      rut: mapped.rut,
      pc: mapped.pc,
      oc: mapped.oc,
      created_at: mapped.fecha || mapped.fecha_factura || null,
      updated_at: mapped.fecha || mapped.fecha_factura || null,
      customer_name: raw.customer_name,
      customer_uuid: mapped.rut,
      order_id: null,
      factura: mapped.factura,
      fecha_factura: mapped.fecha_factura,
      fecha: mapped.fecha,
      fecha_ingreso: mapped.fecha || mapped.fecha_factura || null,
      fecha_etd: mapped.fecha_etd,
      fecha_eta: mapped.fecha_eta,
      fecha_etd_factura: mapped.fecha_etd_factura,
      fecha_eta_factura: mapped.fecha_eta_factura,
      currency: mapped.currency,
      medio_envio_factura: mapped.medio_envio_factura,
      medio_envio_ov: mapped.medio_envio_ov,
      incoterm: mapped.incoterm,
      puerto_destino: mapped.puerto_destino,
      certificados: mapped.certificados,
      estado_ov: mapped.estado_ov,
      id_nro_ov_mas_factura: mapped.id_nro_ov_mas_factura,
      document_count: documentCountMap.get(docCountKey) || 0
    });

    return order;
  });
  };

/**
 * Obtiene órdenes formateadas para el dashboard del cliente
 * @param {string} customerRut - RUT del cliente
 * @returns {Promise<Array>} Array de órdenes formateadas
 */
  const normalizeRutForCompare = (rut) => {
    if (!rut) return '';
    return String(rut).trim().replace(/C$/i, '');
  };

  const getClientDashboardOrders = async (customerRut) => {
    const sqlPool = await getSqlPoolFn();
    const headerRequest = sqlPool.request();
    const normalizedRut = normalizeRutForCompare(customerRut);
    const rutWithC = normalizedRut ? `${normalizedRut}C` : '';
    headerRequest.input('rut', sqlModule.VarChar, normalizedRut || customerRut);
    headerRequest.input('rutWithC', sqlModule.VarChar, rutWithC);

    const headerResult = await headerRequest.query(`
      SELECT
        h.Nro,
        h.OC,
        h.Rut,
        h.Fecha,
        h.Factura,
        h.Fecha_factura,
        h.ETD_OV,
        h.ETA_OV,
        h.ETD_ENC_FA,
        h.ETA_ENC_FA,
        h.MedioDeEnvioFact,
        h.MedioDeEnvioOV,
        h.Clausula,
        h.Puerto_Destino,
        h.Certificados,
        h.EstadoOV,
        h.Vendedor,
        c.Nombre AS customer_name
      FROM jor_imp_HDR_90_softkey h
      LEFT JOIN jor_imp_CLI_01_softkey c ON c.Rut = h.Rut
      WHERE h.Rut = @rut OR h.Rut = @rutWithC
      ORDER BY CAST(h.Fecha AS date) DESC
    `);

    const rows = headerResult.recordset || [];
    if (rows.length === 0) {
      return [];
    }

    const mappedRows = rows.map((row) => ({ raw: row, mapped: hdrMapper(row) }));
    const pairs = mappedRows
      .map((r) => ({ pc: r.mapped.pc, oc: r.mapped.oc, factura: r.mapped.factura }))
      .filter((r) => r.pc && r.oc);

    const pool = await mysqlPoolPromise;
    const docCountMap = new Map();
    if (pairs.length) {
      const pairConditions = pairs.map(() => '(pc = ? AND oc = ?)').join(' OR ');
      const pairParams = [];
      pairs.forEach((pair) => {
        pairParams.push(pair.pc, pair.oc);
      });
      const [docRows] = await pool.query(
        `SELECT pc, oc, COUNT(*) AS document_count
         FROM order_files
         WHERE is_visible_to_client = 1 AND (${pairConditions})
         GROUP BY pc, oc`,
        pairParams
      );
      docRows.forEach((row) => {
        docCountMap.set(`${row.pc}|${row.oc}`, row.document_count);
      });
    }

    const itemsCountMap = new Map();
    if (pairs.length) {
      const itemsRequest = sqlPool.request();
      const pcParams = pairs.map((pair, idx) => {
        itemsRequest.input(`pc${idx}`, sqlModule.VarChar, pair.pc);
        return `@pc${idx}`;
      });

      const itemsResult = await itemsRequest.query(`
        SELECT Nro, Factura, COUNT(*) AS items_count
        FROM jor_imp_item_90_softkey
        WHERE Nro IN (${pcParams.join(', ')})
        GROUP BY Nro, Factura
      `);
      (itemsResult.recordset || []).forEach((row) => {
        itemsCountMap.set(`${row.Nro}|${row.Factura ?? ''}`, row.items_count);
      });
    }

    return mappedRows.map(({ raw, mapped }) => {
      const docCountKey = `${mapped.pc}|${mapped.oc}`;
      const itemCountKey = `${mapped.pc}|${mapped.factura ?? ''}`;
      return {
        id: `${mapped.pc}|${mapped.oc}`,
        pc: mapped.pc,
        orderNumber: mapped.oc,
        clientName: raw.customer_name,
        factura: mapped.factura,
        fecha_factura: mapped.fecha_factura,
        documents: docCountMap.get(docCountKey) || 0,
        items_count: itemsCountMap.get(itemCountKey) || 0,
        fecha_incoterm: mapped.fecha || mapped.fecha_factura || null,
        fecha_eta_factura: mapped.fecha_eta_factura,
        fecha_etd_factura: mapped.fecha_etd_factura,
        incoterm: mapped.incoterm,
        medio_envio_ov: mapped.medio_envio_ov,
        medio_envio_factura: mapped.medio_envio_factura,
        puerto_destino: mapped.puerto_destino
      };
    });
  };

/**
 * Obtiene documentos de una orden específica del cliente
 * @param {number} orderId - ID de la orden
 * @param {string} customerRut - RUT del cliente
 * @returns {Promise<Array|null>} Array de documentos o null si no autorizado
 */


/**
 * Obtiene una orden por RUT y OC
 * @param {string} rut - RUT del cliente
 * @param {string} oc - OC de la orden
 * @returns {Promise<object|null>} Orden encontrada o null
 */
  const getOrderByRutAndOc = async (rut, oc) => {
    try {
      const sqlPool = await getSqlPoolFn();
      const request = sqlPool.request();
      request.input('rut', sqlModule.VarChar, rut);
      request.input('oc', sqlModule.VarChar, normalizeOcForCompare(oc));

      const result = await request.query(`
        SELECT TOP 1
          h.Nro AS pc,
          h.Rut AS rut,
          h.OC AS oc,
          h.Factura AS factura,
          h.Fecha_factura AS fec_factura
        FROM jor_imp_HDR_90_softkey h
        WHERE h.Rut = @rut AND UPPER(REPLACE(REPLACE(REPLACE(REPLACE(h.OC, ' ', ''), '(', ''), ')', ''), '-', '')) = UPPER(@oc)
        ORDER BY CAST(h.Fecha AS date) DESC
      `);

      const row = result.recordset?.[0];
      return row || null;
    } catch (error) {
      logger.error('Error getting order by RUT and OC:', error.message);
      throw error;
    }
  };

/**
 * Obtiene una orden por ID simple (sin validación de permisos)
 * @param {number} orderId - ID de la orden
 * @returns {Promise<object|null>} Orden encontrada o null
 */
  const getOrderByIdSimple = async (orderId) => {
    try {
      const key = await resolveOrderKey(orderId);
      if (!key) return null;

      const sqlPool = await getSqlPoolFn();
      const request = sqlPool.request();
      request.input('pc', sqlModule.VarChar, key.pc);
      request.input('oc', sqlModule.VarChar, normalizeOcForCompare(key.oc));

      const result = await request.query(`
        SELECT TOP 1
          h.Nro,
          h.OC,
          h.Rut,
          h.Fecha,
          h.Factura,
          h.Fecha_factura,
          h.ETD_OV,
          h.ETA_OV,
          h.ETD_ENC_FA,
          h.ETA_ENC_FA,
          h.Job,
          h.MedioDeEnvioFact,
          h.MedioDeEnvioOV,
          h.Clausula,
          h.Puerto_Destino,
          h.Certificados,
          h.EstadoOV,
          h.Vendedor,
          h.IDNroOvMasFactura,
          c.Nombre AS customer_name
        FROM jor_imp_HDR_90_softkey h
        LEFT JOIN jor_imp_CLI_01_softkey c ON c.Rut = h.Rut
        WHERE h.Nro = @pc AND UPPER(REPLACE(REPLACE(REPLACE(REPLACE(h.OC, ' ', ''), '(', ''), ')', ''), '-', '')) = UPPER(@oc)
        ORDER BY CAST(h.Fecha AS date) DESC
      `);

      const row = result.recordset?.[0];
      if (!row) return null;

      const mapped = hdrMapper(row);
      return new Order({
        id: `${mapped.pc}|${mapped.oc}`,
        rut: mapped.rut,
        pc: mapped.pc,
        oc: mapped.oc,
        created_at: mapped.fecha || mapped.fecha_factura || null,
        updated_at: mapped.fecha || mapped.fecha_factura || null,
        customer_name: row.customer_name,
        customer_uuid: mapped.rut,
        order_id: null,
        factura: mapped.factura,
        fecha_factura: mapped.fecha_factura,
        fecha: mapped.fecha,
        fecha_ingreso: mapped.fecha || mapped.fecha_factura || null,
        fecha_etd: mapped.fecha_etd,
        fecha_eta: mapped.fecha_eta,
        fecha_etd_factura: mapped.fecha_etd_factura,
        fecha_eta_factura: mapped.fecha_eta_factura,
        currency: mapped.currency,
        medio_envio_factura: mapped.medio_envio_factura,
        medio_envio_ov: mapped.medio_envio_ov,
        incoterm: mapped.incoterm,
        puerto_destino: mapped.puerto_destino,
        certificados: mapped.certificados,
        estado_ov: mapped.estado_ov,
        id_nro_ov_mas_factura: mapped.id_nro_ov_mas_factura
      });
    } catch (error) {
      logger.error('Error en getOrderByIdSimple:', error.message);
      throw error;
    }
  };

  /**
   * Obtiene una orden por PC y OC (sin validación de permisos)
   * @param {string} pc - Número PC
   * @param {string} oc - Número OC
   * @returns {Promise<object|null>} Orden encontrada o null
   */
    const getOrderByPcOc = async (pc, oc) => {
      try {
        if (!pc || !oc) return null;

        const normalizedPc = typeof pc === 'string' ? pc.trim() : String(pc);
        const normalizedOc = typeof oc === 'string'
          ? oc.trim().replace(/[()\s-]+/g, '')
          : String(oc).replace(/[()\s-]+/g, '');
        const sqlPool = await getSqlPoolFn();
        const request = sqlPool.request();
        request.input('pc', sqlModule.VarChar, normalizedPc);
        request.input('oc', sqlModule.VarChar, normalizeOcForCompare(normalizedOc));

        const result = await request.query(`
          SELECT TOP 1
            h.Nro,
            h.OC,
          h.Rut,
          h.Fecha,
          h.Factura,
          h.Fecha_factura,
          h.ETD_OV,
          h.ETA_OV,
          h.ETD_ENC_FA,
          h.ETA_ENC_FA,
          h.Job,
          h.MedioDeEnvioFact,
          h.MedioDeEnvioOV,
          h.Clausula,
          h.Puerto_Destino,
          h.Certificados,
          h.EstadoOV,
          h.Vendedor,
          h.IDNroOvMasFactura,
          c.Nombre AS customer_name
          FROM jor_imp_HDR_90_softkey h
          LEFT JOIN jor_imp_CLI_01_softkey c ON c.Rut = h.Rut
          WHERE h.Nro = @pc
            AND UPPER(REPLACE(REPLACE(REPLACE(REPLACE(h.OC, ' ', ''), '(', ''), ')', ''), '-', '')) = UPPER(@oc)
          ORDER BY CAST(h.Fecha AS date) DESC
        `);

      const row = result.recordset?.[0];
      if (!row) return null;

      const mapped = hdrMapper(row);
      return new Order({
        id: `${mapped.pc}|${mapped.oc}`,
        rut: mapped.rut,
        pc: mapped.pc,
        oc: mapped.oc,
        created_at: mapped.fecha || mapped.fecha_factura || null,
        updated_at: mapped.fecha || mapped.fecha_factura || null,
        customer_name: row.customer_name,
        customer_uuid: mapped.rut,
        order_id: null,
        factura: mapped.factura,
        fecha_factura: mapped.fecha_factura,
        fecha: mapped.fecha,
        fecha_ingreso: mapped.fecha || mapped.fecha_factura || null,
        fecha_etd: mapped.fecha_etd,
        fecha_eta: mapped.fecha_eta,
        fecha_etd_factura: mapped.fecha_etd_factura,
        fecha_eta_factura: mapped.fecha_eta_factura,
        currency: mapped.currency,
        medio_envio_factura: mapped.medio_envio_factura,
        medio_envio_ov: mapped.medio_envio_ov,
        incoterm: mapped.incoterm,
        puerto_destino: mapped.puerto_destino,
        certificados: mapped.certificados,
        estado_ov: mapped.estado_ov,
        id_nro_ov_mas_factura: mapped.id_nro_ov_mas_factura
      });
    } catch (error) {
      logger.error('Error en getOrderByPcOc:', error.message);
      throw error;
    }
  };

  /**
   * Obtiene una orden por PC (sin validación de permisos)
   * @param {string} pc - Número PC
   * @returns {Promise<object|null>} Orden encontrada o null
   */
  const getOrderByPc = async (pc) => {
    try {
      if (!pc) return null;

      const sqlPool = await getSqlPoolFn();
      const request = sqlPool.request();
      request.input('pc', sqlModule.VarChar, pc);

      const result = await request.query(`
        SELECT TOP 1
          h.Nro,
          h.OC,
          h.Rut,
          h.Fecha,
          h.Factura,
          h.Fecha_factura,
          h.ETD_OV,
          h.ETA_OV,
          h.ETD_ENC_FA,
          h.ETA_ENC_FA,
          h.Job,
          h.MedioDeEnvioFact,
          h.MedioDeEnvioOV,
          h.Clausula,
          h.Puerto_Destino,
          h.Certificados,
          h.EstadoOV,
          h.Vendedor,
          c.Nombre AS customer_name
        FROM jor_imp_HDR_90_softkey h
        LEFT JOIN jor_imp_CLI_01_softkey c ON c.Rut = h.Rut
        WHERE h.Nro = @pc
        ORDER BY CAST(h.Fecha AS date) DESC
      `);

      const row = result.recordset?.[0];
      if (!row) return null;

      const mapped = hdrMapper(row);
      return new Order({
        id: `${mapped.pc}|${mapped.oc}`,
        rut: mapped.rut,
        pc: mapped.pc,
        oc: mapped.oc,
        created_at: mapped.fecha || mapped.fecha_factura || null,
        updated_at: mapped.fecha || mapped.fecha_factura || null,
        customer_name: row.customer_name,
        customer_uuid: mapped.rut,
        order_id: null,
        factura: mapped.factura,
        fecha_factura: mapped.fecha_factura,
        fecha: mapped.fecha,
        fecha_ingreso: mapped.fecha || mapped.fecha_factura || null,
        fecha_etd: mapped.fecha_etd,
        fecha_eta: mapped.fecha_eta,
        fecha_etd_factura: mapped.fecha_etd_factura,
        fecha_eta_factura: mapped.fecha_eta_factura,
        currency: mapped.currency,
        medio_envio_factura: mapped.medio_envio_factura,
        medio_envio_ov: mapped.medio_envio_ov,
        incoterm: mapped.incoterm,
        puerto_destino: mapped.puerto_destino,
        certificados: mapped.certificados,
        estado_ov: mapped.estado_ov,
        id_nro_ov_mas_factura: mapped.id_nro_ov_mas_factura
      });
    } catch (error) {
      logger.error('Error en getOrderByPc:', error.message);
      throw error;
    }
  };

/**
 * Obtiene una orden por ID con validación de permisos
 * @param {number} orderId - ID de la orden
 * @param {object} user - Usuario autenticado
 * @returns {Promise<object|null>} Orden encontrada o null
 */
  const getOrderById = async (orderId, user) => {
    try {
      const key = await resolveOrderKey(orderId);
      if (!key) return null;

      const roleId = Number(user.roleId || user.role_id);
      const sqlPool = await getSqlPoolFn();
      const request = sqlPool.request();
      request.input('pc', sqlModule.VarChar, key.pc);
      request.input('oc', sqlModule.VarChar, normalizeOcForCompare(key.oc));

      const result = await request.query(`
        SELECT TOP 1
          h.Nro,
          h.OC,
          h.Rut,
          h.Fecha,
          h.Factura,
          h.Fecha_factura,
          h.ETD_OV,
          h.ETA_OV,
          h.ETD_ENC_FA,
          h.ETA_ENC_FA,
          h.Job,
          h.MedioDeEnvioFact,
          h.MedioDeEnvioOV,
          h.Clausula,
          h.Puerto_Destino,
          h.Certificados,
          h.EstadoOV,
          h.Vendedor,
          c.Nombre AS customer_name
        FROM jor_imp_HDR_90_softkey h
        LEFT JOIN jor_imp_CLI_01_softkey c ON c.Rut = h.Rut
        WHERE h.Nro = @pc AND UPPER(REPLACE(REPLACE(REPLACE(REPLACE(h.OC, ' ', ''), '(', ''), ')', ''), '-', '')) = UPPER(@oc)
        ORDER BY CAST(h.Fecha AS date) DESC
      `);

      const row = result.recordset?.[0];
      if (!row) return null;

      const mapped = hdrMapper(row);

      if (user.role === 'client' &&
          normalizeRutForCompare(mapped.rut) !== normalizeRutForCompare(user.rut || user.email)) {
        return null;
      }

      if (roleId === 3) {
        const pool = await mysqlPoolPromise;
        const sellerCodes = await getSellerCodesByRut(user.rut || user.email);
        if (!sellerCodes.includes(mapped.vendedor)) {
          return null;
        }
      }

      return new Order({
        id: `${mapped.pc}|${mapped.oc}`,
        rut: mapped.rut,
        pc: mapped.pc,
        oc: mapped.oc,
        created_at: mapped.fecha || mapped.fecha_factura || null,
        updated_at: mapped.fecha || mapped.fecha_factura || null,
        customer_name: row.customer_name,
        customer_rut: mapped.rut,
        customer_uuid: mapped.rut,
        order_id: null,
        factura: mapped.factura,
        fecha_factura: mapped.fecha_factura,
        fecha: mapped.fecha,
        fecha_ingreso: mapped.fecha || mapped.fecha_factura || null,
        fecha_etd: mapped.fecha_etd,
        fecha_eta: mapped.fecha_eta,
        fecha_etd_factura: mapped.fecha_etd_factura,
        fecha_eta_factura: mapped.fecha_eta_factura,
        currency: mapped.currency,
        medio_envio_factura: mapped.medio_envio_factura,
        medio_envio_ov: mapped.medio_envio_ov,
        incoterm: mapped.incoterm,
        puerto_destino: mapped.puerto_destino,
        certificados: mapped.certificados,
        estado_ov: mapped.estado_ov
      });
    } catch (error) {
      logger.error('Error en getOrderById:', error.message);
      throw error;
    }
  };

/**
 * Obtener detalles de una orden específica
 * @param {number} orderPc - PC de la orden
 * @param {object} user - Usuario autenticado
 * @returns {Promise<array|null>} Detalles de la orden o null
 */
  const getOrderDetails = async (orderId, user) => {
    try {
      const key = await resolveOrderKey(orderId);
      if (!key) return null;

      const roleId = Number(user.roleId || user.role_id);
      const sqlPool = await getSqlPoolFn();
      const request = sqlPool.request();
      request.input('pc', sqlModule.VarChar, key.pc);
      request.input('oc', sqlModule.VarChar, normalizeOcForCompare(key.oc));

      const result = await request.query(`
        SELECT TOP 1
          h.Nro,
          h.OC,
          h.Rut,
          h.Fecha,
          h.Factura,
          h.Fecha_factura,
          h.ETD_OV,
          h.ETA_OV,
          h.ETD_ENC_FA,
          h.ETA_ENC_FA,
          h.MedioDeEnvioFact,
          h.MedioDeEnvioOV,
          h.Clausula,
          h.Puerto_Destino,
          h.Certificados,
          h.EstadoOV,
          h.Vendedor
        FROM jor_imp_HDR_90_softkey h
        WHERE h.Nro = @pc AND UPPER(REPLACE(REPLACE(REPLACE(REPLACE(h.OC, ' ', ''), '(', ''), ')', ''), '-', '')) = UPPER(@oc)
        ORDER BY CAST(h.Fecha AS date) DESC
      `);

      const row = result.recordset?.[0];
      if (!row) return null;

      const mapped = hdrMapper(row);

      if (user.role === 'client' &&
          normalizeRutForCompare(mapped.rut) !== normalizeRutForCompare(user.rut || user.email)) {
        return null;
      }

      if (roleId === 3) {
        const pool = await mysqlPoolPromise;
        const sellerCodes = await getSellerCodesByRut(user.rut || user.email);
        if (!sellerCodes.includes(mapped.vendedor)) {
          return null;
        }
      }

      return {
        pc: mapped.pc,
        oc: mapped.oc,
        factura: mapped.factura,
        fecha_factura: mapped.fecha_factura,
        fecha: mapped.fecha,
        fecha_ingreso: mapped.fecha || mapped.fecha_factura || null,
        fecha_etd: mapped.fecha_etd,
        fecha_eta: mapped.fecha_eta,
        fecha_etd_factura: mapped.fecha_etd_factura,
        fecha_eta_factura: mapped.fecha_eta_factura,
        medio_envio_factura: mapped.medio_envio_factura,
        medio_envio_ov: mapped.medio_envio_ov,
        incoterm: mapped.incoterm,
        puerto_destino: mapped.puerto_destino,
        certificados: mapped.certificados,
        estado_ov: mapped.estado_ov,
        vendedor: mapped.vendedor,
        customer_rut: mapped.rut
      };
    } catch (error) {
      logger.error('Error en getOrderDetails:', error.message);
      throw error;
    }
  };


/**
 * Obtiene los detalles completos de una orden específica
 * @param {number} orderId - ID de la orden
 * @param {object} user - Usuario autenticado
 * @returns {Promise<object|null>} Detalles de la orden o null
 */
  const getOrderDetail = async (orderId, user) => {
    try {
      return await getOrderDetails(orderId, user);
    } catch (error) {
      logger.error('Error en getOrderDetail:', error.message);
      throw error;
    }
  };


/**
 * Obtiene las órdenes que cumplen con la condición de alerta por falta de documentos.
 * @param {Object} options
 * @param {string} options.fechaAlerta - Fecha mínima de ingreso de la orden (formato YYYY-MM-DD).
 * @param {number} [options.minDocuments=5] - Cantidad mínima de documentos requeridos.
 * @returns {Promise<Array>}
 */
  const getOrdersMissingDocumentsAlert = async ({ fechaAlerta, minDocuments = 5 }) => {
    try {
      const sanitizedFecha = normalizeDateInput(fechaAlerta) || '1970-01-01';
      const sqlPool = await getSqlPoolFn();

      const request = sqlPool.request();
      request.input('fecha', sqlModule.Date, sanitizedFecha);

      const sqlResult = await request.query(`
        SELECT
          h.Nro AS pc,
          h.OC AS oc,
          h.Rut AS customer_rut,
          c.Nombre AS customer_name,
          h.Fecha AS fecha,
          h.ETD_OV AS fecha_etd
        FROM jor_imp_HDR_90_softkey h
        LEFT JOIN jor_imp_CLI_01_softkey c ON c.Rut = h.Rut
        WHERE CASE
            WHEN ISDATE(ISNULL(h.Fecha, h.Fecha_factura)) = 1
            THEN CAST(ISNULL(h.Fecha, h.Fecha_factura) AS date)
          END >= @fecha
          AND ISDATE(h.ETD_OV) = 1
          AND DATEADD(day, 5, CAST(h.ETD_OV AS date)) <= CAST(GETDATE() AS date)
        ORDER BY CAST(h.ETD_OV AS date) ASC, h.Nro ASC
      `);

      const rows = sqlResult.recordset || [];
      if (!rows.length) return [];

      const pool = await mysqlPoolPromise;
      const conditions = rows.map(() => '(pc = ? AND oc = ?)').join(' OR ');
      const params = rows.flatMap((row) => [row.pc, row.oc]);
      const [docCounts] = await pool.query(
        `
          SELECT pc, oc, COUNT(*) AS document_count
          FROM order_files
          WHERE ${conditions}
          GROUP BY pc, oc
        `,
        params
      );

      const countMap = new Map(
        docCounts.map((row) => [`${row.pc}|${row.oc}`, Number(row.document_count || 0)])
      );

      return rows
        .map((row) => {
          const key = `${row.pc}|${row.oc}`;
          const documentCount = countMap.get(key) || 0;
          return {
            id: key,
            pc: row.pc,
            oc: row.oc,
            customer_name: row.customer_name,
            customer_uuid: row.customer_rut,
            fecha: row.fecha,
            fecha_etd: row.fecha_etd,
            document_count: documentCount
          };
        })
        .filter((row) => row.document_count < minDocuments);
    } catch (error) {
      logger.error('Error en getOrdersMissingDocumentsAlert:', error.message);
      throw error;
    }
  };

  const getSalesDashboardData = async ({ startDate, endDate, metricType }) => {
    const sqlPool = await getSqlPoolFn();
    const range = clampDateRange(startDate, endDate);
    const today = formatDateOnly(new Date());
    const metric = metricType === 'solicitados' ? 'solicitados' : 'facturados';
    const kgExpr = metric === 'solicitados'
      ? 'ISNULL(i.Cant_ordenada, 0)'
      : 'ISNULL(i.KilosFacturados, 0)';
    const amountExpr = `${kgExpr} * ISNULL(i.Precio_Unit, 0)`;

    const baseWhere = `
      h.Fecha_factura IS NOT NULL
      AND CAST(h.Fecha_factura AS date) BETWEEN @start AND @end
      AND h.Factura IS NOT NULL
      AND LTRIM(RTRIM(CONVERT(varchar(50), h.Factura))) <> ''
      AND h.Factura <> 0
      AND ${kgExpr} > 0
    `;

    const withCurrency = `${baseWhere} AND h.Job = @currency`;

    const totalsQuery = `
      SELECT
        COALESCE(SUM(${amountExpr}), 0) AS total_sales,
        COALESCE(SUM(${kgExpr}), 0) AS total_kg,
        COUNT(DISTINCT CONCAT(h.Nro, '|', h.OC)) AS total_orders
      FROM jor_imp_HDR_90_softkey h
      JOIN jor_imp_item_90_softkey i
        ON i.Nro = h.Nro AND i.Factura = h.Factura
      WHERE ${withCurrency}
    `;

    const startOfWeek = (dateStr) => {
      const date = new Date(`${dateStr}T00:00:00`);
      const day = date.getDay();
      const diff = day === 0 ? 6 : day - 1;
      date.setDate(date.getDate() - diff);
      return formatDateOnly(date);
    };

    const startOfMonth = (dateStr) => {
      const date = new Date(`${dateStr}T00:00:00`);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
    };

    const startOfYear = (dateStr) => {
      const date = new Date(`${dateStr}T00:00:00`);
      return `${date.getFullYear()}-01-01`;
    };

    const computeCalendarTotal = async (periodStart, currency) => {
      const request = sqlPool.request();
      request.input('start', sqlModule.Date, periodStart);
      request.input('end', sqlModule.Date, today);
      request.input('currency', sqlModule.VarChar, currency);
      const result = await request.query(totalsQuery);
      const row = result.recordset?.[0];
      return Number(row?.total_sales || 0);
    };

    const buildSeries = (seriesRows, groupByMonth) => {
      const seriesMap = new Map(
        seriesRows.map((row) => [
          String(row.period),
          { sales: Number(row.total_sales || 0), kg: Number(row.total_kg || 0) }
        ])
      );

      const labels = [];
      const sales = [];
      const kg = [];

      if (groupByMonth) {
        const start = new Date(`${range.startDate}T00:00:00`);
        const end = new Date(`${range.endDate}T00:00:00`);
        const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
        const endCursor = new Date(end.getFullYear(), end.getMonth(), 1);

        while (cursor <= endCursor) {
          const label = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
          const entry = seriesMap.get(label) || { sales: 0, kg: 0 };
          labels.push(label);
          sales.push(entry.sales);
          kg.push(entry.kg);
          cursor.setMonth(cursor.getMonth() + 1);
        }
      } else {
        const start = new Date(`${range.startDate}T00:00:00`);
        const end = new Date(`${range.endDate}T00:00:00`);
        const cursor = new Date(start);
        while (cursor <= end) {
          const label = formatDateOnly(cursor);
          const entry = seriesMap.get(label) || { sales: 0, kg: 0 };
          labels.push(label);
          sales.push(entry.sales);
          kg.push(entry.kg);
          cursor.setDate(cursor.getDate() + 1);
        }
      }

      return { labels, sales, kg };
    };

    const fetchCurrencyData = async (currency) => {
      const normalizedCurrency = String(currency || '').toUpperCase();
      const start = new Date(`${range.startDate}T00:00:00`);
      const end = new Date(`${range.endDate}T00:00:00`);
      const diffDays = Math.round((end - start) / (1000 * 60 * 60 * 24));
      const groupByMonth = diffDays > 90;
      const periodExpr = groupByMonth
        ? "CONVERT(char(7), h.Fecha_factura, 120)"
        : 'CAST(h.Fecha_factura AS date)';

      const seriesQuery = `
        SELECT
          ${periodExpr} AS period,
          COALESCE(SUM(${amountExpr}), 0) AS total_sales,
          COALESCE(SUM(${kgExpr}), 0) AS total_kg
        FROM jor_imp_HDR_90_softkey h
        JOIN jor_imp_item_90_softkey i
          ON i.Nro = h.Nro AND i.Factura = h.Factura
        WHERE ${withCurrency}
        GROUP BY ${periodExpr}
        ORDER BY ${periodExpr} ASC
      `;

      const topProductsQuery = `
        SELECT TOP 10
          COALESCE(NULLIF(i.Descripcion, ''), i.Item, 'Producto') AS product_name,
          COALESCE(SUM(${kgExpr}), 0) AS total_kg,
          COALESCE(SUM(${amountExpr}), 0) AS total_sales
        FROM jor_imp_HDR_90_softkey h
        JOIN jor_imp_item_90_softkey i
          ON i.Nro = h.Nro AND i.Factura = h.Factura
        WHERE ${withCurrency}
        GROUP BY COALESCE(NULLIF(i.Descripcion, ''), i.Item, 'Producto')
        ORDER BY total_sales DESC
      `;

      const topCustomersQuery = `
        SELECT TOP 10
          c.Nombre AS customer_name,
          COALESCE(SUM(${kgExpr}), 0) AS total_kg,
          COALESCE(SUM(${amountExpr}), 0) AS total_sales
        FROM jor_imp_HDR_90_softkey h
        JOIN jor_imp_item_90_softkey i
          ON i.Nro = h.Nro AND i.Factura = h.Factura
        LEFT JOIN jor_imp_CLI_01_softkey c ON c.Rut = h.Rut
        WHERE ${withCurrency}
        GROUP BY c.Nombre
        ORDER BY total_sales DESC
      `;

      const totalsRequest = sqlPool.request();
      totalsRequest.input('start', sqlModule.Date, range.startDate);
      totalsRequest.input('end', sqlModule.Date, range.endDate);
      totalsRequest.input('currency', sqlModule.VarChar, normalizedCurrency);
      const totalsResult = await totalsRequest.query(totalsQuery);

      const seriesRequest = sqlPool.request();
      seriesRequest.input('start', sqlModule.Date, range.startDate);
      seriesRequest.input('end', sqlModule.Date, range.endDate);
      seriesRequest.input('currency', sqlModule.VarChar, normalizedCurrency);
      const seriesResult = await seriesRequest.query(seriesQuery);

      const productsRequest = sqlPool.request();
      productsRequest.input('start', sqlModule.Date, range.startDate);
      productsRequest.input('end', sqlModule.Date, range.endDate);
      productsRequest.input('currency', sqlModule.VarChar, normalizedCurrency);
      const productsResult = await productsRequest.query(topProductsQuery);

      const customersRequest = sqlPool.request();
      customersRequest.input('start', sqlModule.Date, range.startDate);
      customersRequest.input('end', sqlModule.Date, range.endDate);
      customersRequest.input('currency', sqlModule.VarChar, normalizedCurrency);
      const customersResult = await customersRequest.query(topCustomersQuery);

      const rangeTotals = totalsResult.recordset?.[0] || {};
      const seriesRows = seriesResult.recordset || [];
      const topProductsRows = productsResult.recordset || [];
      const topCustomersRows = customersResult.recordset || [];

      const [weeklySales, monthlySales, annualSales] = await Promise.all([
        computeCalendarTotal(startOfWeek(today), normalizedCurrency),
        computeCalendarTotal(startOfMonth(today), normalizedCurrency),
        computeCalendarTotal(startOfYear(today), normalizedCurrency)
      ]);

      const series = buildSeries(seriesRows, groupByMonth);

      const avgTicket = rangeTotals.total_orders ? rangeTotals.total_sales / rangeTotals.total_orders : 0;
      const avgKg = rangeTotals.total_orders ? rangeTotals.total_kg / rangeTotals.total_orders : 0;

      return {
        currency: normalizedCurrency,
        rangeTotals: {
          sales: Number(rangeTotals.total_sales || 0),
          kg: Number(rangeTotals.total_kg || 0),
          orders: Number(rangeTotals.total_orders || 0)
        },
        period: {
          weeklySales,
          monthlySales,
          annualSales
        },
        series: {
          groupBy: groupByMonth ? 'month' : 'day',
          labels: series.labels,
          sales: series.sales,
          kg: series.kg
        },
        summary: {
          avgTicket,
          avgKg
        },
        topProducts: topProductsRows.map((row) => ({
          name: row.product_name || 'Producto',
          kg: Number(row.total_kg || 0),
          sales: Number(row.total_sales || 0)
        })),
        topCustomers: topCustomersRows.map((row) => ({
          name: row.customer_name || 'Cliente',
          kg: Number(row.total_kg || 0),
          sales: Number(row.total_sales || 0)
        }))
      };
    };

    const [usdData, eurData] = await Promise.all([
      fetchCurrencyData('USD'),
      fetchCurrencyData('EUR')
    ]);

    return {
      range,
      today,
      metric,
      currencies: {
        USD: usdData,
        EUR: eurData
      }
    };
  };

  const getOrderItems = async (orderPc, orderOc, factura, user, idNroOvMasFactura = null) => {
    try {
      const roleId = Number(user.roleId || user.role_id);
      const sqlPool = await getSqlPoolFn();
      const normalizedId = idNroOvMasFactura ? String(idNroOvMasFactura).trim() : null;

      const headerRequest = sqlPool.request();
      headerRequest.input('pc', sqlModule.VarChar, orderPc);
      headerRequest.input('oc', sqlModule.VarChar, normalizeOcForCompare(orderOc));
      if (factura && factura !== 'null') {
        headerRequest.input('factura', sqlModule.VarChar, factura);
      }
      if (normalizedId) {
        headerRequest.input('idNroOvMasFactura', sqlModule.VarChar, normalizedId);
      }

      const headerResult = await headerRequest.query(`
        SELECT TOP 1
          h.Nro,
          h.OC,
          h.Job,
          h.Rut,
          h.Factura,
          h.Vendedor,
          c.Nombre AS customer_name
        FROM jor_imp_HDR_90_softkey h
        LEFT JOIN jor_imp_CLI_01_softkey c ON c.Rut = h.Rut
        WHERE h.Nro = @pc AND UPPER(REPLACE(REPLACE(REPLACE(REPLACE(h.OC, ' ', ''), '(', ''), ')', ''), '-', '')) = UPPER(@oc)
        ${factura && factura !== 'null' ? 'AND h.Factura = @factura' : ''}
        ${normalizedId ? 'AND h.IDNroOvMasFactura = @idNroOvMasFactura' : ''}
        ORDER BY CAST(h.Fecha AS date) DESC
      `);

      const headerRow = headerResult.recordset?.[0];
      if (!headerRow) return null;

      const mappedHeader = hdrMapper(headerRow);

      if (user.role === 'client' &&
          normalizeRutForCompare(mappedHeader.rut) !== normalizeRutForCompare(user.rut || user.email)) {
        return null;
      }

      if (roleId === 3) {
        const pool = await mysqlPoolPromise;
        const sellerCodes = await getSellerCodesByRut(user.rut || user.email);
        if (!sellerCodes.includes(mappedHeader.vendedor)) {
          return null;
        }
      }

      const itemsRequest = sqlPool.request();
      itemsRequest.input('pc', sqlModule.VarChar, orderPc);
      if (factura && factura !== 'null') {
        itemsRequest.input('factura', sqlModule.VarChar, factura);
      }
      if (normalizedId) {
        itemsRequest.input('idNroOvMasFactura', sqlModule.VarChar, normalizedId);
      }

      const itemsResult = await itemsRequest.query(`
        SELECT *
        FROM jor_imp_item_90_softkey
        WHERE Nro = @pc
        ${factura && factura !== 'null'
          ? 'AND Factura = @factura'
          : "AND (Factura IS NULL OR Factura = '' OR Factura = 0 OR Factura = '0')"}
        ${normalizedId ? 'AND IDNroOvMasFactura = @idNroOvMasFactura' : ''}
        ORDER BY Linea ASC
      `);

      const items = (itemsResult.recordset || []).map((row) => itemMapper(row));
      const currency = mappedHeader.currency || '';
      const customerName = headerRow.customer_name?.trim() || '';
      return items.map((item) => ({
        ...item,
        currency,
        customer_name: customerName
      }));
    } catch (error) {
      logger.error('Error en getOrderItems:', error.message);
      throw error;
    }
  };

  const getOrderItemsWithoutFactura = async (orderPc, orderOc, user) => {
    try {
      return await getOrderItems(orderPc, orderOc, null, user);
    } catch (error) {
      logger.error('Error en getOrderItemsWithoutFactura:', error.message);
      throw error;
    }
  };

  const getClientOrderDocuments = async (orderId, customerRut) => {
    try {
      const key = await resolveOrderKey(orderId);
      if (!key) return null;

      const sqlPool = await getSqlPoolFn();
      const request = sqlPool.request();
      request.input('pc', sqlModule.VarChar, key.pc);
      request.input('oc', sqlModule.VarChar, normalizeOcForCompare(key.oc));

      const headerResult = await request.query(`
        SELECT TOP 1
          h.Nro,
          h.OC,
          h.Rut,
          h.Factura,
          h.Fecha_factura,
          c.Nombre AS customer_name
        FROM jor_imp_HDR_90_softkey h
        LEFT JOIN jor_imp_CLI_01_softkey c ON c.Rut = h.Rut
        WHERE h.Nro = @pc AND UPPER(REPLACE(REPLACE(REPLACE(REPLACE(h.OC, ' ', ''), '(', ''), ')', ''), '-', '')) = UPPER(@oc)
        ORDER BY CAST(h.Fecha AS date) DESC
      `);

      const headerRow = headerResult.recordset?.[0];
      if (!headerRow) return null;

      const mappedHeader = hdrMapper(headerRow);
      if (normalizeRutForCompare(mappedHeader.rut) !== normalizeRutForCompare(customerRut)) {
        return null;
      }

      const pool = await mysqlPoolPromise;
      const documentsQuery = `
        SELECT 
          ofi.id,
          ofi.name AS filename,
          ofi.path AS filepath,
          ofi.file_type AS filetype,
          ofi.created_at,
          ofi.updated_at,
          CASE 
            WHEN ofi.status_id = 1 THEN 'Por Generar'
            WHEN ofi.status_id = 2 THEN 'Generado'
            WHEN ofi.status_id = 3 THEN 'Enviado'
            ELSE 'Desconocido'
          END AS status,
          CASE
            WHEN ofi.status_id = 1 THEN 'red'
            WHEN ofi.status_id = 2 THEN 'blue'
            WHEN ofi.status_id = 3 THEN 'gray'
            ELSE 'gray'
          END AS statusColor
        FROM order_files ofi
        WHERE ofi.pc = ? AND ofi.oc = ?
        AND ofi.is_visible_to_client = 1
        ORDER BY ofi.created_at DESC
      `;

      const [documents] = await pool.query(documentsQuery, [mappedHeader.pc, mappedHeader.oc]);

      return {
        order: {
          id: `${mappedHeader.pc}|${mappedHeader.oc}`,
          orderNumber: mappedHeader.oc,
          clientName: headerRow.customer_name
        },
        documents: documents.map(doc => ({
          id: doc.id,
          filename: doc.filename,
          filepath: doc.filepath,
          filetype: doc.filetype,
          filesize: 0,
          created: doc.created_at,
          updated: doc.updated_at,
          factura: mappedHeader.factura,
          fecha_factura: mappedHeader.fecha_factura,
          status: doc.status,
          statusColor: doc.statusColor
        }))
      };
    } catch (error) {
      logger.error('Error en getClientOrderDocuments:', error.message);
      throw error;
    }
  };

  const getPriceAnalysisData = async ({ startDate, endDate, productId, customerId, market, currency }) => {
    const sqlPool = await getSqlPoolFn();
    const range = clampDateRange(startDate, endDate);
    const normalizedCurrency = currency ? String(currency).trim().toUpperCase() : null;
    const normalizedMarket = market ? String(market).trim() : null;
    const normalizedProduct = productId ? String(productId).trim() : null;
    const normalizedCustomer = customerId ? String(customerId).trim() : null;

    const where = [
      'h.Fecha_factura IS NOT NULL',
      'CAST(h.Fecha_factura AS date) BETWEEN @start AND @end',
      'h.Factura IS NOT NULL',
      "LTRIM(RTRIM(CONVERT(varchar(50), h.Factura))) <> ''",
      'h.Factura <> 0'
    ];

    if (normalizedProduct) {
      where.push('i.Item = @productId');
    }

    if (normalizedCustomer) {
      where.push('h.Rut = @customerRut');
    }

    if (normalizedMarket) {
      where.push('i.Mercado = @market');
    }

    if (normalizedCurrency) {
      where.push('h.Job = @currency');
    }

    const baseFrom = `
      FROM jor_imp_HDR_90_softkey h
      JOIN jor_imp_item_90_softkey i
        ON i.Nro = h.Nro AND i.Factura = h.Factura
      LEFT JOIN jor_imp_CLI_01_softkey c ON c.Rut = h.Rut
      WHERE ${where.join(' AND ')}
    `;

    const summaryQuery = `
      SELECT
        MIN(i.Precio_Unit) AS min_price,
        MAX(i.Precio_Unit) AS max_price,
        AVG(i.Precio_Unit) AS avg_price,
        COALESCE(SUM(i.KilosFacturados), 0) AS total_kg,
        COALESCE(SUM(i.KilosFacturados * i.Precio_Unit), 0) AS total_sales,
        COUNT(*) AS total_rows,
        COUNT(DISTINCT CONCAT(h.Nro, '|', h.OC)) AS total_orders
      ${baseFrom}
    `;

    const rowsQuery = `
      SELECT TOP 500
        CONCAT(h.Nro, '|', h.OC) AS order_id,
        h.Nro AS pc,
        h.OC AS oc,
        h.Factura AS factura,
        CAST(h.Fecha_factura AS date) AS fecha,
        c.Nombre AS customer_name,
        i.Item AS item_id,
        COALESCE(NULLIF(i.Descripcion, ''), i.Item, 'Producto') AS product_name,
        i.Item AS item_code,
        i.Mercado AS mercado,
        i.Precio_Unit AS unit_price,
        COALESCE(i.KilosFacturados, 0) AS kg_facturados,
        h.Job AS currency
      ${baseFrom}
      ORDER BY fecha DESC, product_name ASC, customer_name ASC
    `;

    const productsQuery = `
      SELECT DISTINCT
        i.Item AS id,
        COALESCE(NULLIF(i.Descripcion, ''), i.Item, 'Producto') AS name
      ${baseFrom}
        AND i.Item IS NOT NULL
      ORDER BY name ASC
    `;

    const customersQuery = `
      SELECT DISTINCT
        h.Rut AS id,
        c.Nombre AS name
      ${baseFrom}
      ORDER BY name ASC
    `;

    const marketsQuery = `
      SELECT DISTINCT
        i.Mercado AS name
      ${baseFrom}
        AND i.Mercado IS NOT NULL
        AND i.Mercado <> ''
      ORDER BY name ASC
    `;

    const currenciesQuery = `
      SELECT DISTINCT
        h.Job AS name
      ${baseFrom}
        AND h.Job IS NOT NULL
        AND h.Job <> ''
      ORDER BY name ASC
    `;

    const buildRequest = () => {
      const request = sqlPool.request();
      request.input('start', sqlModule.Date, range.startDate);
      request.input('end', sqlModule.Date, range.endDate);
      if (normalizedProduct) request.input('productId', sqlModule.VarChar, normalizedProduct);
      if (normalizedCustomer) request.input('customerRut', sqlModule.VarChar, normalizedCustomer);
      if (normalizedMarket) request.input('market', sqlModule.VarChar, normalizedMarket);
      if (normalizedCurrency) request.input('currency', sqlModule.VarChar, normalizedCurrency);
      return request;
    };

    const summaryResult = await buildRequest().query(summaryQuery);
    const rowsResult = await buildRequest().query(rowsQuery);
    const productsResult = await buildRequest().query(productsQuery);
    const customersResult = await buildRequest().query(customersQuery);
    const marketsResult = await buildRequest().query(marketsQuery);
    const currenciesResult = await buildRequest().query(currenciesQuery);

    const summary = summaryResult.recordset?.[0] || {};
    const rows = rowsResult.recordset || [];
    const products = productsResult.recordset || [];
    const customers = customersResult.recordset || [];
    const markets = marketsResult.recordset || [];
    const currencies = currenciesResult.recordset || [];

    return {
      range,
      filters: {
        products: products.map((row) => ({ id: row.id, name: row.name })),
        customers: customers.map((row) => ({ id: row.id, name: row.name })),
        markets: markets.map((row) => row.name),
        currencies: currencies.map((row) => row.name)
      },
      summary: {
        minPrice: Number(summary?.min_price || 0),
        maxPrice: Number(summary?.max_price || 0),
        avgPrice: Number(summary?.avg_price || 0),
        totalKg: Number(summary?.total_kg || 0),
        totalSales: Number(summary?.total_sales || 0),
        totalRows: Number(summary?.total_rows || 0),
        totalOrders: Number(summary?.total_orders || 0)
      },
      rows: rows.map((row) => ({
        orderId: row.order_id,
        pc: row.pc,
        oc: row.oc,
        factura: row.factura,
        fecha: row.fecha,
        customer: row.customer_name,
        itemId: row.item_id,
        product: row.product_name,
        itemCode: row.item_code,
        market: row.mercado,
        unitPrice: Number(row.unit_price || 0),
        kgFacturados: Number(row.kg_facturados || 0),
        currency: row.currency || ''
      }))
    };
  };

  return {
    getOrdersByFilters,
    getClientDashboardOrders,
    getClientOrderDocuments,
    getOrderItems,
    getOrderItemsWithoutFactura,
    getOrderByRutAndOc,
    getOrderById,
    getOrderByIdSimple,
    getOrderByPcOc,
    getOrderByPc,
    getOrderDetails,
    getOrderDetail,
    getOrdersMissingDocumentsAlert,
    getSalesDashboardData,
    getPriceAnalysisData
  };
};

const defaultOrderService = createOrderService();

module.exports = {
  ...defaultOrderService,
  createOrderService
};
