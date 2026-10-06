const mailer = require('../utils/mailer');
const config = require('../config');
const ApiError = require('../utils/ApiError');
const { logActivity } = require('../utils/audit');
const { testEmail, testEmailText } = require('../utils/emailTemplates');

// Admin-facing email diagnostics: "is SMTP configured, does it work, and has
// anything been dropped?". Reads mailer state; the only writes are the audit
// rows for a test send.
const DEFAULT_SUBJECT = `Test email — ${config.app.name || 'MiniMart POS'}`;

/**
 * @param {object}  opts
 * @param {boolean} opts.verify  also run a live connection/auth check first
 */
async function getStatus({ verify = false } = {}) {
  if (verify) await mailer.verifyConnection();
  return mailer.getStatus();
}

/**
 * Send a diagnostic email to an address an admin controls.
 *
 * A failed send is reported as an HTTP error (503 unconfigured / 502 rejected)
 * rather than a 200 — the button exists precisely to make delivery problems
 * visible, and a silent success would repeat the bug it was written to fix.
 */
async function sendTestEmail({ to, subject, message, requestedBy = null, recipientName = null } = {}) {
  const recipient = String(to || '').trim();
  const mailSubject = String(subject || '').trim() || DEFAULT_SUBJECT;
  const sentAt = new Date().toISOString();
  const status = mailer.getStatus();

  const details = {
    recipientName,
    host: status.host,
    port: status.port,
    user: status.user,
    from: status.from,
    frontendUrl: status.frontendUrl,
    requestedBy: requestedBy ? `user #${requestedBy}` : 'an administrator',
    sentAt,
    message,
  };

  const result = await mailer.sendEmail({
    to: recipient,
    subject: mailSubject,
    html: testEmail(details),
    text: testEmailText(details),
  });

  if (result.sent) {
    await logActivity(requestedBy, 'email-test-sent', 'Settings', {
      description: `Test email sent to ${recipient}`,
      newData: { to: recipient, subject: mailSubject, messageId: result.messageId },
    });
    return { sent: true, to: recipient, subject: mailSubject, messageId: result.messageId };
  }

  const reason = result.reason || 'unknown';
  const hint = result.hint || null;

  await logActivity(requestedBy, 'email-test-failed', 'Settings', {
    description: `Test email to ${recipient} failed (${reason})${result.error ? `: ${result.error}` : ''}`,
    newData: { to: recipient, subject: mailSubject, reason, error: result.error || null },
  });

  if (reason === 'not-configured') {
    throw new ApiError(503, 'SMTP is not configured, so no email could be sent.', { reason, hint });
  }
  throw new ApiError(
    502,
    `The SMTP server rejected the test email${result.error ? `: ${result.error}` : '.'}`,
    { reason, hint }
  );
}

module.exports = { getStatus, sendTestEmail, DEFAULT_SUBJECT };
