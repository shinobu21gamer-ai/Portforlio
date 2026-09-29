const router = require('express').Router();
const notificationController = require('../controllers/notification.controller');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const schemas = require('../validators');

router.get('/unread-count', protect, notificationController.getUnreadCount);
router.get('/', protect, notificationController.getAll);
router.put('/mark-all-read', protect, notificationController.markAllAsRead);
router.put('/mark-read', protect, validate(schemas.markRead), notificationController.markAsRead);
router.delete('/:id', protect, notificationController.delete);

module.exports = router;
