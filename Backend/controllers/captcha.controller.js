const { container } = require('../config/container');
const { logger } = require('../utils/logger');
const captchaService = container.resolve('captchaService');

exports.getChallenge = async (req, res) => {
  try {
    const portal = req.query.portal || 'admin';
    const config = await captchaService.resolvePortalCaptchaConfig(portal);

    if (config.active !== 1 || config.type !== 'self-hosted') {
      return res.status(400).json({ message: 'Self-hosted captcha not enabled for this portal' });
    }

    const challenge = await captchaService.generateChallenge();
    res.json(challenge);
  } catch (err) {
    logger.error(`[CaptchaController] getChallenge error: ${err.message}`);
    res.status(err.status || 500).json({ message: err.message });
  }
};

exports.verifyChallenge = async (req, res) => {
  try {
    const { token, x } = req.body;
    if (!token || x == null) {
      return res.status(400).json({ success: false, message: 'Missing token or x position' });
    }

    const result = captchaService.verifyChallenge(token, Number(x));
    res.json(result);
  } catch (err) {
    logger.error(`[CaptchaController] verifyChallenge error: ${err.message}`);
    res.status(500).json({ success: false, message: err.message });
  }
};
