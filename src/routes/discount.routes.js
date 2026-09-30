const router = require('express').Router();
const discountController = require('../controllers/discount.controller');
const { protect, authorize, hasPermission } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const schemas = require('../validators');

router.get('/', protect, discountController.getAll);
router.get('/validate', protect, discountController.validateGet);
router.get('/:id', protect, discountController.getById);
router.post('/validate', protect, discountController.validate);
router.post('/', protect, hasPermission('discounts.manage'), validate(schemas.createDiscount), discountController.create);
router.put('/:id', protect, hasPermission('discounts.manage'), validate(schemas.updateDiscount), discountController.update);
router.delete('/:id', protect, hasPermission('discounts.delete'), discountController.delete);

module.exports = router;
