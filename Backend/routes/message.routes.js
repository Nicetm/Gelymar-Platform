const express = require('express');
const router = express.Router();
const messageController = require('../controllers/message.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { authorizeRoles } = require('../middleware/role.middleware');

router.use(authMiddleware, authorizeRoles(['admin']));

router.get('/summary', messageController.getSummary);
router.get('/', messageController.getMessages);
router.get('/:type/:id', messageController.getMessageDetail);

module.exports = router;
