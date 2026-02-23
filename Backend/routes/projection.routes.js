const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const { authorizeRoles } = require('../middleware/role.middleware');
const projectionController = require('../controllers/projection.controller');

router.get('/options', authMiddleware, authorizeRoles(['seller', 'admin']), projectionController.getOptions);
router.get('/', authMiddleware, authorizeRoles(['seller', 'admin']), projectionController.getProjectionData);

module.exports = router;
