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
 * /api/customers/without-account:
 *   get:
 *     summary: Get customers without user account
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of customers without account
 *       500:
 *         description: Server error
 */
router.get('/without-account', authMiddleware, authorizeRoles(['admin']), customerController.getCustomersWithoutAccount);

router.get('/by-rut/:rut', authMiddleware, authorizeRoles(['admin']), customerController.getCustomerByRut);

router.post('/:customerId/create-account', authMiddleware, authorizeRoles(['admin']), customerController.createCustomerAccount);

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

/**
 * @swagger
 * /api/customers/contacts/{contactId}:
 *   delete:
 *     summary: Delete a customer contact
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: contactId
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Contact deleted successfully
 *       404:
 *         description: Contact not found
 *       500:
 *         description: Server error
 */
router.delete('/contacts/:customerUuid/:contactIdx', authMiddleware, authorizeRoles(['admin']), customerController.deleteCustomerContact);
router.patch('/contacts/:customerUuid/:contactIdx', authMiddleware, authorizeRoles(['admin']), customerController.updateCustomerContact);

/**
 * @swagger
 * /api/customers/{uuid}:
 *   patch:
 *     summary: Update a customer by UUID
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: uuid
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               name:
 *                 type: string
 *               phone:
 *                 type: string
 *               country:
 *                 type: string
 *               city:
 *                 type: string
 *     responses:
 *       200:
 *         description: Customer updated successfully
 *       404:
 *         description: Customer not found
 *       500:
 *         description: Server error
 */
router.patch('/:uuid', authMiddleware, authorizeRoles(['admin']), customerController.updateCustomer);

/**
 * @swagger
 * /api/customers/change-password/{uuid}:
 *   patch:
 *     summary: Change customer password
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: uuid
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               password:
 *                 type: string
 *                 minLength: 6
 *             required:
 *               - password
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       400:
 *         description: Invalid password
 *       404:
 *         description: Customer or user not found
 *       500:
 *         description: Server error
 */
router.patch('/change-password/:uuid', authMiddleware, authorizeRoles(['admin']), customerController.changeCustomerPassword);

module.exports = router;