const router = require('express').Router();
const pm2 = require('../controllers/pm2.controller');
const authMiddleware = require('../middleware/auth.middleware');

router.get('/processes', authMiddleware, pm2.listProcesses);
router.get('/processes/:name/logs', authMiddleware, pm2.getLogs);

module.exports = router;
