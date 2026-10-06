/**
 * Mailer behaviour when SMTP is not configured — the state that silently drops
 * every password reset, payslip, contract notice and receipt.
 *
 * This is a separate file (rather than a describe block in the configured
 * suite) because src/config reads process.env at require time and these are
 * CommonJS modules: the "unconfigured" world and the "configured" world cannot
 * both exist in one module cache.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Set (rather than delete) so a developer's .env cannot re-enable SMTP behind
// dotenv's back — dotenv never overwrites an existing key, even an empty one.
process.env.SMTP_HOST = '';
process.env.SMTP_USER = '';
process.env.SMTP_PASS = '';
process.env.EMAIL_FROM = '';
process.env.EMAIL_DISABLED = 'true';
process.env.FRONTEND_URL = '';

const mailer = require('../../src/utils/mailer');

describe('mailer with SMTP unconfigured', () => {
  const deltas = (before: any, after: any) => ({
    sent: after.sent - before.sent,
    notConfigured: after.notConfigured - before.notConfigured,
    errored: after.errored - before.errored,
  });

  let errorSpy: any;
  let warnSpy: any;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });

  // Runs first on purpose: the "SMTP is NOT configured" banner is logged once
  // per process (warnedNotConfigured), so the count below would be zero if a
  // later test had already forced the transporter to be built.
  it('logs the unconfigured banner once, and one warning per dropped email', async () => {
    const before = mailer.getFailureStats();

    await mailer.sendEmail({ to: 'a@example.com', subject: 'First' });
    await mailer.sendEmail({ to: 'b@example.com', subject: 'Second' });

    const banners = errorSpy.mock.calls.filter((c: any[]) => /SMTP is NOT configured/.test(String(c[0])));
    expect(banners).toHaveLength(1);
    // The banner must name the exact variables to set, including the one that
    // is easy to get wrong (EMAIL_FROM, not MAIL_FROM).
    expect(String(banners[0][0])).toMatch(/SMTP_HOST/);
    expect(String(banners[0][0])).toMatch(/EMAIL_FROM/);

    const perEmail = warnSpy.mock.calls.filter((c: any[]) => /Email not sent \(SMTP unconfigured\)/.test(String(c[0])));
    expect(perEmail).toHaveLength(2);

    expect(deltas(before, mailer.getFailureStats())).toEqual({ sent: 0, notConfigured: 2, errored: 0 });
  });

  it('reports isConfigured() === false', () => {
    expect(mailer.isConfigured()).toBe(false);
  });

  it('returns sent:false with an actionable reason instead of throwing', async () => {
    const before = mailer.getFailureStats();
    const result = await mailer.sendEmail({ to: 'a@example.com', subject: 'Ping' });

    expect(result.sent).toBe(false);
    // `dev: true` is the legacy marker callers may already check.
    expect(result.dev).toBe(true);
    expect(result.reason).toBe('not-configured');
    expect(result.hint).toMatch(/Set SMTP_HOST/);
    expect(result.to).toBe('a@example.com');
    expect(deltas(before, mailer.getFailureStats()).notConfigured).toBe(1);
  });

  it('never exposes a password through getStatus()', () => {
    const status = mailer.getStatus();
    expect(status.configured).toBe(false);
    expect(status.ready).toBe(false);
    expect(status.passwordSet).toBe(false);
    // EMAIL_DISABLED is reported because it is routinely mistaken for a switch
    // that turns email off; it only relaxes the production boot guard.
    expect(status.disabledByFlag).toBe(true);
    expect(status.host).toBeNull();
    expect(status.port).toBeNull();
    expect(status.secure).toBe(false);
    expect(status.user).toBeNull();
    expect(status.from).toBeNull();
    expect(status.frontendUrl).toBeNull();
    expect(status.counters).toMatchObject({
      sent: expect.any(Number),
      notConfigured: expect.any(Number),
      errored: expect.any(Number),
    });
  });

  it('verifyConnection() reports not-configured with a hint and never throws', async () => {
    const result = await mailer.verifyConnection();

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('not-configured');
    expect(result.error).toMatch(/SMTP_HOST/);
    expect(result.hint).toMatch(/SMTP_HOST/);
    expect(result.checkedAt).toEqual(expect.any(String));
    expect(Number.isNaN(Date.parse(result.checkedAt))).toBe(false);

    // Cached, so GET /health/email can report the boot-time result without
    // re-dialling the SMTP server on every request.
    expect(mailer.getStatus().lastVerify).toMatchObject({ ok: false, reason: 'not-configured' });
  });

  it('summarises undelivered mail for the periodic log line', () => {
    expect(mailer.reportFailuresIfAny()).toBe(true);
    const summary = errorSpy.mock.calls.map((c: any[]) => String(c[0])).find((line: string) => /email\(s\) not delivered/.test(line));
    expect(summary).toBeDefined();
    expect(summary).toMatch(/unconfigured/);
  });
});
