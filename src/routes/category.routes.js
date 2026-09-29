const router = require('express').Router();
const categoryController = require('../controllers/category.controller');
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const schemas = require('../validators');

router.get('/tree', protect, categoryController.getTree);
router.get('/', protect, categoryController.getAll);
router.get('/:id', protect, categoryController.getById);
router.post('/', protect, authorize('admin', 'manager', 'inventory_staff'), validate(schemas.createCategory), categoryController.create);
router.put('/:id', protect, authorize('admin', 'manager', 'inventory_staff'), validate(schemas.updateCategory), categoryController.update);
router.delete('/:id', protect, authorize('admin'), categoryController.delete);

module.exports = router;
