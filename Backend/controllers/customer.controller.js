const customers = require('../dummy/customers.json');
const Customer = require('../models/customer.model');

/**
 * @route GET /api/customers
 * @desc Retorna todos los clientes
 * @access Protegido (requiere JWT)
 */
exports.getAllCustomers = (req, res) => {
  res.json(customers);
};

/**
 * @route GET /api/customers/:id
 * @desc Retorna un cliente específico por CardCode
 * @access Protegido (requiere JWT)
 */
exports.getCustomerById = (req, res) => {
  const { id } = req.params;
  const customer = customers.find(c => c.CardCode === id);
  if (!customer) {
    return res.status(404).json({ message: 'Cliente no encontrado' });
  }
  res.json(customer);
};
