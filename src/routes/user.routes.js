const router = require('express').Router();
const userController = require('../controllers/user.controller');
const { protect, authorize, hasPermission } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const schemas = require('../validators');

router.get('/', protect, hasPermission('users.view'), userController.getAll);
router.get('/:id', protect, hasPermission('users.view'), userController.getById);
router.post('/', protect, hasPermission('users.manage'), validate(schemas.register), userController.create);
router.put('/:id', protect, hasPermission('users.manage'), validate(schemas.updateUser), userController.update);
router.delete('/:id', protect, hasPermission('users.delete'), userController.delete);

module.exports = router;
