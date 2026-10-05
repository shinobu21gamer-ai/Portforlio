/**
 * ROUTE-LEVEL integration tests for the core POS sale flow.
 *
 * Why this file exists: the unit suite calls saleService.create() directly,
 * which bypasses the Express route + Joi validator layer. That gap is exactly
 * what let a broken createSale schema (Joi "Invalid reference exceeds the
 * schema root") ship with the entire POS checkout 500-ing on every request
 * while 431 tests stayed green. These tests build the real app (src/app.js)
 * on an ephemeral port against an in-memory SQLite database and exercise the
 * HTTP endpoints the way the POS frontend does.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

// Must be set before any src module is required.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-ci-only-32chars!!';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-for-ci-only-32chars';
process.env.JWT_EXPIRES_IN = '1h';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.DB_DIALECT = 'sqlite';
process.env.DB_STORAGE = ':memory:';
// Deterministic registration-gate baseline for this suite (env wins over the
// settings file, so the test can also flip the toggle via the API below).
process.env.ALLOW_PUBLIC_REGISTRATION = '';

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const models = require('../../src/models');
const { sequelize, User, Role, Permission, Product, Category, ActivityLog, Sale } = models;
const authService = require('../../src/services/auth.service');

let server: any;
let baseUrl = '';
let adminToken = '';
let cashierToken = '';
let cashierId = 0;
let productId = 0;

const settingsFile = path.resolve(__dirname, '../../data/settings.json');
let settingsBackup: string | null = null;

const api = axios.create({ timeout: 10000 });

const login = async (email: string, password: string) => {
  const res = await api.post(`${baseUrl}/auth/login`, { email, password });
  return res.data.data.token as string;
};

beforeAll(async () => {
  await sequelize.authenticate();
  await sequelize.sync({ force: true });

  // --- minimal seed: roles + permission + two users + one product ---
  const perm = await Permission.create({ name: 'Create Sales', slug: 'sales.create', module: 'sales' });
  const adminRole = await Role.create({ name: 'Admin', slug: 'admin', isActive: true });
  const cashierRole = await Role.create({ name: 'Cashier', slug: 'cashier', isActive: true });
  await cashierRole.addPermission(perm);
  await adminRole.addPermission(perm);

  const mkUser = (email: string, role: any) =>
    User.create({
      firstName: 'Test',
      lastName: email.split('@')[0],
      email,
      password: 'Passw0rd!123',
      roleId: role.id,
      isActive: true,
    });

  await mkUser('route-admin@example.com', adminRole);
  const cashier = await mkUser('route-cashier@example.com', cashierRole);
  cashierId = cashier.id;

  const cat = await Category.create({ name: 'Route Test Cat', slug: 'route-test-cat' });
  const product = await Product.create({
    name: 'Route Test Soda',
    slug: 'route-test-soda',
    sku: 'ROUTE-001',
    barcode: '1000000000001',
    categoryId: cat.id,
    unit: 'pcs',
    buyingPrice: 10,
    sellingPrice: 20,
    stockQuantity: 100,
    minStockLevel: 5,
    taxRate: 0,
    isActive: true,
  });
  productId = product.id;

  // --- start the real app on an ephemeral port ---
  const { server: appServer } = require('../../src/app');
  server = appServer;
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}/api/v1`;

  // settings.json is repo-tracked; the settings API writes it, so take a
  // backup and restore byte-for-byte after the suite.
  if (fs.existsSync(settingsFile)) settingsBackup = fs.readFileSync(settingsFile, 'utf8');

  adminToken = await login('route-admin@example.com', 'Passw0rd!123');
  cashierToken = await login('route-cashier@example.com', 'Passw0rd!123');
}, 60000);

afterAll(async () => {
  try {
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  } catch { /* already closed */ }
  if (settingsBackup !== null) {
    fs.writeFileSync(settingsFile, settingsBackup);
  } else if (process.env.DELETE_SETTINGS_ON_RESTORE === '1') {
    // no-op guard
  }
  await sequelize.close();
}, 30000);

