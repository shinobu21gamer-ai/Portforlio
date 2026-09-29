const router = require('express').Router();
const inventoryController = require('../controllers/inventory.controller');
const { protect, authorize, hasPermission } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const schemas = require('../validators');

router.get('/movements', protect, authorize('admin', 'manager', 'inventory_staff'), inventoryController.getMovements);
router.get('/logs', protect, authorize('admin', 'manager', 'inventory_staff'), inventoryController.getLogs);
router.get('/check-low-stock', protect, authorize('admin', 'manager', 'inventory_staff'), inventoryController.checkLowStock);
router.get('/check-expiring', protect, authorize('admin', 'manager', 'inventory_staff'), inventoryController.checkExpiring);
router.post('/stock-in', protect, hasPermission('inventory.manage'), validate(schemas.stockIn), inventoryController.stockIn);
router.post('/stock-out', protect, hasPermission('inventory.manage'), validate(schemas.stockOut), inventoryController.stockOut);
router.post('/adjust', protect, hasPermission('inventory.manage'), validate(schemas.adjustStock), inventoryController.adjustStock);

module.exports = router;
