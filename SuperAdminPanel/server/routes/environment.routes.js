const router = require('express').Router();
const env = require('../controllers/environment.controller');
const authMiddleware = require('../middleware/auth.middleware');

router.post('/switch', env.switchEnv);
router.get('/current', env.current);
router.get('/config', env.getConfig);
router.put('/config', env.saveConfig);
router.get('/status', env.status);
router.get('/remembered', env.getRemembered);
router.post('/remembered', env.saveRemembered);

module.exports = router;
