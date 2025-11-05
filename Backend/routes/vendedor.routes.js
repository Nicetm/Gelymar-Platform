const express = require('express');
const router = express.Router();
const vendedorController = require('../controllers/vendedor.controller');

router.get('/', vendedorController.getVendedores);

module.exports = router;

