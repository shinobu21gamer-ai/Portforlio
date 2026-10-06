const emailService = require('../services/email.service');
const { sendSuccess } = require('../utils/response');

class EmailController {
  /**
   * GET /health/email[?verify=1]
   * Always 200: a deployment with no mail server is a valid state to report,
   * and the UI renders the reason instead of an error page. `verify=1` runs a
   * live connection check (a few seconds) before answering.
   */
  async status(req, res, next) {
    try {
      const raw = String(req.query.verify || '').toLowerCase();
      const verify = raw === '1' || raw === 'true' || raw === 'yes';
      const data = await emailService.getStatus({ verify });
      sendSuccess(res, data, data.configured ? 'SMTP is configured' : 'SMTP is not configured');
    } catch (err) { next(err); }
  }

  /**
   * POST /health/email/test — send a diagnostic email. Defaults to the calling
   * admin's own address so a mis-click can't mail a customer.
   */
  async sendTest(req, res, next) {
    try {
      const { to, subject, message } = req.body || {};
      const data = await emailService.sendTestEmail({
        to: to || req.user.email,
        subject,
        message,
        requestedBy: req.user.id,
        recipientName: req.user.firstName || req.user.email,
      });
      sendSuccess(res, data, `Test email sent to ${data.to}`);
    } catch (err) { next(err); }
  }
}

module.exports = new EmailController();
