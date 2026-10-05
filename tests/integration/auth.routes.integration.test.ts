/**
 * Route-level integration tests for the forgot-password / reset flow.
 *
 * Covers the dev-mode behaviour: outside production, when SMTP is not
 * configured the server hands back a working reset link (devResetUrl) so a
 * fresh deployment can actually reset a password. The full round-trip is
 * exercised over HTTP, and the response shape for unknown emails is checked
 * for email-enumeration resistance.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

// Must be set before any src module is required (src/config captures
// process.env values at require time; beforeAll runs too late).
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-ci-only-32chars!!';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-for-ci-only-32chars';
process.env.JWT_EXPIRES_IN = '1h';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.DB_DIALECT = 'sqlite';
process.env.DB_STORAGE = ':memory:';
process.env.ALLOW_PUBLIC_REGISTRATION = '';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import axios from 'axios';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const models = require('../../src/models');
const { sequelize, User, Role } = models;

let server: any;
let baseUrl = '';
let knownEmail = '';

const settingsFile = path.resolve(__dirname, '../../data/settings.json');
let settingsBackup: string | null = null;

const api = axios.create({ timeout: 10000 });

beforeAll(async () => {
  const { server: appServer } = require('../../src/app');
  server = appServer;
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  baseUrl = `http://127.0.0.1:${port}/api/v1`;

  if (fs.existsSync(settingsFile)) settingsBackup = fs.readFileSync(settingsFile, 'utf8');

  await sequelize.sync({ force: true });

  const role = await Role.create({ name: 'Test Role', slug: 'test-role-' + Date.now(), isActive: true });
  knownEmail = `reset-${Date.now()}@example.com`;
  await User.create({
    firstName: 'Reset', lastName: 'User', email: knownEmail,
    password: 'Original!123', roleId: role.id, isActive: true,
  });
}, 60000);

afterAll(async () => {
  try {
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  } catch { /* already closed */ }
  if (settingsBackup !== null) {
    fs.writeFileSync(settingsFile, settingsBackup);
  }
  await sequelize.close();
});

describe('POST /api/v1/auth/forgot-password', () => {
  it('returns a working devResetUrl outside production (SMTP unconfigured)', async () => {
    const res = await api.post(`${baseUrl}/auth/forgot-password`, { email: knownEmail });
    expect(res.status).toBe(200);
    expect(res.data.data).toHaveProperty('message');
    const devResetUrl = res.data.data.devResetUrl;
    expect(devResetUrl).toBeTruthy();
    const token = new URL(devResetUrl).searchParams.get('token');
    expect(token).toMatch(/^[a-f0-9]{64}$/);
  });

  it('keeps the response generic for unknown emails (no enumeration)', async () => {
    const res = await api.post(`${baseUrl}/auth/forgot-password`, { email: 'nobody@example.com' });
    expect(res.status).toBe(200);
    expect(res.data.data).not.toHaveProperty('devResetUrl');
    expect(res.data.data.message).toMatch(/if the email exists/i);
  });
});

describe('full reset round-trip over HTTP', () => {
  it('request → reset → login, and old password stops working', async () => {
    // 1. request a reset link
    const fp = await api.post(`${baseUrl}/auth/forgot-password`, { email: knownEmail });
    const token = new URL(fp.data.data.devResetUrl).searchParams.get('token');

    // 2. reset to a new password
    const rp = await api.post(`${baseUrl}/auth/reset-password`, { token, password: 'NewSecret!456' });
    expect(rp.status).toBe(200);

    // 3. login with the new password works
    const ok = await api.post(`${baseUrl}/auth/login`, { email: knownEmail, password: 'NewSecret!456' });
    expect(ok.status).toBe(200);
    expect(ok.data.data.token).toBeTruthy();

    // 4. the old password no longer works
    const bad = await api.post(
      `${baseUrl}/auth/login`,
      { email: knownEmail, password: 'Original!123' },
      { validateStatus: () => true },
    );
    expect(bad.status).toBe(401);

    // 5. a consumed token cannot be reused
    const reuse = await api.post(
      `${baseUrl}/auth/reset-password`,
      { token, password: 'Another!789' },
      { validateStatus: () => true },
    );
    expect(reuse.status).not.toBe(200);
  });
});
