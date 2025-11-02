const messageService = require('../services/message.service');
const { MESSAGE_TYPES } = require('../models/message.model');

exports.MESSAGE_TYPES = MESSAGE_TYPES;

exports.getSummary = async (req, res) => {
  try {
    const summary = await messageService.getSummary({ adminId: req.user.id });
    res.json({ success: true, data: summary });
  } catch (error) {
    console.error('[messages][getSummary] Error:', error.message);
    res.status(500).json({ success: false, message: 'Error al obtener el resumen de mensajes' });
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
    console.error('[messages][getMessages] Error:', error.message);
    res.status(500).json({ success: false, message: 'Error al obtener mensajes' });
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
    console.error('[messages][getMessageDetail] Error:', error.message);
    res.status(500).json({ success: false, message: 'Error al obtener detalle del mensaje' });
  }
};
