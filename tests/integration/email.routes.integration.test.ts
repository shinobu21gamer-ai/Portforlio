/**
 * Email diagnostics routes — the "no SMTP configured" case, which is the state
 * a fresh Render deploy starts in (render.yaml ships EMAIL_DISABLED=true with
 * the SMTP_* lines commented out).
 *
 * Verifies that an admin can *see* why nothing is being delivered over HTTP
 * instead of having to read deploy logs:
 *   GET  /api/v1/health/email[/?verify=1]  — configuration + last verify + counters
 *   POST /api/v1/health/email/test         — send a real test message
 *
 * SMTP_* is explicitly blanked at the top of this file (before src/config is
 * required) so the suite is deterministic even on a machine whose .env or shell
 * has real mail credentials; the configured/working path is covered by
 * email.smtp.routes.integration.test.ts, which runs a local SMTP server.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-ci-only-32chars!!';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-for-ci-only-32chars';
process.env.JWT_EXPIRES_IN = '1h';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.DB_DIALECT = 'sqlite';
process.env.DB_STORAGE = ':memory:';
process.env.SMTP_HOST = '';
process.env.SMTP_PORT = '';
process.env.SMTP_USER = '';
process.env.SMTP_PASS = '';
process.env.EMAIL_FROM = '';
process.env.EMAIL_DISABLED = 'true';
process.env.FRONTEND_URL = '';

import axios from 'axios';

const models = require('../../src/models');
const { sequelize, User, Role, ActivityLog } = models;

let server: any;
let baseUrl = '';

const api = axios.create({ timeout: 10000, validateStatus: () => true });

const login = async (email: string, password: string) => {
  const res = await api.post(`${baseUrl}/auth/login`, { email, password });
  if (res.status !== 200) {
    throw new Error(`login failed for ${email}: ${res.status} ${JSON.stringify(res.data)}`);
  }
  return res.data.data as { token: string; user: any };
};

let adminToken = '';
let adminId = 0;
let cashierToken = '';

beforeAll(async () => {
  await sequelize.authenticate();
  await sequelize.sync({ force: true });

  const adminRole = await Role.create({ name: 'Admin', slug: 'admin', isActive: true });
  const cashierRole = await Role.create({ name: 'Cashier', slug: 'cashier', isActive: true });

  const mkUser = (email: string, role: any) =>
    User.create({
      firstName: 'Mail',
      lastName: email.split('@')[0],
      email,
      password: 'Passw0rd!123',
      roleId: role.id,
      isActive: true,
    });

  const admin = await mkUser('mail-admin@example.com', adminRole);
  adminId = admin.id;
  await mkUser('mail-cashier@example.com', cashierRole);

  const { server: appServer } = require('../../src/app');
  server = appServer;
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}/api/v1`;

  adminToken = (await login('mail-admin@example.com', 'Passw0rd!123')).token;
  cashierToken = (await login('mail-cashier@example.com', 'Passw0rd!123')).token;
}, 60000);

afterAll(async () => {
  try {
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  } catch { /* already closed */ }
  await sequelize.close();
}, 30000);

const asAdmin = () => ({ headers: { Authorization: `Bearer ${adminToken}` } });

describe('GET /health/email', () => {
  it('requires authentication', async () => {
    const res = await api.get(`${baseUrl}/health/email`);
    expect(res.status).toBe(401);
  });

  it('is admin-only — a cashier gets 403', async () => {
    const res = await api.get(`${baseUrl}/health/email`, {
      headers: { Authorization: `Bearer ${cashierToken}` },
    });
    expect(res.status).toBe(403);
  });

  it('reports the unconfigured state, the flag, and the counters', async () => {
    const res = await api.get(`${baseUrl}/health/email`, asAdmin());

    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
    const data = res.data.data;
    expect(data.configured).toBe(false);
    expect(data.ready).toBe(false);
    expect(data.passwordSet).toBe(false);
    // EMAIL_DISABLED is surfaced because it only relaxes the production boot
    // guard — it does not stop (or enable) sending, which is easy to misread.
    expect(data.disabledByFlag).toBe(true);
    expect(data.host).toBeNull();
    expect(data.port).toBeNull();
    expect(data.user).toBeNull();
    expect(data.from).toBeNull();
    // Links inside outbound email need a public origin.
    expect(data.frontendUrl).toBeNull();
    expect(data.counters).toEqual({
      sent: expect.any(Number),
      notConfigured: expect.any(Number),
      errored: expect.any(Number),
      lastError: null,
    });
  });

  it('answers with a failure reason when asked to verify live (?verify=1)', async () => {
    const res = await api.get(`${baseUrl}/health/email?verify=1`, asAdmin());

    expect(res.status).toBe(200);
    const { lastVerify } = res.data.data;
    expect(lastVerify.ok).toBe(false);
    expect(lastVerify.reason).toBe('not-configured');
    expect(lastVerify.error).toMatch(/SMTP_HOST/);
    expect(lastVerify.hint).toMatch(/SMTP_HOST/);
    expect(Number.isNaN(Date.parse(lastVerify.checkedAt))).toBe(false);
  });
});

describe('POST /health/email/test', () => {
  it('requires authentication', async () => {
    const res = await api.post(`${baseUrl}/health/email/test`, {});
    expect(res.status).toBe(401);
  });

  it('is admin-only — a cashier gets 403', async () => {
    const res = await api.post(`${baseUrl}/health/email/test`, {}, {
      headers: { Authorization: `Bearer ${cashierToken}` },
    });
    expect(res.status).toBe(403);
  });

  it('rejects a malformed recipient with 422 before attempting a send', async () => {
    const res = await api.post(`${baseUrl}/health/email/test`, { to: 'not-an-email' }, asAdmin());
    expect(res.status).toBe(422);
  });

  it('returns 503 + the reason and hint when SMTP is unconfigured', async () => {
    const res = await api.post(`${baseUrl}/health/email/test`, {}, asAdmin());

    expect(res.status).toBe(503);
    expect(res.data.success).toBe(false);
    expect(res.data.message).toMatch(/SMTP is not configured/i);
    expect(res.data.errors.reason).toBe('not-configured');
    expect(res.data.errors.hint).toMatch(/Set SMTP_HOST/);
  });

  it('accepts a valid custom recipient (and still reports the missing SMTP)', async () => {
    const res = await api.post(
      `${baseUrl}/health/email/test`,
      { to: 'owner@example.com', subject: 'Delivery check', message: 'Ping from the test suite' },
      asAdmin(),
    );

    // Unconfigured, so the *send* fails — but validation and routing passed,
    // which is what this case pins down.
    expect(res.status).toBe(503);
  });

  it('records the failed attempt in the activity log', async () => {
    const rows = await ActivityLog.findAll({ where: { action: 'email-test-failed' } });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].userId).toBe(adminId);
    expect(rows[0].description).toMatch(/not-configured/);
  });

  it('never returns a password field, only whether one is set', async () => {
    const res = await api.get(`${baseUrl}/health/email?verify=1`, asAdmin());
    const data = res.data.data;

    expect(data).not.toHaveProperty('password');
    expect(data).not.toHaveProperty('pass');
    expect(data.passwordSet).toBe(false);
    // The hint may name SMTP_PASS (an operator needs to know which variable is
    // missing) but no key in the payload may carry a credential value.
    expect(Object.keys(data)).not.toContain('password');
  });
});
