const router = require('express').Router();
const authController = require('../controllers/auth.controller');
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const schemas = require('../validators');

router.post('/register', protect, authorize('admin'), validate(schemas.register), authController.register);
router.post('/login', validate(schemas.login), authController.login);
router.post('/change-password', protect, validate(schemas.changePassword), authController.changePassword);
router.post('/forgot-password', validate(schemas.forgotPassword), authController.forgotPassword);
router.post('/reset-password', validate(schemas.resetPassword), authController.resetPassword);
router.get('/profile', protect, authController.getProfile);
router.put('/profile', protect, validate(schemas.updateProfile), authController.updateProfile);
router.post('/refresh-token', authController.refreshToken);
router.post('/logout', protect, authController.logout);

module.exports = router;
