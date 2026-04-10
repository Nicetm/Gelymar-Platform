const router = require('express').Router();
const orders = require('../controllers/orders.controller');
const authMiddleware = require('../middleware/auth.middleware');

router.get('/search', authMiddleware, orders.search);
router.get('/:pc/files', authMiddleware, orders.getFiles);
router.put('/files/:id', authMiddleware, orders.updateFile);

module.exports = router;
