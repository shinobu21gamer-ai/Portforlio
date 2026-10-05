const router = require('express').Router();
const saleController = require('../controllers/sale.controller');
const { protect, authorize, hasPermission } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const schemas = require('../validators');

router.get('/report', protect, authorize('admin', 'manager'), saleController.getSalesReport);
router.get('/invoice/:invoiceNo', protect, saleController.getByInvoice);
router.get('/', protect, saleController.getAll);
router.get('/pending', protect, saleController.getPending);
router.get('/:id', protect, saleController.getById);
router.post('/', protect, hasPermission('sales.create'), validate(schemas.createSale), saleController.create);
router.post('/pending', protect, hasPermission('sales.create'), validate(schemas.createSale), saleController.createPending);
router.post('/pending/:id/cancel', protect, saleController.cancelPending);
router.post('/pending/:id/cash-complete', protect, authorize('admin', 'manager'), saleController.completePendingAsCash);
router.post('/:id/cancel', protect, hasPermission('sales.cancel'), saleController.cancel);

module.exports = router;
