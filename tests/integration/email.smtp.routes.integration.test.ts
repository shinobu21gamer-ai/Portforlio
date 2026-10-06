/**
 * Email diagnostics against a *working* mail server.
 *
 * The unit suites cover the mailer's failure classification with a stubbed
 * transport; this file proves the whole path really works end to end over the
 * wire: a minimal SMTP server (net.createServer, ~60 lines) accepts the
 * connection and the AUTH, and the test asserts on the message actually
 * received — recipient, sender, subject and both body parts.
 *
 * SMTP_HOST is pointed at 127.0.0.1; the port is an ephemeral one assigned in
 * beforeAll and copied into config (the fake server must be bound before the
 * mailer builds its transport, which is lazy).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import net from 'node:net';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-ci-only-32chars!!';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-for-ci-only-32chars';
process.env.JWT_EXPIRES_IN = '1h';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.DB_DIALECT = 'sqlite';
process.env.DB_STORAGE = ':memory:';
process.env.SMTP_HOST = '127.0.0.1';
process.env.SMTP_PORT = '587'; // replaced with the fake server's port in beforeAll
process.env.SMTP_USER = 'smtp-user@example.test';
process.env.SMTP_PASS = 'smtp-app-password-value';
process.env.EMAIL_FROM = 'noreply@example.test';
process.env.EMAIL_DISABLED = '';
process.env.FRONTEND_URL = 'https://shop.example.test';

import axios from 'axios';

interface ReceivedMail { from: string; to: string[]; raw: string }

/**
 * Minimal SMTP server: greeting, EHLO with AUTH advertising, 235 on any AUTH,
 * 250 on MAIL/RCPT, 354/250 around DATA, 221 on QUIT. Enough for nodemailer.
 */
function createFakeSmtp() {
  const received: ReceivedMail[] = [];
  const server = net.createServer((socket) => {
    let buffer = '';
    let inData = false;
    let raw = '';
    let current: ReceivedMail = { from: '', to: [], raw: '' };

    socket.write('220 fake-smtp.test ESMTP ready\r\n');
    socket.on('error', () => { /* client hangs up mid-dialogue */ });
    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      let idx: number;
      while ((idx = buffer.indexOf('\r\n')) !== -1) {
        const line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);

        if (inData) {
          if (line === '.') {
            inData = false;
            current.raw = raw;
            received.push(current);
            raw = '';
            current = { from: '', to: [], raw: '' };
            socket.write('250 2.0.0 Ok: queued\r\n');
          } else {
            raw += `${line}\r\n`;
          }
          continue;
        }

        const upper = line.toUpperCase();
        if (upper.startsWith('EHLO') || upper.startsWith('HELO')) {
          socket.write('250-fake-smtp.test\r\n250-AUTH PLAIN LOGIN\r\n250-8BITMIME\r\n250 SMTPUTF8\r\n');
        } else if (upper.startsWith('AUTH')) {
          socket.write('235 2.7.0 Authentication successful\r\n');
        } else if (upper.startsWith('MAIL FROM')) {
          current.from = line;
          socket.write('250 2.1.0 Ok\r\n');
        } else if (upper.startsWith('RCPT TO')) {
          current.to.push(line);
          socket.write('250 2.1.5 Ok\r\n');
        } else if (upper.startsWith('DATA')) {
          inData = true;
          socket.write('354 End data with <CR><LF>.<CR><LF>\r\n');
        } else if (upper.startsWith('QUIT')) {
          socket.write('221 2.0.0 Bye\r\n');
          socket.end();
        } else {
          socket.write('250 2.0.0 Ok\r\n');
        }
      }
    });
  });
  return { server, received };
}

// Bodies are quoted-printable encoded by nodemailer, which inserts soft line
// breaks that would split an assertion string, so decode before matching.
function decodeQuotedPrintable(raw: string) {
  return raw
    .replace(/=\r\n/g, '')
    .replace(/=([0-9A-Fa-f]{2})/g, (_m, hex) => String.fromCharCode(parseInt(hex, 16)));
}

const smtp = createFakeSmtp();
let smtpPort = 0;

let server: any;
let baseUrl = '';
let adminToken = '';
let adminId = 0;

const api = axios.create({ timeout: 15000, validateStatus: () => true });

const login = async (email: string, password: string) => {
  const res = await api.post(`${baseUrl}/auth/login`, { email, password });
  if (res.status !== 200) {
    throw new Error(`login failed for ${email}: ${res.status} ${JSON.stringify(res.data)}`);
  }
  return res.data.data as { token: string; user: any };
};

