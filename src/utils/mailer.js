const nodemailer = require('nodemailer');
const config = require('../config');

let transporter = null;
let warnedNotConfigured = false;

// Callers await sendEmail() and ignore the returned result, so a misconfigured
// or rejecting mail server previously failed completely silently. Keep counters
// and log a periodic summary so failures are visible in deploy logs.
const counters = { sent: 0, notConfigured: 0, errored: 0, lastError: null };

// Result of the last verify(): "can we actually reach and authenticate against
// the SMTP server?", not merely "are the env vars set?". Recorded at boot and
// on demand (GET /health/email?verify=1) so a bad password surfaces at deploy
// time instead of on the first password reset.
const NO_VERIFY_YET = { checkedAt: null, ok: null, reason: null, error: null, hint: null };
let lastVerify = { ...NO_VERIFY_YET };

// Transport-level failures are classified so the log line, the API response
// and the admin UI can all say *what* to fix rather than echoing a socket
// error. `auth` is the common one: Gmail rejects account passwords.
function classifyFailure(message = '') {
  const text = String(message);
  if (/534|535|Invalid login|Username and Password not accepted|BadCredentials|EAUTH|authentication/i.test(text)) {
    return 'auth';
  }
  if (/ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|ESOCKET|EHOSTUNREACH|greeting|timeout|certificate|self[- ]signed|wrong version number/i.test(text)) {
    return 'connection';
  }
  return 'unknown';
}

const HINTS = {
  'not-configured':
    'Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and EMAIL_FROM, then redeploy. ' +
    'The variable is EMAIL_FROM (not MAIL_FROM); EMAIL_DISABLED does not enable sending.',
  auth:
    'The SMTP server rejected the credentials. For Gmail, SMTP_PASS must be an App Password ' +
    '(Google Account -> Security -> 2-Step Verification -> App passwords), not the account password.',
  connection:
    'The SMTP server could not be reached. Check SMTP_HOST/SMTP_PORT and that this host may open ' +
    'outbound connections on port 587 (or 465 for implicit TLS).',
  unknown: 'Check the SMTP settings and the server logs for the full error.',
};

function failureHint(reason) {
  return HINTS[reason] || HINTS.unknown;
}

// Bound the connection handshake: nodemailer defaults to a 2 minute connection
// timeout, which would otherwise stall whichever request is sending mail (a
// receipt email, a password reset) for that long when the mail server is down.
const CONNECTION_TIMEOUT_MS = 10000;
const GREETING_TIMEOUT_MS = 10000;
const SOCKET_TIMEOUT_MS = 30000;

// verify() has no timeout option of its own, so bound it here. It runs during
// boot and from an admin request; neither may hang on an unresponsive server.
const VERIFY_TIMEOUT_MS = 15000;

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    if (typeof timer.unref === 'function') timer.unref();
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function logFailureSummary(reason) {
  const total = counters.notConfigured + counters.errored;
  console.error(
    `[MAILER] ${total} email(s) not delivered — ${counters.notConfigured} unconfigured, ` +
    `${counters.errored} rejected by server.` +
    (counters.lastError ? ` Last error: ${counters.lastError}` : '') +
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
    connectionTimeout: CONNECTION_TIMEOUT_MS,
    greetingTimeout: GREETING_TIMEOUT_MS,
    socketTimeout: SOCKET_TIMEOUT_MS,
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
    counters.notConfigured++;
    console.warn(`[MAILER] Email not sent (SMTP unconfigured): "${subject}" -> ${to}`);
    return { sent: false, dev: true, reason: 'not-configured', hint: failureHint('not-configured'), to, subject };
  }

  try {
    const result = await transport.sendMail(mailOptions);
    counters.sent++;
    console.log('[MAILER] Email sent:', { to, subject, messageId: result.messageId });
    return { sent: true, messageId: result.messageId };
  } catch (err) {
    const reason = classifyFailure(err.message);
    counters.errored++;
    counters.lastError = err.message;
    console.error(`[MAILER] Failed to send "${subject}" -> ${to} (${reason}): ${err.message}`);
    console.error(`[MAILER] ${failureHint(reason)}`);
    return { sent: false, reason, error: err.message, hint: failureHint(reason), to, subject };
  }
}

/**
 * Check that the configured mail server is reachable and the credentials work.
 * Never throws: a mail outage must not break boot or an admin's request. The
 * outcome is cached in lastVerify and surfaced by getStatus().
 */
async function verifyConnection() {
  const transport = getTransporter();
  const checkedAt = new Date().toISOString();

  // The hint is stored alongside the result so GET /health/email (which only
  // reads the cache) can explain how to fix the problem, not just that it is one.
  const record = (ok, reason, error) => {
    lastVerify = { checkedAt, ok, reason, error, hint: reason ? failureHint(reason) : null };
    return { ...lastVerify };
  };

  if (!transport) {
    const result = record(false, 'not-configured', 'SMTP_HOST/SMTP_USER are not set');
    console.error(`[MAILER] SMTP verify skipped — ${result.error}.`);
    console.error(`[MAILER] ${result.hint}`);
    return result;
  }

  try {
    await withTimeout(transport.verify(), VERIFY_TIMEOUT_MS, 'SMTP verify');
    const result = record(true, null, null);
    console.log(`[MAILER] SMTP connection verified: ${config.smtp.host}:${config.smtp.port}`);
    return result;
  } catch (err) {
    const result = record(false, classifyFailure(err.message), err.message);
    console.error(`[MAILER] SMTP verify FAILED (${result.reason}): ${err.message}`);
    console.error(`[MAILER] ${result.hint}`);
    return result;
  }
}

/** True when SMTP is configured and a transporter can be created. */
function isConfigured() {
  return Boolean(config.smtp.host && config.smtp.user);
}

/**
 * Delivery counters and the cached verify() result, for logs and the admin
 * email-status endpoint. Never contains SMTP_PASS.
 */
function getStatus() {
  const configured = isConfigured();
  const passwordSet = Boolean(config.smtp.pass);
  return {
    configured,
    // Enough to attempt an authenticated send. configured=true with
    // passwordSet=false is the "SMTP_USER without SMTP_PASS" misconfiguration,
    // which only shows up when the server rejects the login.
    ready: configured && passwordSet,
    passwordSet,
    // EMAIL_DISABLED only relaxes the production boot guard in src/config — it
    // does not stop sends. Reported so that flag can't be mistaken for a fix.
    disabledByFlag: Boolean(config.smtp.disabled),
    host: configured ? config.smtp.host : null,
    port: configured ? config.smtp.port : null,
    secure: configured ? config.smtp.port === 465 : false,
    user: configured ? config.smtp.user : null,
    from: configured ? config.smtp.from || config.smtp.user : null,
    // Links inside outbound email need a public origin; without it the
    // URL-bearing templates refuse to build (see src/utils/emailTemplates.js).
    frontendUrl: config.app.frontendUrl || null,
    lastVerify: { ...lastVerify },
    counters: { ...counters },
  };
}

/** Snapshot of delivery counters; sent=0 with failures=0 means nothing tried. */
function getFailureStats() {
  return { ...counters };
}

/** Log a summary if anything has failed. Called on an interval by the server. */
function reportFailuresIfAny() {
  const total = counters.notConfigured + counters.errored;
  if (total === 0) return false;
  logFailureSummary('periodic check');
  return true;
}

module.exports = {
  sendEmail,
  getTransporter,
  isConfigured,
  getStatus,
  getFailureStats,
  reportFailuresIfAny,
  verifyConnection,
  failureHint,
};
