const configService = require('../services/config.service');

/**
 * @route GET /api/config/pdf-mail-list
 * @desc Obtener lista de correos para PDFs
 * @access Admin only
 */
exports.getPdfMailList = async (req, res) => {
  try {
    const config = await configService.getConfigByName('pdfEmailConsultas');
    res.json(config ? config.params : { emails: [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * @route PUT /api/config/pdf-mail-list
 * @desc Actualizar lista de correos para PDFs
 * @access Admin only
 */
exports.updatePdfMailList = async (req, res) => {
  try {
    const { emails } = req.body;
    await configService.updateConfig('pdfEmailConsultas', { emails });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
