const nodemailer = require('nodemailer');
const config = require('../config');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  if (!config.smtp.host || !config.smtp.user) {
    console.warn('[MAILER] SMTP not configured — emails will be logged to console');
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
    console.log('[MAILER] Email (dev mode):', { to, subject });
    return { sent: false, dev: true, to, subject };
  }

  try {
    const result = await transport.sendMail(mailOptions);
    console.log('[MAILER] Email sent:', { to, subject, messageId: result.messageId });
    return { sent: true, messageId: result.messageId };
  } catch (err) {
    console.error('[MAILER] Failed to send email:', err.message);
    return { sent: false, error: err.message, to, subject };
  }
}

module.exports = { sendEmail, getTransporter };
