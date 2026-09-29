const router = require('express').Router();
const pettyCashController = require('../controllers/pettyCash.controller');
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const schemas = require('../validators');

router.get('/summary', protect, authorize('admin', 'manager'), pettyCashController.getSummary);
router.get('/', protect, authorize('admin', 'manager'), pettyCashController.getAllFunds);
router.get('/:id', protect, authorize('admin', 'manager'), pettyCashController.getFundById);
router.post('/', protect, authorize('admin'), validate(schemas.createPettyCashFund), pettyCashController.createFund);
router.put('/:id', protect, authorize('admin'), validate(schemas.updatePettyCashFund), pettyCashController.updateFund);
router.patch('/:id/close', protect, authorize('admin'), pettyCashController.closeFund);
router.post('/:id/deposit', protect, authorize('admin', 'manager'), validate(schemas.pettyCashDeposit), pettyCashController.deposit);
router.post('/:id/withdraw', protect, authorize('admin', 'manager'), validate(schemas.pettyCashWithdraw), pettyCashController.withdraw);
router.get('/:id/transactions', protect, authorize('admin', 'manager'), pettyCashController.getTransactions);

module.exports = router;
