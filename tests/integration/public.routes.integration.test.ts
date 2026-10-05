/**
 * Route-level integration tests for the PUBLIC surface (no auth required):
 *   GET  /api/v1/public/jobs         – open jobs only, stable shape
 *   GET  /api/v1/public/jobs/:id     – open job ok, closed job 400
 *   GET  /api/v1/public/settings     – brand fields only (no payment info)
 *   POST /api/v1/public/jobs/apply   – field validation before any DB work
 *
 * Boots the real Express app (src/app.js) on an ephemeral port with an
 * in-memory SQLite database.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import axios from 'axios';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const models = require('../../src/models');
const { sequelize, Department, JobPosting } = models;

let server: any;
let baseUrl = '';

const settingsFile = path.resolve(__dirname, '../../data/settings.json');
let settingsBackup: string | null = null;

const api = axios.create({ timeout: 10000 });

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'integration-test-jwt-secret-32chars!!';
  process.env.JWT_REFRESH_SECRET = 'integration-test-refresh-secret-32char!';
  process.env.DATABASE_URL = 'sqlite::memory:';
  process.env.ALLOW_PUBLIC_REGISTRATION = '';

  const { server: appServer } = require('../../src/app');
  server = appServer;
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  baseUrl = `http://127.0.0.1:${port}/api/v1`;

  if (fs.existsSync(settingsFile)) settingsBackup = fs.readFileSync(settingsFile, 'utf8');

  await sequelize.sync({ force: true });

  // Seed one department + one open + one closed posting.
  const dept = await Department.create({ name: 'Test Dept', description: 'x' });
  await JobPosting.create({
    title: 'Open Role', departmentId: dept.id, description: 'd',
    employmentType: 'full-time', status: 'open', approvedAt: new Date(),
  });
  await JobPosting.create({
    title: 'Closed Role', departmentId: dept.id, description: 'd',
    employmentType: 'full-time', status: 'closed', approvedAt: new Date(),
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

describe('GET /api/v1/public/jobs (public, no auth)', () => {
  it('lists only open postings with a stable shape', async () => {
    const res = await api.get(`${baseUrl}/public/jobs`);
    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
    expect(Array.isArray(res.data.data.jobs)).toBe(true);
    expect(res.data.data.pagination.total).toBe(1);
    const [job] = res.data.data.jobs;
    expect(job.title).toBe('Open Role');
    expect(job.status).toBe('open');
    expect(job.department).toMatchObject({ name: 'Test Dept' });
  });

  it('never exposes closed/filled postings to the public', async () => {
    const res = await api.get(`${baseUrl}/public/jobs?limit=50`);
    const titles = res.data.data.jobs.map((j: any) => j.title);
    expect(titles).not.toContain('Closed Role');
  });
});

describe('GET /api/v1/public/jobs/:id (public, no auth)', () => {
  it('returns an open posting', async () => {
    const list = await api.get(`${baseUrl}/public/jobs`);
    const openId = list.data.data.jobs[0].id;
    const res = await api.get(`${baseUrl}/public/jobs/${openId}`);
    expect(res.status).toBe(200);
    expect(res.data.data.id).toBe(openId);
  });

  it('rejects a closed posting', async () => {
    const list = await api.get(`${baseUrl}/public/jobs`);
    const openId = list.data.data.jobs[0].id;
    // closed posting has the other id (created second)
    const res = await api.get(`${baseUrl}/public/jobs/${openId + 1}`, { validateStatus: () => true });
    expect(res.status).toBe(400);
    expect(res.data.message).toMatch(/not accepting applications/i);
  });

  it('404 for unknown id', async () => {
    const res = await api.get(`${baseUrl}/public/jobs/99999`, { validateStatus: () => true });
    expect(res.status).toBe(404);
  });
});

describe('GET /api/v1/public/settings (brand-safe only)', () => {
  it('returns brand fields', async () => {
    const res = await api.get(`${baseUrl}/public/settings`);
    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
    expect(res.data.data).toHaveProperty('storeName');
    expect(res.data.data).toHaveProperty('currency');
  });

  it('never leaks operational/payment fields', async () => {
    const res = await api.get(`${baseUrl}/public/settings`);
    const data = res.data.data;
    for (const forbidden of ['gcashNumber', 'mayaNumber', 'taxRate', 'lowStockThreshold', 'receiptFooter', 'publicRegistrationEffective']) {
      expect(data, `should not expose ${forbidden}`).not.toHaveProperty(forbidden);
    }
  });
});

describe('POST /api/v1/public/jobs/apply (public, no auth)', () => {
  it('validates required fields before creating anything', async () => {
    const res = await api.post(`${baseUrl}/public/jobs/apply`, { firstName: 'Only First' }, { validateStatus: () => true });
    expect(res.status).toBe(400);
    expect(res.data.message).toMatch(/missing required fields/i);
  });

  it('404 for an unknown job', async () => {
    const res = await api.post(`${baseUrl}/public/jobs/apply`, {
      jobId: 99999, firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com',
    }, { validateStatus: () => true });
    expect(res.status).toBe(404);
  });
});
