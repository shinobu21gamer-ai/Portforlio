const router = require('express').Router();
const expenseCategoryController = require('../controllers/expenseCategory.controller');
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const schemas = require('../validators');

router.get('/', protect, expenseCategoryController.getAll);
router.get('/:id', protect, expenseCategoryController.getById);
router.post('/', protect, authorize('admin', 'manager'), validate(schemas.createExpenseCategory), expenseCategoryController.create);
router.put('/:id', protect, authorize('admin', 'manager'), expenseCategoryController.update);
router.delete('/:id', protect, authorize('admin'), expenseCategoryController.delete);

module.exports = router;
