const { container } = require('../config/container');
const messageService = container.resolve('messageService');
const { MESSAGE_TYPES } = require('../models/message.model');
const { logger } = require('../utils/logger');
const { t } = require('../i18n');

exports.MESSAGE_TYPES = MESSAGE_TYPES;

exports.getSummary = async (req, res) => {
  try {
    const summary = await messageService.getSummary({ adminId: req.user.id });
    res.json({ success: true, data: summary });
  } catch (error) {
    logger.error(`[MessageController][getSummary] Error: ${error.message}`);
    res.status(500).json({ success: false, message: t('message.get_summary_error', req.lang || 'es') });
  }
};

exports.getMessages = async (req, res) => {
  try {
    const { type, page, limit, status, search } = req.query;

    const result = await messageService.getMessages({
      type,
      page,
      limit,
      status,
      search,
      adminId: req.user.id,
    });

    res.json({ success: true, data: result });
  } catch (error) {
    logger.error(`[MessageController][getMessages] Error: ${error.message}`);
    res.status(500).json({ success: false, message: t('message.get_messages_error', req.lang || 'es') });
  }
};

exports.getMessageDetail = async (req, res) => {
  try {
    const { type, id } = req.params;
    const normalizedType = type || MESSAGE_TYPES.MESSAGES;

    const detail = await messageService.getMessageDetail({
      type: normalizedType,
      id,
      adminId: req.user.id,
    });

    res.json({ success: true, data: detail });
  } catch (error) {
    logger.error(`[MessageController][getMessageDetail] Error: ${error.message}`);
    res.status(500).json({ success: false, message: t('message.get_message_detail_error', req.lang || 'es') });
  }
};