beforeAll(async () => {
  // Bind the fake SMTP server first: the mailer reads config.smtp.port when it
  // lazily creates its transport, so the ephemeral port must be known (and
  // copied into config) before the first send.
  await new Promise<void>((resolve) => smtp.server.listen(0, '127.0.0.1', resolve));
  smtpPort = (smtp.server.address() as net.AddressInfo).port;

  const config = require('../../src/config');
  config.smtp.port = smtpPort;

  const models = require('../../src/models');
  const { sequelize, User, Role } = models;
  await sequelize.authenticate();
  await sequelize.sync({ force: true });

  const adminRole = await Role.create({ name: 'Admin', slug: 'admin', isActive: true });
  const admin = await User.create({
    firstName: 'Postmaster',
    lastName: 'Admin',
    email: 'smtp-admin@example.com',
    password: 'Passw0rd!123',
    roleId: adminRole.id,
    isActive: true,
  });
  adminId = admin.id;

  const { server: appServer } = require('../../src/app');
  server = appServer;
  await new Promise<void>((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`;

  adminToken = (await login('smtp-admin@example.com', 'Passw0rd!123')).token;
}, 60000);

afterAll(async () => {
  try {
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  } catch { /* already closed */ }
  try {
    await new Promise<void>((resolve) => smtp.server.close(() => resolve()));
  } catch { /* already closed by the outage test */ }
  const { sequelize } = require('../../src/models');
  await sequelize.close();
}, 30000);

const asAdmin = () => ({ headers: { Authorization: `Bearer ${adminToken}` } });

describe('email diagnostics with a reachable SMTP server', () => {
  it('reports the configuration, including the sender address', async () => {
    const res = await api.get(`${baseUrl}/health/email`, asAdmin());

    expect(res.status).toBe(200);
    const data = res.data.data;
    expect(data.configured).toBe(true);
    expect(data.ready).toBe(true);
    expect(data.passwordSet).toBe(true);
    expect(data.disabledByFlag).toBe(false);
    expect(data.host).toBe('127.0.0.1');
    expect(data.port).toBe(smtpPort);
    expect(data.secure).toBe(false);
    expect(data.user).toBe('smtp-user@example.test');
    expect(data.from).toBe('noreply@example.test');
    expect(data.frontendUrl).toBe('https://shop.example.test');
    // The credential itself must never appear in a status response.
    expect(JSON.stringify(data)).not.toContain(process.env.SMTP_PASS);
  });

  it('verifies the live connection and authentication', async () => {
    const res = await api.get(`${baseUrl}/health/email?verify=1`, asAdmin());

    expect(res.status).toBe(200);
    const { lastVerify } = res.data.data;
    expect(lastVerify.ok).toBe(true);
    expect(lastVerify.reason).toBeNull();
    expect(lastVerify.error).toBeNull();
    expect(lastVerify.hint).toBeNull();
    expect(Number.isNaN(Date.parse(lastVerify.checkedAt))).toBe(false);
  });

  it('sends a real message to the requested address', async () => {
    const res = await api.post(
      `${baseUrl}/health/email/test`,
      { to: 'qa@example.com', subject: 'Ping from CI', message: 'Delivery check' },
      asAdmin(),
    );

    expect(res.status).toBe(200);
    expect(res.data.data).toMatchObject({
      sent: true,
      to: 'qa@example.com',
      subject: 'Ping from CI',
    });
    expect(typeof res.data.data.messageId).toBe('string');

    expect(smtp.received).toHaveLength(1);
    const mail = smtp.received[0];
    expect(mail.from).toContain('noreply@example.test');
    expect(mail.to.join('\n')).toContain('qa@example.com');

    const decoded = decodeQuotedPrintable(mail.raw);
    expect(decoded).toContain('Subject: Ping from CI');
    expect(decoded).toContain('Delivery check');
    // The message body names the server it was sent through, so the recipient
    // can tell which deployment this came from.
    expect(decoded).toContain(`${process.env.SMTP_HOST}:${smtpPort}`);
    // Both parts must be present: a text/plain alternative that is just the
    // subject line is a bug this repo has hit before with receipts.
    expect(decoded).toContain('This is a test message. If you are reading it, SMTP delivery works');
  });

  it('defaults the recipient to the calling admin when none is given', async () => {
    const res = await api.post(`${baseUrl}/health/email/test`, {}, asAdmin());

    expect(res.status).toBe(200);
    expect(res.data.data.to).toBe('smtp-admin@example.com');
    expect(smtp.received).toHaveLength(2);
    expect(smtp.received[1].to.join('\n')).toContain('smtp-admin@example.com');
  });

  it('records the successful test in the activity log', async () => {
    const { ActivityLog } = require('../../src/models');
    const rows = await ActivityLog.findAll({ where: { action: 'email-test-sent' }, order: [['id', 'ASC']] });

    expect(rows).toHaveLength(2);
    expect(rows[0].userId).toBe(adminId);
    expect(rows[0].description).toMatch(/Test email sent to qa@example\.com/);
    // The audit row must not carry a credential either.
    expect(JSON.stringify(rows.map((r: any) => r.newData))).not.toContain(process.env.SMTP_PASS);
  });

  it('reports 502 with the connection hint when the mail server is down', async () => {
    await new Promise<void>((resolve) => smtp.server.close(() => resolve()));

    const res = await api.post(`${baseUrl}/health/email/test`, {}, asAdmin());

    expect(res.status).toBe(502);
    expect(res.data.success).toBe(false);
    expect(res.data.errors.reason).toBe('connection');
    expect(res.data.errors.hint).toMatch(/could not be reached/);
    expect(res.data.message).toMatch(/SMTP server rejected/i);
  });

  it('re-verifies a mail server that has gone away', async () => {
    const res = await api.get(`${baseUrl}/health/email?verify=1`, asAdmin());

    expect(res.status).toBe(200);
    expect(res.data.data.lastVerify).toMatchObject({ ok: false, reason: 'connection' });
    expect(res.data.data.lastVerify.hint).toMatch(/SMTP_HOST\/SMTP_PORT/);
  });
});
