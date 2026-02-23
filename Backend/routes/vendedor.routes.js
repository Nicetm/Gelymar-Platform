const express = require('express');
const router = express.Router();
const vendedorController = require('../controllers/vendedor.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { authorizeRoles } = require('../middleware/role.middleware');

// Todos los endpoints de vendedor requieren autenticación y rol admin
router.get('/', authMiddleware, authorizeRoles(['admin']), vendedorController.getVendedores);
router.patch('/change-password/:rut', authMiddleware, authorizeRoles(['admin']), vendedorController.changeVendedorPassword);
router.patch('/:rut', authMiddleware, authorizeRoles(['admin']), vendedorController.updateVendedor);

module.exports = router;
