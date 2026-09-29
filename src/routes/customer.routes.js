const router = require('express').Router();
const customerController = require('../controllers/customer.controller');
const { protect, authorize, hasPermission } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const schemas = require('../validators');

router.get('/', protect, customerController.getAll);
router.get('/:id', protect, authorize('admin', 'manager'), customerController.getById);
router.post('/', protect, hasPermission('customers.manage'), validate(schemas.createCustomer), customerController.create);
router.put('/:id', protect, authorize('admin', 'manager'), validate(schemas.updateCustomer), customerController.update);
router.delete('/:id', protect, hasPermission('customers.delete'), customerController.delete);

module.exports = router;
