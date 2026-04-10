const router = require('express').Router();
const orphans = require('../controllers/orphans.controller');
const authMiddleware = require('../middleware/auth.middleware');

router.post('/scan', authMiddleware, orphans.scan);
router.post('/delete', authMiddleware, orphans.deleteFiles);
router.get('/summary', authMiddleware, orphans.summary);
router.post('/scan-empty-dirs', authMiddleware, orphans.scanEmptyDirs);
router.post('/delete-empty-dirs', authMiddleware, orphans.deleteEmptyDirs);

module.exports = router;
