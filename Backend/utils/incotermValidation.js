const { getConfigByName } = require('../services/config.service');
const { logger } = require('./logger');

let cachedConfig = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000; // 1 minute cache

/**
 * Reads validateIncoternFile config from param_config.
 * Returns { enable, shipmentIncoterms: Set, availabilityIncoterms: Set }
 */
async function getIncotermValidationConfig() {
  const now = Date.now();
  if (cachedConfig && (now - cacheTimestamp) < CACHE_TTL_MS) {
    return cachedConfig;
  }

  try {
    const config = await getConfigByName('validateIncoternFile');

    if (!config || config.params == null) {
      cachedConfig = { enable: false, shipmentIncoterms: new Set(), availabilityIncoterms: new Set() };
      cacheTimestamp = now;
      return cachedConfig;
    }

    let params = config.params;
    if (typeof params === 'string') params = JSON.parse(params);
    if (Buffer.isBuffer(params)) params = JSON.parse(params.toString('utf8'));

    if (params.enable !== 1) {
      cachedConfig = { enable: false, shipmentIncoterms: new Set(), availabilityIncoterms: new Set() };
      cacheTimestamp = now;
      return cachedConfig;
    }

    const shipment = (params.incoterm?.['Shipment Notice'] || []).map(v => String(v).trim().toUpperCase());
    const availability = (params.incoterm?.['Availability Notice'] || []).map(v => String(v).trim().toUpperCase());

    cachedConfig = {
      enable: true,
      shipmentIncoterms: new Set(shipment),
      availabilityIncoterms: new Set(availability),
    };
    cacheTimestamp = now;
    return cachedConfig;
  } catch (err) {
    logger.error(`[incotermValidation] Error reading config: ${err.message}`);
    return { enable: false, shipmentIncoterms: new Set(), availabilityIncoterms: new Set() };
  }
}

const hasFacturaValue = (value) => (
  value !== null && value !== undefined && value !== '' && value !== 0 && value !== '0'
);

const isInList = (list, value) => list.has(String(value || '').trim().toUpperCase());

/**
 * Returns canCreateShipment and canCreateAvailability functions
 * based on the current config.
 */
async function getIncotermValidators() {
  const config = await getIncotermValidationConfig();

  const canCreateShipment = (order) => {
    if (!hasFacturaValue(order.factura)) return false;
    if (!order.fecha_etd_factura || !order.fecha_eta_factura) return false;
    if (config.enable) {
      return isInList(config.shipmentIncoterms, order.incoterm);
    }
    return true; // enable=0: no incoterm validation
  };

  const canCreateAvailability = (order) => {
    if (!hasFacturaValue(order.factura)) return false;
    if (config.enable) {
      return isInList(config.availabilityIncoterms, order.incoterm);
    }
    return true; // enable=0: no incoterm validation
  };

  const canCreateDelivery = (order) => (
    hasFacturaValue(order.factura) && !!order.fecha_eta_factura
  );

  return { canCreateShipment, canCreateAvailability, canCreateDelivery, config };
}

module.exports = { getIncotermValidationConfig, getIncotermValidators, hasFacturaValue, isInList };
