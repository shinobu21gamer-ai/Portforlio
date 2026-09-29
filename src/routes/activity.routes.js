const router = require('express').Router();
const activityController = require('../controllers/activity.controller');
const { protect, authorize } = require('../middleware/auth');

router.get('/', protect, authorize('admin'), activityController.getAll);
router.get('/user/:userId', protect, authorize('admin'), activityController.getByUser);

module.exports = router;
