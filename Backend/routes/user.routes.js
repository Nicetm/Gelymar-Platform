// routes/user.routes.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller.js');
const authMiddleware = require('../middleware/auth.middleware.js');
const { authorizeRoles } = require('../middleware/role.middleware.js');

router.get('/', authMiddleware, authorizeRoles(['admin']), userController.getAllUsers);


module.exports = router;