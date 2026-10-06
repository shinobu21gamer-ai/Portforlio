// Admin-only email diagnostics.
//
// Email is the one subsystem whose failures are invisible from the UI: every
// caller awaits sendEmail() and ignores the result, so a missing SMTP_PASS or a
// Gmail account password (instead of an App Password) silently drops password
// resets, payslips, contract notices and receipts. These endpoints expose the
// mailer's configuration, its last verify() result and its delivery counters,
// and send a real test message on demand.
const router = require('express').Router();
const emailController = require('../controllers/email.controller');
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const schemas = require('../validators');

router.get('/email', protect, authorize('admin'), emailController.status);
router.post('/email/test', protect, authorize('admin'), validate(schemas.sendTestEmail), emailController.sendTest);

module.exports = router;