beforeEach(async () => {
  // Reset money-critical state between cases; keep users/roles/product.
  await Sale.destroy({ where: {}, force: true });
  await ActivityLog.destroy({ where: {}, force: true });
  const p = await Product.findByPk(productId);
  if (p) await p.update({ stockQuantity: 100 });
});

describe('POST /api/v1/sales (route + validator layer)', () => {
  it('creates a cash sale and decrements stock', async () => {
    const res = await api.post(
      `${baseUrl}/sales`,
      { items: [{ productId, quantity: 2 }], paymentMethod: 'cash', cashAmount: 100 },
      { headers: { Authorization: `Bearer ${cashierToken}` } },
    );
    expect(res.status).toBe(201);
    expect(res.data.success).toBe(true);

    const sale = res.data.data;
    expect(sale.total).toBe(40); // 2 x 20, no tax (product taxRate 0)
    expect(sale.paymentStatus).toBe('paid');
    expect(sale.status).toBe('completed');

    const product = await Product.findByPk(productId);
    expect(product!.stockQuantity).toBe(98);
  });

  it('applies a percentage discount to the payable total (not just the line)', async () => {
    const res = await api.post(
      `${baseUrl}/sales`,
      {
        items: [{ productId, quantity: 1, discountType: 'percentage', discountValue: 10 }],
        paymentMethod: 'cash',
        cashAmount: 100,
      },
      { headers: { Authorization: `Bearer ${cashierToken}` } },
    );
    expect(res.status).toBe(201);
    const sale = res.data.data;
    // Line: 20 - 10% = 18. Total must equal the line total — previously the
    // item discount was shown on the line but ignored in the total (20).
    expect(sale.items[0].total).toBe(18);
    expect(sale.total).toBe(18);
    expect(sale.changeAmount).toBe(82); // 100 - 18
  });

  it('rejects a discount value without a discount type (422, field message)', async () => {
    const res = await api
      .post(
        `${baseUrl}/sales`,
        { items: [{ productId, quantity: 1, discountValue: 10 }], paymentMethod: 'cash' },
        { headers: { Authorization: `Bearer ${cashierToken}` } },
      )
      .catch((e) => e.response);
    expect(res.status).toBe(422);
    expect(res.data.errors.join(' ')).toMatch(/discountType/);
  });

  it('rejects an order-level discount without a type (422)', async () => {
    const res = await api
      .post(
        `${baseUrl}/sales`,
        { items: [{ productId, quantity: 1 }], discountValue: 5, paymentMethod: 'cash' },
        { headers: { Authorization: `Bearer ${cashierToken}` } },
      )
      .catch((e) => e.response);
    expect(res.status).toBe(422);
    expect(res.data.errors.join(' ')).toMatch(/discountType/);
  });

  it('blocks cashiers from manual order-level discounts (403)', async () => {
    const res = await api
      .post(
        `${baseUrl}/sales`,
        { items: [{ productId, quantity: 1 }], discountType: 'fixed', discountValue: 5, paymentMethod: 'cash', cashAmount: 100 },
        { headers: { Authorization: `Bearer ${cashierToken}` } },
      )
      .catch((e) => e.response);
    expect(res.status).toBe(403);
  });

  it('allows managers/admins to apply manual order-level discounts', async () => {
    const res = await api.post(
      `${baseUrl}/sales`,
      { items: [{ productId, quantity: 1 }], discountType: 'fixed', discountValue: 5, paymentMethod: 'cash', cashAmount: 100 },
      { headers: { Authorization: `Bearer ${adminToken}` } },
    );
    expect(res.status).toBe(201);
    expect(res.data.data.total).toBe(15);
  });

  it('rejects selling more than stock (400)', async () => {
    const res = await api
      .post(
        `${baseUrl}/sales`,
        { items: [{ productId, quantity: 101 }], paymentMethod: 'cash', cashAmount: 100000 },
        { headers: { Authorization: `Bearer ${cashierToken}` } },
      )
      .catch((e) => e.response);
    expect(res.status).toBe(400);
  });

  it('requires authentication (401)', async () => {
    const res = await api
      .post(`${baseUrl}/sales`, { items: [{ productId, quantity: 1 }], paymentMethod: 'cash' })
      .catch((e) => e.response);
    expect(res.status).toBe(401);
  });

  it('cashier scope: list shows only own sales', async () => {
    // cashier makes a sale; admin makes one too
    await api.post(
      `${baseUrl}/sales`,
      { items: [{ productId, quantity: 1 }], paymentMethod: 'cash', cashAmount: 100 },
      { headers: { Authorization: `Bearer ${cashierToken}` } },
    );
    await api.post(
      `${baseUrl}/sales`,
      { items: [{ productId, quantity: 1 }], paymentMethod: 'cash', cashAmount: 100 },
      { headers: { Authorization: `Bearer ${adminToken}` } },
    );

    const mine = await api.get(`${baseUrl}/sales`, { headers: { Authorization: `Bearer ${cashierToken}` } });
    const all = mine.data.data.sales;
    expect(all.length).toBeGreaterThan(0);
    expect(all.every((s: any) => String(s.userId) === String(cashierId))).toBe(true);
  });
});

