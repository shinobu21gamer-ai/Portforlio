const router = require('express').Router();
const roleController = require('../controllers/role.controller');
const { protect, authorize } = require('../middleware/auth');

router.get('/', protect, authorize('admin'), roleController.getAll);

module.exports = router;
