/**
 * Mailer behaviour when SMTP *is* configured: successful sends, and the
 * auth/connection failures that used to be invisible because every caller
 * ignores sendEmail()'s result.
 *
 * nodemailer is replaced at the transport boundary — no network, no SMTP server
 * — so each failure mode is reproducible. The seam is a Module._load patch
 * rather than vi.mock(): nodemailer is an externalized CommonJS dependency that
 * src/utils/mailer.js picks up through Node's own require, which vi.mock() does
 * not intercept here (verified: the real transport is created instead).
 *
 * A separate file from the unconfigured suite, because src/config and the
 * mailer's cached transporter are read once per module instance.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import Module from 'node:module';

const SMTP_PASSWORD = 'test-app-password-not-real';

process.env.SMTP_HOST = 'smtp.example.test';
process.env.SMTP_PORT = '587';
process.env.SMTP_USER = 'mailer@example.test';
process.env.SMTP_PASS = SMTP_PASSWORD;
process.env.EMAIL_FROM = 'noreply@example.test';
process.env.EMAIL_DISABLED = '';
process.env.FRONTEND_URL = 'https://shop.example.test';

const smtp = {
  verifyCalls: 0,
  sent: [] as any[],
  transportOptions: null as any,
  verifyError: null as any,
  sendError: null as any,
};

const fakeNodemailer = {
  createTransport: (options: any) => {
    smtp.transportOptions = options;
    return {
      verify: async () => {
        smtp.verifyCalls += 1;
        if (smtp.verifyError) throw smtp.verifyError;
        return true;
      },
      sendMail: async (mail: any) => {
        if (smtp.sendError) throw smtp.sendError;
        smtp.sent.push(mail);
        return { messageId: `stub-${smtp.sent.length}` };
      },
    };
  },
};

const originalLoad = (Module as any)._load;
(Module as any)._load = function (request: string, parent: any, isMain: boolean) {
  if (request === 'nodemailer') return fakeNodemailer;
  return originalLoad.call(this, request, parent, isMain);
};

// Required after the patch so the mailer (and its cached transporter) is built
// against the fake.
const mailer = require('../../src/utils/mailer');

describe('mailer with SMTP configured', () => {
  let logSpy: any;
  let errorSpy: any;

  beforeAll(() => {
    // Build the transporter once, so `transportOptions` is populated even if a
    // future test forgets to touch the transport first.
    mailer.getTransporter();
  });

  afterAll(() => {
    (Module as any)._load = originalLoad;
  });

  beforeEach(() => {
    smtp.verifyError = null;
    smtp.sendError = null;
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('reports the configuration without ever leaking the password', () => {
    const status = mailer.getStatus();

    expect(status.configured).toBe(true);
    expect(status.ready).toBe(true);
    expect(status.passwordSet).toBe(true);
    expect(status.disabledByFlag).toBe(false);
    expect(status.host).toBe('smtp.example.test');
    expect(status.port).toBe(587);
    expect(status.secure).toBe(false);
    expect(status.user).toBe('mailer@example.test');
    expect(status.from).toBe('noreply@example.test');
    expect(status.frontendUrl).toBe('https://shop.example.test');

    // The sender address is what an admin needs to see; the secret is not.
    expect(JSON.stringify(status)).not.toContain(SMTP_PASSWORD);
  });

  it('bounds the connection handshake so a dead mail server cannot stall a request', () => {
    // nodemailer's defaults are a 2 minute connection timeout and a 10 minute
    // socket timeout: a hung SMTP server would hold the HTTP request (receipt
    // email, password reset) open that long.
    expect(smtp.transportOptions.connectionTimeout).toBeLessThanOrEqual(10000);
    expect(smtp.transportOptions.greetingTimeout).toBeLessThanOrEqual(10000);
    expect(smtp.transportOptions.socketTimeout).toBeLessThanOrEqual(30000);
    // 587 is STARTTLS, not implicit TLS (465 would be secure: true).
    expect(smtp.transportOptions.secure).toBe(false);
    // The password must still reach the transport — it is only the *reported*
    // status that hides it.
    expect(smtp.transportOptions.auth).toEqual({
      user: 'mailer@example.test',
      pass: SMTP_PASSWORD,
    });
  });

  it('caches a successful verify() and logs it', async () => {
    const before = smtp.verifyCalls;
    const result = await mailer.verifyConnection();

    expect(result).toMatchObject({ ok: true, reason: null, error: null, hint: null });
    expect(smtp.verifyCalls - before).toBe(1);
    expect(logSpy.mock.calls.map((c: any[]) => String(c[0])).join('\n'))
      .toMatch(/SMTP connection verified: smtp\.example\.test:587/);
    expect(mailer.getStatus().lastVerify).toMatchObject({ ok: true, reason: null });
  });

  it('does not re-dial the SMTP server for a plain status read', () => {
    const before = smtp.verifyCalls;
    mailer.getStatus();
    expect(smtp.verifyCalls).toBe(before);
  });

  it('classifies a rejected login as an auth failure and names the Gmail trap', async () => {
    smtp.verifyError = new Error('Invalid login: 535-5.7.8 Username and Password not accepted. 534-5.7.9');

    const result = await mailer.verifyConnection();

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('auth');
    expect(result.error).toMatch(/535/);
    expect(result.hint).toMatch(/App Password/);
    expect(JSON.stringify(result)).not.toContain(SMTP_PASSWORD);
    expect(errorSpy.mock.calls.map((c: any[]) => String(c[0])).join('\n'))
      .toMatch(/\[MAILER\] SMTP verify FAILED \(auth\)/);
  });

  it('classifies an unreachable server as a connection failure', async () => {
    smtp.verifyError = new Error('connect ECONNREFUSED 127.0.0.1:587');

    const result = await mailer.verifyConnection();

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('connection');
    expect(result.hint).toMatch(/SMTP_HOST\/SMTP_PORT/);
    expect(mailer.getStatus().lastVerify).toMatchObject({ ok: false, reason: 'connection' });
  });

  it('sends through the transport and counts the success', async () => {
    const before = mailer.getFailureStats();
    const result = await mailer.sendEmail({
      to: 'staff@example.test',
      subject: 'Ping',
      html: '<p>hello</p>',
      text: 'hello',
    });

    expect(result).toEqual({ sent: true, messageId: 'stub-1' });
    expect(smtp.sent).toHaveLength(1);
    // EMAIL_FROM wins over SMTP_USER as the sender — the variable that is wrong
    // far more often than not (MAIL_FROM is silently ignored by config).
    expect(smtp.sent[0].from).toBe('noreply@example.test');
    expect(smtp.sent[0].to).toBe('staff@example.test');
    expect(smtp.sent[0].text).toBe('hello');
    expect(mailer.getFailureStats().sent - before.sent).toBe(1);
  });

  it('falls back to the subject when no text body is given', async () => {
    await mailer.sendEmail({ to: 'staff@example.test', subject: 'Subject only', html: '<p>x</p>' });
    expect(smtp.sent[smtp.sent.length - 1].text).toBe('Subject only');
  });

  it('returns the failure instead of throwing when the server rejects the message', async () => {
    const before = mailer.getFailureStats();
    smtp.sendError = new Error('535 5.7.8 Username and Password not accepted');

    const result = await mailer.sendEmail({ to: 'staff@example.test', subject: 'Reset', html: '<p>x</p>' });

    expect(result.sent).toBe(false);
    expect(result.reason).toBe('auth');
    expect(result.error).toMatch(/535/);
    expect(result.hint).toMatch(/App Password/);

    const after = mailer.getFailureStats();
    expect(after.errored - before.errored).toBe(1);
    expect(after.lastError).toMatch(/535/);
  });

  it('classifies a dropped connection during send as a connection failure', async () => {
    smtp.sendError = new Error('connect ETIMEDOUT 203.0.113.9:587');

    const result = await mailer.sendEmail({ to: 'staff@example.test', subject: 'Reset' });

    expect(result).toMatchObject({ sent: false, reason: 'connection' });
    expect(result.hint).toMatch(/could not be reached/);
  });

  it('exposes counters in the documented shape', () => {
    expect(mailer.getFailureStats()).toEqual({
      sent: expect.any(Number),
      notConfigured: expect.any(Number),
      errored: expect.any(Number),
      lastError: expect.anything(),
    });
  });
});
