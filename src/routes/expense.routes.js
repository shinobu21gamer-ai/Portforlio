const router = require('express').Router();
const expenseController = require('../controllers/expense.controller');
const { protect, authorize, hasPermission } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const schemas = require('../validators');

router.get('/report', protect, authorize('admin', 'manager'), expenseController.getReport);
router.get('/', protect, authorize('admin', 'manager'), expenseController.getAll);
router.get('/:id', protect, authorize('admin', 'manager'), expenseController.getById);
router.post('/', protect, hasPermission('expenses.manage'), validate(schemas.createExpense), expenseController.create);
router.put('/:id', protect, hasPermission('expenses.manage'), validate(schemas.updateExpense), expenseController.update);
router.delete('/:id', protect, hasPermission('expenses.delete'), expenseController.delete);

module.exports = router;
