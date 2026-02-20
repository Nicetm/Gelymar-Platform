const express = require('express');
const router = express.Router();
const vendedorController = require('../controllers/vendedor.controller');

router.get('/', vendedorController.getVendedores);
router.patch('/change-password/:rut', vendedorController.changeVendedorPassword);
router.patch('/:rut', vendedorController.updateVendedor);

module.exports = router;
