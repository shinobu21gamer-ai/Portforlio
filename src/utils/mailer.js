const nodemailer = require('nodemailer');
const config = require('../config');

let transporter = null;
let warnedNotConfigured = false;

// Callers await sendEmail() and ignore the returned result, so a misconfigured
// or rejecting mail server previously failed completely silently. Keep counters
// and log a periodic summary so failures are visible in deploy logs.
const failures = { notConfigured: 0, errored: 0, lastError: null };

function logFailureSummary(reason) {
  const total = failures.notConfigured + failures.errored;
  console.error(
    `[MAILER] ${total} email(s) not delivered — ${failures.notConfigured} unconfigured, ` +
    `${failures.errored} rejected by server.` +
    (failures.lastError ? ` Last error: ${failures.lastError}` : '') +
    ` Reason: ${reason}`
  );
}

function getTransporter() {
  if (transporter) return transporter;

  if (!config.smtp.host || !config.smtp.user) {
    if (!warnedNotConfigured) {
      warnedNotConfigured = true;
      console.error(
        '[MAILER] SMTP is NOT configured (SMTP_HOST/SMTP_USER unset). No email will be sent. ' +
        'Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and EMAIL_FROM to enable delivery.'
      );
    }
    return null;
  }

  transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465,
    auth: {
      user: config.smtp.user,
      pass: config.smtp.pass,
    },
  });

  return transporter;
}

async function sendEmail({ to, subject, html, text }) {
  const transport = getTransporter();
  const mailOptions = {
    from: config.smtp.from || config.smtp.user || 'noreply@minimartpos.com',
    to,
    subject,
    html,
    text: text || subject,
  };

  if (!transport) {
    failures.notConfigured++;
    console.warn(`[MAILER] Email not sent (SMTP unconfigured): "${subject}" -> ${to}`);
    return { sent: false, dev: true, to, subject };
  }

  try {
    const result = await transport.sendMail(mailOptions);
    console.log('[MAILER] Email sent:', { to, subject, messageId: result.messageId });
    return { sent: true, messageId: result.messageId };
  } catch (err) {
    failures.errored++;
    failures.lastError = err.message;
    console.error(`[MAILER] Failed to send "${subject}" -> ${to}: ${err.message}`);
    // Gmail rejects normal account passwords with 534-5.7.9; an App Password
    // is required. Surface that specifically, it is the most common cause.
    if (/534|Invalid login|authentication/i.test(err.message)) {
      console.error('[MAILER] This looks like an auth failure. For Gmail, use an App Password ' +
        '(Google Account -> Security -> 2-Step Verification -> App passwords), not your account password.');
    }
    return { sent: false, error: err.message, to, subject };
  }
}

/** True when SMTP is configured and a transporter can be created. */
function isConfigured() {
  return Boolean(config.smtp.host && config.smtp.user);
}

/** Snapshot of delivery failures; empty totals mean everything sent. */
function getFailureStats() {
  return { ...failures };
}

/** Log a summary if anything has failed. Called on an interval by the server. */
function reportFailuresIfAny() {
  const total = failures.notConfigured + failures.errored;
  if (total === 0) return false;
  logFailureSummary('periodic check');
  return true;
}

module.exports = { sendEmail, getTransporter, isConfigured, getFailureStats, reportFailuresIfAny };
