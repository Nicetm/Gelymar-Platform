const router = require('express').Router();
const docker = require('../controllers/docker.controller');
const authMiddleware = require('../middleware/auth.middleware');

router.get('/containers', authMiddleware, docker.listContainers);
router.get('/containers/:id/logs', authMiddleware, docker.getLogs);

module.exports = router;
