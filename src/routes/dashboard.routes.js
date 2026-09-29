const router = require('express').Router();
const dashboardController = require('../controllers/dashboard.controller');
const { protect, authorize } = require('../middleware/auth');

router.get('/', protect, authorize('admin', 'manager'), dashboardController.getDashboard);

module.exports = router;
