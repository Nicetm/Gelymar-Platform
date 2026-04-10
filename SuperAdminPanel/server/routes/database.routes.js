const router = require('express').Router();
const db = require('../controllers/database.controller');
const authMiddleware = require('../middleware/auth.middleware');

router.get('/:table', authMiddleware, db.list);
router.put('/:table/:id', authMiddleware, db.update);

module.exports = router;
