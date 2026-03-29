const express = require('express');
const router = express.Router();
const captchaController = require('../controllers/captcha.controller');

router.get('/challenge', captchaController.getChallenge);
router.post('/verify', captchaController.verifyChallenge);

module.exports = router;
