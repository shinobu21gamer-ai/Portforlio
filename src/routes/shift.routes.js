const router = require('express').Router();
const shiftController = require('../controllers/shift.controller');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const schemas = require('../validators');

// Register shift lifecycle. Open/close act on the caller's own shift;
// list/summary are scope-aware in the service (staff → own only).
router.post('/', protect, validate(schemas.openShift), shiftController.open);
router.post('/close', protect, validate(schemas.closeShift), shiftController.close);
router.get('/mine/open', protect, shiftController.myOpen);
router.get('/summary', protect, shiftController.summary);
router.get('/', protect, shiftController.list);
router.get('/:id', protect, shiftController.getById);

module.exports = router;
