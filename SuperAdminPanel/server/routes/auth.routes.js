const router = require('express').Router();
const auth = require('../controllers/auth.controller');
const authMiddleware = require('../middleware/auth.middleware');

router.post('/login', auth.login);
router.get('/me', authMiddleware, auth.me);

module.exports = router;