describe('POST /api/v1/sales/pending (online checkout entry point)', () => {
  it('creates a pending gcash sale without payment status', async () => {
    const res = await api.post(
      `${baseUrl}/sales/pending`,
      { items: [{ productId, quantity: 1 }], paymentMethod: 'gcash' },
      { headers: { Authorization: `Bearer ${cashierToken}` } },
    );
    expect(res.status).toBe(201);
    expect(res.data.data.status).toBe('pending');
    expect(res.data.data.paymentStatus).toBe('pending');
  });

  it('refuses cash as a pending payment method', async () => {
    const res = await api
      .post(
        `${baseUrl}/sales/pending`,
        { items: [{ productId, quantity: 1 }], paymentMethod: 'cash' },
        { headers: { Authorization: `Bearer ${cashierToken}` } },
      )
      .catch((e) => e.response);
    expect(res.status).toBe(400);
  });
});

describe('POST /api/v1/sales/pending/:id/cash-complete (admin/manager override)', () => {
  const makePending = async (token: string) => {
    const res = await api.post(
      `${baseUrl}/sales/pending`,
      { items: [{ productId, quantity: 1 }], paymentMethod: 'gcash' },
      { headers: { Authorization: `Bearer ${token}` } },
    );
    return res.data.data as any;
  };
  const cashComplete = (id: number, token: string) =>
    api
      .post(`${baseUrl}/sales/pending/${id}/cash-complete`, {}, { headers: { Authorization: `Bearer ${token}` } })
      .catch((e) => e.response);

  it('lets an admin complete a pending sale as cash, without double-decrementing stock', async () => {
    const pending = await makePending(adminToken);
    expect(pending.status).toBe('pending');
    // stock already reserved at pending creation
    expect((await Product.findByPk(productId))!.stockQuantity).toBe(99);

    const res = await cashComplete(pending.id, adminToken);
    expect(res.status).toBe(200);
    const sale = res.data.data;
    expect(sale.status).toBe('completed');
    expect(sale.paymentStatus).toBe('paid');
    expect(sale.paymentMethod).toBe('cash');
    expect(sale.paymentReference).toMatch(/^CASH-OVERRIDE-/);

    // the override must NOT decrement stock a second time
    expect((await Product.findByPk(productId))!.stockQuantity).toBe(99);
  });

  it('forbids cashiers (403)', async () => {
    const pending = await makePending(cashierToken);
    const res = await cashComplete(pending.id, cashierToken);
    expect(res.status).toBe(403);
  });

  it('rejects completing an already-paid sale (409)', async () => {
    const pending = await makePending(adminToken);
    const first = await cashComplete(pending.id, adminToken);
    expect(first.status).toBe(200);
    const second = await cashComplete(pending.id, adminToken);
    expect(second.status).toBe(409);
  });

  it('requires authentication (401)', async () => {
    const pending = await makePending(adminToken);
    const res = await api
      .post(`${baseUrl}/sales/pending/${pending.id}/cash-complete`)
      .catch((e) => e.response);
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/auth/register (public gate)', () => {
  const payload = {
    firstName: 'Stray',
    lastName: 'Stranger',
    email: `stray-${Date.now()}@example.com`,
    password: 'Passw0rd!123',
  };

  it('allows registration when the environment default allows it (test env)', async () => {
    const res = await api.post(`${baseUrl}/auth/register`, payload);
    expect(res.status).toBe(201);
    expect(res.data.data.user.email).toBe(payload.email);
  });

  it('blocks registration when ALLOW_PUBLIC_REGISTRATION=false (env override)', async () => {
    process.env.ALLOW_PUBLIC_REGISTRATION = 'false';
    const res = await api
      .post(`${baseUrl}/auth/register`, { ...payload, email: `stray-${Date.now()}b@example.com` })
      .catch((e) => e.response);
    expect(res.status).toBe(403);
    process.env.ALLOW_PUBLIC_REGISTRATION = '';
  });

  it('honours the admin Settings toggle at runtime', async () => {
    // Admin disables via the settings API...
    const off = await api.put(
      `${baseUrl}/settings`,
      { allowPublicRegistration: false },
      { headers: { Authorization: `Bearer ${adminToken}` } },
    );
    expect(off.status).toBe(200);
    expect(off.data.data.publicRegistrationEffective).toBe(false);

    const blocked = await api
      .post(`${baseUrl}/auth/register`, { ...payload, email: `stray-${Date.now()}c@example.com` })
      .catch((e) => e.response);
    expect(blocked.status).toBe(403);

    // ...and re-enables it.
    const on = await api.put(
      `${baseUrl}/settings`,
      { allowPublicRegistration: true },
      { headers: { Authorization: `Bearer ${adminToken}` } },
    );
    expect(on.data.data.publicRegistrationEffective).toBe(true);

    const ok = await api.post(`${baseUrl}/auth/register`, { ...payload, email: `stray-${Date.now()}d@example.com` });
    expect(ok.status).toBe(201);
  });
});

describe('PUT /api/v1/settings (onboarding dismissal key)', () => {
  it('persists onboardingDismissedAt for admins and clears it with null', async () => {
    const stamp = new Date().toISOString();
    const put = await api.put(
      `${baseUrl}/settings`,
      { onboardingDismissedAt: stamp },
      { headers: { Authorization: `Bearer ${adminToken}` } },
    );
    expect(put.status).toBe(200);
    expect(put.data.data.onboardingDismissedAt).toBe(stamp);

    const clear = await api.put(
      `${baseUrl}/settings`,
      { onboardingDismissedAt: null },
      { headers: { Authorization: `Bearer ${adminToken}` } },
    );
    expect(clear.data.data.onboardingDismissedAt).toBeNull();
  });

  it('forbids non-admins from writing settings (403)', async () => {
    const res = await api
      .put(
        `${baseUrl}/settings`,
        { onboardingDismissedAt: '2026-01-01T00:00:00.000Z' },
        { headers: { Authorization: `Bearer ${cashierToken}` } },
      )
      .catch((e) => e.response);
    expect(res.status).toBe(403);
  });

  it('rejects a malformed timestamp (422)', async () => {
    const res = await api
      .put(
        `${baseUrl}/settings`,
        { onboardingDismissedAt: 'not-a-date' },
        { headers: { Authorization: `Bearer ${adminToken}` } },
      )
      .catch((e) => e.response);
    expect(res.status).toBe(422);
  });
});

describe('GET /api/v1/tracking/* (role-gated)', () => {
  it('forbids cashiers from reading delivery tracking (IDOR guard)', async () => {
    const res = await api
      .get(`${baseUrl}/tracking/delivery/1`, { headers: { Authorization: `Bearer ${cashierToken}` } })
      .catch((e) => e.response);
    expect(res.status).toBe(403);
  });

  it('allows inventory_staff/manager/admin roles', async () => {
    const res = await api
      .get(`${baseUrl}/tracking/delivery/1`, { headers: { Authorization: `Bearer ${adminToken}` } })
      .catch((e) => e.response);
    // 404 (no such delivery) is fine — the point is it is NOT 403.
    expect([200, 404]).toContain(res.status);
  });
});
