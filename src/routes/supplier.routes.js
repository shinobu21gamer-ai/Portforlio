const router = require('express').Router();
const supplierController = require('../controllers/supplier.controller');
const { protect, authorize, hasPermission } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const schemas = require('../validators');

router.get('/outstanding-balances', protect, authorize('admin', 'manager'), supplierController.getOutstandingBalances);
router.get('/export', protect, authorize('admin', 'manager'), supplierController.exportAll);
router.post('/import', protect, authorize('admin', 'manager'), supplierController.importCsv);
router.get('/analytics', protect, authorize('admin', 'manager'), supplierController.getAnalytics);

router.get('/:id/summary', protect, authorize('admin', 'manager', 'inventory_staff'), supplierController.getSupplierSummary);
router.get('/:id/purchases', protect, authorize('admin', 'manager', 'inventory_staff'), supplierController.getSupplierPurchases);

router.get('/', protect, hasPermission('suppliers.view'), supplierController.getAll);
router.get('/:id', protect, hasPermission('suppliers.view'), supplierController.getById);
router.post('/', protect, hasPermission('suppliers.manage'), validate(schemas.createSupplier), supplierController.create);
router.put('/:id', protect, hasPermission('suppliers.manage'), validate(schemas.updateSupplier), supplierController.update);
router.delete('/:id', protect, hasPermission('suppliers.delete'), supplierController.delete);

module.exports = router;
