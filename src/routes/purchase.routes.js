const router = require('express').Router();
const purchaseController = require('../controllers/purchase.controller');
const { protect, authorize, hasPermission } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const schemas = require('../validators');

router.get('/', protect, authorize('admin', 'manager', 'inventory_staff'), purchaseController.getAll);
router.get('/:id', protect, authorize('admin', 'manager', 'inventory_staff'), purchaseController.getById);
router.post('/', protect, hasPermission('purchases.create'), validate(schemas.createPurchase), purchaseController.create);
router.put('/:id/receive', protect, authorize('admin', 'manager', 'inventory_staff'), purchaseController.receive);
router.post('/:id/pay', protect, hasPermission('purchases.pay'), purchaseController.pay);
router.post('/:id/cancel', protect, hasPermission('purchases.cancel'), purchaseController.cancel);

module.exports = router;
