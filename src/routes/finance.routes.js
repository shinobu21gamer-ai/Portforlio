const express = require('express');
const router = express.Router();
const financeController = require('../controllers/finance.controller');
const { protect, authorize } = require('../middleware/auth');

router.get('/report', protect, authorize('admin', 'manager'), financeController.getFinanceReport);
router.get('/cashflow', protect, authorize('admin', 'manager'), financeController.getCashflow);

module.exports = router;
