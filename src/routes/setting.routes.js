const router = require('express').Router();
const settingController = require('../controllers/setting.controller');
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const schemas = require('../validators');

router.get('/', protect, settingController.get);
router.put('/', protect, authorize('admin'), validate(schemas.updateSettings), settingController.update);

module.exports = router;
