/**
 * Phase 3 (Security & deploy) — route-level integration tests.
 *
 * Covers three server-side guarantees:
 *  1. mustChangePassword gate (AUDIT.md S1/A6b): flagged accounts (e.g. the
 *     production first-run admin) may only call /auth/change-password and
 *     /auth/logout; every other protected route returns
 *     403 { errors: { code: 'MUST_CHANGE_PASSWORD' } }, and changing the
 *     password clears the flag.
 *  2. Job-apply role gate (AUDIT.md A4): POST /hrms/jobs/applications is the
 *     internal-candidate flow — cashier (and any non-employee) gets 403,
 *     the employee role passes and the application is created.
 *  3. Production config guard (AUDIT.md A6c): `node` refuses to boot in
 *     production without SMTP unless EMAIL_DISABLED=true is set explicitly.
 *
 * Same harness as the other route suites: the real src/app.js on an
 * ephemeral port against in-memory SQLite.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFile } from 'child_process';
import { promisify } from 'util';

// Must be set before any src module is required.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-ci-only-32chars!!';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-for-ci-only-32chars';
process.env.JWT_EXPIRES_IN = '1h';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.DB_DIALECT = 'sqlite';
process.env.DB_STORAGE = ':memory:';

import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pExecFile = promisify(execFile);

const models = require('../../src/models');
const { sequelize, User, Role, Department, JobPosting } = models;

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

let cashierToken = '';
let employeeToken = '';
let jobId = 0;

beforeAll(async () => {
  await sequelize.authenticate();
  await sequelize.sync({ force: true });

  const adminRole = await Role.create({ name: 'Admin', slug: 'admin', isActive: true });
  const cashierRole = await Role.create({ name: 'Cashier', slug: 'cashier', isActive: true });
  const employeeRole = await Role.create({ name: 'Employee', slug: 'employee', isActive: true });

  const mkUser = (email: string, role: any, extra: any = {}) =>
    User.create({
      firstName: 'Gate',
      lastName: email.split('@')[0],
      email,
      password: 'Passw0rd!123',
      roleId: role.id,
      isActive: true,
      ...extra,
    });

  // Flagged account (the production first-run admin equivalent).
  await mkUser('firstrun@example.com', adminRole, { mustChangePassword: true });
  await mkUser('gate-cashier@example.com', cashierRole);
  await mkUser('gate-employee@example.com', employeeRole);

  const dept = await Department.create({ name: 'Gate Dept', slug: 'gate-dept' });
  const job = await JobPosting.create({
    title: 'Gate Test Role',
    departmentId: dept.id,
    description: 'Internal gate test posting',
    status: 'open',
  });
  jobId = job.id;

  // --- start the real app on an ephemeral port ---
  const { server: appServer } = require('../../src/app');
  server = appServer;
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}/api/v1`;

  cashierToken = (await login('gate-cashier@example.com', 'Passw0rd!123')).token;
  employeeToken = (await login('gate-employee@example.com', 'Passw0rd!123')).token;
}, 60000);

afterAll(async () => {
  try {
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  } catch { /* already closed */ }
  await sequelize.close();
}, 30000);

describe('mustChangePassword gate (S1/A6b)', () => {
  it('login succeeds and surfaces the flag on the user payload', async () => {
    const res = await api.post(`${baseUrl}/auth/login`, {
      email: 'firstrun@example.com',
      password: 'Passw0rd!123',
    });
    expect(res.status).toBe(200);
    expect(res.data.data.user.mustChangePassword).toBe(true);
  });

  it('blocks protected routes with 403 { code: MUST_CHANGE_PASSWORD }', async () => {
    const { token } = await login('firstrun@example.com', 'Passw0rd!123');
    const res = await api.get(`${baseUrl}/products`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(403);
    expect(res.data.errors?.code).toBe('MUST_CHANGE_PASSWORD');
  });

  it('still allows /auth/logout while flagged', async () => {
    const { token } = await login('firstrun@example.com', 'Passw0rd!123');
    const res = await api.post(`${baseUrl}/auth/logout`, {}, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
  });

  it('change-password clears the flag and unblocks the account', async () => {
    const { token } = await login('firstrun@example.com', 'Passw0rd!123');
    const change = await api.post(
      `${baseUrl}/auth/change-password`,
      { currentPassword: 'Passw0rd!123', newPassword: 'N3wPassw0rd!x' },
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(change.status).toBe(200);

    // Old tokens are invalidated on password change (iat check) — a fresh
    // login with the new password must work and must no longer be flagged.
    const fresh = await login('firstrun@example.com', 'N3wPassw0rd!x');
    expect(fresh.user.mustChangePassword).toBe(false);

    const res = await api.get(`${baseUrl}/products`, {
      headers: { Authorization: `Bearer ${fresh.token}` },
    });
    expect(res.status).toBe(200);
  });
});

describe('job-apply role gate (A4)', () => {
  // Built per-test: jobId is only known after beforeAll seeds the posting.
  const applyBody = () => ({
    jobId,
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'jane.doe@example.com',
  });

  it('rejects a cashier (non-employee) with 403', async () => {
    const res = await api.post(`${baseUrl}/hrms/jobs/applications`, applyBody(), {
      headers: { Authorization: `Bearer ${cashierToken}` },
    });
    expect(res.status).toBe(403);
  });

  it('lets the employee role through and creates the application', async () => {
    const res = await api.post(`${baseUrl}/hrms/jobs/applications`, applyBody(), {
      headers: { Authorization: `Bearer ${employeeToken}` },
    });
    expect(res.status).toBe(201);
  });
});

describe('production config guard (A6c)', () => {
  // The guard lives in src/config and calls process.exit(1), so it must be
  // exercised in a child process. Existing env vars always win over .env
  // (dotenv never overrides), so pass explicit values to neutralize a local
  // .env.
  const requireConfig = (extra: Record<string, string>) =>
    pExecFile(process.execPath, ['-e', `require(${JSON.stringify(path.resolve(__dirname, '../../src/config'))});`], {
      env: {
        ...process.env,
        NODE_ENV: 'production',
        JWT_SECRET: 'prod-guard-test-jwt-secret-32chars!!',
        JWT_REFRESH_SECRET: 'prod-guard-test-refresh-secret-32chars',
        SMTP_HOST: '',
        SMTP_PORT: '',
        SMTP_USER: '',
        SMTP_PASS: '',
        EMAIL_DISABLED: '',
        DB_DIALECT: 'sqlite',
        DB_STORAGE: ':memory:',
        ...extra,
      },
    });

  it('refuses to boot in production without SMTP', async () => {
    let exitCode = 0;
    let stderr = '';
    try {
      await requireConfig({});
    } catch (e: any) {
      exitCode = e.code ?? 1;
      stderr = (e.stderr as string) || e.message || '';
    }
    expect(exitCode).toBe(1);
    expect(stderr).toContain('SMTP_HOST');
    expect(stderr).toContain('EMAIL_DISABLED=true');
  });

  it('boots when SMTP is configured', async () => {
    const { stderr } = await requireConfig({
      SMTP_HOST: 'smtp.example.com',
      SMTP_PORT: '587',
      SMTP_USER: 'noreply@example.com',
    });
    expect(stderr).not.toContain('SMTP_HOST is required');
  });

  it('boots when EMAIL_DISABLED=true opts out explicitly', async () => {
    const { stderr } = await requireConfig({ EMAIL_DISABLED: 'true' });
    expect(stderr).not.toContain('SMTP_HOST is required');
  });
});
