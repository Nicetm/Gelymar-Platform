// routes/customer.routes.js
const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customer.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { authorizeRoles } = require('../middleware/role.middleware');

/**
 * @swagger
 * /api/customers:
 *   get:
 *     summary: Get all customers
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of customers
 */
router.get('/', authMiddleware, authorizeRoles(['admin']), customerController.getAllCustomers);

/**
 * @swagger
 * /api/customers/{id}:
 *   get:
 *     summary: Get a customer by ID
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Customer found
 *       404:
 *         description: Customer not found
 */
router.get('/:id', authMiddleware, authorizeRoles(['admin']), customerController.getCustomerById);

router.get('/uuid/:uuid', authMiddleware, authorizeRoles(['admin']), customerController.getCustomerByUUID);

router.post('/contacts', authMiddleware, authorizeRoles(['admin']), customerController.createCustomerContact);

router.get('/:uuid/contacts', authMiddleware, authorizeRoles(['admin']), customerController.getCustomerContacts);

module.exports = router;