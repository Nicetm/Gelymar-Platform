const { container } = require('../config/container');
const { logger } = require('../utils/logger');
const { t } = require('../i18n');

const projectionService = container.resolve('projectionService');

exports.getOptions = async (req, res) => {
  try {
    const sellerRut = req.user?.rut;
    const customerRut = req.query?.customerRut || '';
    const data = await projectionService.getOptions({ sellerRut, customerRut });
    res.json(data);
  } catch (error) {
    logger.error(`[getProjectionOptions] Error: ${error.message}`);
    res.status(500).json({ message: t('projection.options_error', req.lang || 'es') });
  }
};

exports.getProjectionData = async (req, res) => {
  try {
    const sellerRut = req.user?.rut;
    const {
      customerRut = '',
      productId = '',
      startDate = '',
      endDate = '',
      cutoffDate = '',
      period = 'monthly',
      metric = 'kg',
      growth = '0',
      currency = '',
      baseYear = '',
      compareMode = 'LY',
      forecastType = 'RUN_RATE',
      cutoffMode = 'YTD_SAME_CUTOFF',
      debug = ''
    } = req.query || {};

    const data = await projectionService.getProjectionData({
      sellerRut,
      customerRut,
      productId,
      startDate,
      endDate,
      cutoffDate,
      period,
      metric,
      growthPercent: growth,
      currency,
      baseYear,
      compareMode,
      forecastType,
      cutoffMode,
      debug: String(debug) === '1' || String(debug).toLowerCase() === 'true'
    });

    res.json(data);
  } catch (error) {
    logger.error(`[getProjectionData] Error: ${error.message}`);
    res.status(500).json({ message: t('projection.data_error', req.lang || 'es') });
  }
};
