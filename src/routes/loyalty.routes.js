const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const schemas = require('../validators');
const loyaltyController = require('../controllers/loyalty.controller');

router.use(protect);

router.get('/:customerId', authorize('admin', 'manager'), loyaltyController.getHistory);
router.post('/redeem', authorize('admin', 'manager'), validate(schemas.redeemLoyaltyPoints), loyaltyController.redeem);

module.exports = router;
