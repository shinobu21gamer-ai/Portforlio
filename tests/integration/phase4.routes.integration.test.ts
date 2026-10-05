/**
 * Phase-4 route-level integration tests: shifts, refunds/voids, split
 * payments, receipt resend, and the employee temp-password flow.
 *
 * Same pattern as sale.routes.integration.test.ts — the real app on an
 * ephemeral port against in-memory SQLite, so the Express route + Joi +
 * service + transaction layers are all exercised.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-ci-only-32chars!!';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-for-ci-only-32chars';
process.env.JWT_EXPIRES_IN = '1h';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.DB_DIALECT = 'sqlite';
process.env.DB_STORAGE = ':memory:';
process.env.ALLOW_PUBLIC_REGISTRATION = '';
process.env.APP_TIMEZONE = 'Asia/Manila';

import axios from 'axios';

const models = require('../../src/models');
const {
  sequelize, User, Role, Permission, Product, Category, Sale, SaleItem, Payment, Shift,
  Customer, Department, Position, Employee,
} = models;

let server: any;
let baseUrl = '';
let adminToken = '';
let cashierToken = '';
let cashierId = 0;
let productId = 0;

const api = axios.create({ timeout: 10000, validateStatus: () => true });

const login = async (email: string, password: string) => {
  const res = await api.post(`${baseUrl}/auth/login`, { email, password });
  return res.data.data.token as string;
};

beforeAll(async () => {
  await sequelize.authenticate();
  await sequelize.sync({ force: true });

  const perm = await Permission.create({ name: 'Create Sales', slug: 'sales.create', module: 'sales' });
  const adminRole = await Role.create({ name: 'Admin', slug: 'admin', isActive: true });
  const cashierRole = await Role.create({ name: 'Cashier', slug: 'cashier', isActive: true });
  const employeeRole = await Role.create({ name: 'Employee', slug: 'employee', isActive: true });
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

  await mkUser('p4-admin@example.com', adminRole);
  const cashier = await mkUser('p4-cashier@example.com', cashierRole);
  cashierId = cashier.id;

  const cat = await Category.create({ name: 'P4 Cat', slug: 'p4-cat' });
  const product = await Product.create({
    name: 'P4 Soda',
    slug: 'p4-soda',
    sku: 'P4-001',
    barcode: '2000000000001',
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

  // HRMS bits for the temp-password test.
  const dept = await Department.create({ name: 'P4 Ops', description: 'test' });
  const pos = await Position.create({ title: 'P4 Cashier', departmentId: dept.id, roleSlug: 'cashier' });
  (beforeAll as any).__p4DeptId = dept.id;
  (beforeAll as any).__p4PosId = pos.id;

  const { server: appServer } = require('../../src/app');
  server = appServer;
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}/api/v1`;

  adminToken = await login('p4-admin@example.com', 'Passw0rd!123');
  cashierToken = await login('p4-cashier@example.com', 'Passw0rd!123');
}, 60000);

afterAll(async () => {
  try {
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  } catch { /* already closed */ }
  await sequelize.close();
}, 30000);

beforeEach(async () => {
  await Shift.destroy({ where: {}, force: true });
  await Payment.destroy({ where: {}, force: true });
  await SaleItem.destroy({ where: {}, force: true });
  await Sale.destroy({ where: {}, force: true });
  const p = await Product.findByPk(productId);
  if (p) await p.update({ stockQuantity: 100 });
});

const cashSale = async (token: string, qty: number, extra: any = {}) => {
  const res = await api.post(
    `${baseUrl}/sales`,
    { items: [{ productId, quantity: qty }], paymentMethod: 'cash', cashAmount: qty * 20 + 50, ...extra },
    { headers: { Authorization: `Bearer ${token}` } },
  );
  expect(res.status).toBe(201);
  return res.data.data;
};

describe('Phase 4: shifts', () => {
  it('opens a shift, rejects a second open shift, and attributes cash sales', async () => {
    const open = await api.post(`${baseUrl}/shifts`, { openingFloat: 500 }, { headers: { Authorization: `Bearer ${cashierToken}` } });
    expect(open.status).toBe(201);
    expect(parseFloat(open.data.data.openingFloat)).toBe(500);

    const double = await api.post(`${baseUrl}/shifts`, { openingFloat: 100 }, { headers: { Authorization: `Bearer ${cashierToken}` } });
    expect(double.status).toBe(409);

    await cashSale(cashierToken, 2); // total 40
    const mine = await api.get(`${baseUrl}/shifts/mine/open`, { headers: { Authorization: `Bearer ${cashierToken}` } });
    expect(mine.status).toBe(200);
    expect(parseFloat(mine.data.data.cashSalesTotal)).toBe(40);
    // Opening float 500 + 40 sales => expected till 540
    const close = await api.post(`${baseUrl}/shifts/close`, { countedCash: 545 }, { headers: { Authorization: `Bearer ${cashierToken}` } });
    expect(close.status).toBe(200);
    expect(close.data.data.status).toBe('closed');
    expect(parseFloat(close.data.data.expectedCash)).toBe(540);
    expect(parseFloat(close.data.data.cashDifference)).toBe(5);
  });

  it('requires a valid countedCash on close', async () => {
    await api.post(`${baseUrl}/shifts`, { openingFloat: 100 }, { headers: { Authorization: `Bearer ${cashierToken}` } });
    const bad = await api.post(`${baseUrl}/shifts/close`, { countedCash: -5 }, { headers: { Authorization: `Bearer ${cashierToken}` } });
    expect(bad.status).toBe(422);
    const missing = await api.post(`${baseUrl}/shifts/close`, {}, { headers: { Authorization: `Bearer ${cashierToken}` } });
    expect(missing.status).toBe(422);
  });
});

describe('Phase 4: refunds / voids', () => {
  it('rejects a refund without a reason (422)', async () => {
    const sale = await cashSale(cashierToken, 1);
    const res = await api.post(`${baseUrl}/sales/${sale.id}/refund`, {}, { headers: { Authorization: `Bearer ${cashierToken}` } });
    expect(res.status).toBe(422);
  });

  it('cashier voids own cash sale within 15 min (full), restocks, and blocks a second refund', async () => {
    const sale = await cashSale(cashierToken, 2); // total 40
    const before = await Product.findByPk(productId);
    const stockBefore = parseInt(before!.stockQuantity, 10);

    const res = await api.post(
      `${baseUrl}/sales/${sale.id}/refund`,
      { reason: 'Counter mistake — full void' },
      { headers: { Authorization: `Bearer ${cashierToken}` } },
    );
    expect(res.status).toBe(200);
    expect(res.data.data.fullyRefunded).toBe(true);
    expect(parseFloat(res.data.data.refundAmount)).toBe(40);

    const after = await Product.findByPk(productId);
    expect(parseInt(after!.stockQuantity, 10)).toBe(stockBefore + 2);

    const saleRow = await Sale.findByPk(sale.id);
    expect(saleRow!.status).toBe('refunded');
    expect(saleRow!.paymentStatus).toBe('refunded');
    expect(parseFloat(saleRow!.refundedAmount)).toBe(40);

    const again = await api.post(
      `${baseUrl}/sales/${sale.id}/refund`,
      { reason: 'double dip' },
      { headers: { Authorization: `Bearer ${cashierToken}` } },
    );
    expect(again.status).toBe(409);
  });

  it('admin partial refund marks the sale partially_refunded and restocks only the refunded lines', async () => {
    const sale = await cashSale(adminToken, 3); // total 60
    const item = await SaleItem.findOne({ where: { saleId: sale.id } });
    const res = await api.post(
      `${baseUrl}/sales/${sale.id}/refund`,
      { items: [{ saleItemId: item!.id, quantity: 2 }], reason: 'Customer returned 2 of 3' },
      { headers: { Authorization: `Bearer ${adminToken}` } },
    );
    expect(res.status).toBe(200);
    expect(res.data.data.fullyRefunded).toBe(false);
    expect(parseFloat(res.data.data.refundAmount)).toBe(40);

    const saleRow = await Sale.findByPk(sale.id);
    expect(saleRow!.status).toBe('completed');
    expect(saleRow!.paymentStatus).toBe('partially_refunded');
    expect(parseFloat(saleRow!.refundedAmount)).toBe(40);

    const itemRow = await SaleItem.findByPk(item!.id);
    expect(parseInt(itemRow!.refundedQuantity, 10)).toBe(2);

    // Refunding beyond the remaining quantity is rejected
    const over = await api.post(
      `${baseUrl}/sales/${sale.id}/refund`,
      { items: [{ saleItemId: item!.id, quantity: 2 }], reason: 'too many' },
      { headers: { Authorization: `Bearer ${adminToken}` } },
    );
    expect(over.status).toBe(409);
  });

  it('cashier cannot refund someone else\'s sale (403)', async () => {
    const sale = await cashSale(adminToken, 1);
    const res = await api.post(
      `${baseUrl}/sales/${sale.id}/refund`,
      { reason: 'not mine' },
      { headers: { Authorization: `Bearer ${cashierToken}` } },
    );
    expect(res.status).toBe(403);
  });

  it('cashier cannot void their own cash sale after 15 minutes (403)', async () => {
    const sale = await cashSale(cashierToken, 1);
    // Age the sale 20 minutes. The service treats the sale as "completed at"
    // max(createdAt, updatedAt), so both timestamps must be aged.
    const old = new Date(Date.now() - 20 * 60 * 1000);
    const oldStr = old.toISOString().replace('T', ' ').slice(0, 19);
    await sequelize.query('UPDATE sales SET created_at = ?, updated_at = ? WHERE id = ?', {
      replacements: [oldStr, oldStr, sale.id],
    });
    const res = await api.post(
      `${baseUrl}/sales/${sale.id}/refund`,
      { reason: 'too late' },
      { headers: { Authorization: `Bearer ${cashierToken}` } },
    );
    expect(res.status).toBe(403);
    // ...but the admin can still refund it.
    const ok = await api.post(
      `${baseUrl}/sales/${sale.id}/refund`,
      { reason: 'admin authorizes late void' },
      { headers: { Authorization: `Bearer ${adminToken}` } },
    );
    expect(ok.status).toBe(200);
  });

  it('refunds decrement the open shift\'s expected cash (voidedTotal)', async () => {
    await api.post(`${baseUrl}/shifts`, { openingFloat: 0 }, { headers: { Authorization: `Bearer ${cashierToken}` } });
    const sale = await cashSale(cashierToken, 2); // 40 in
    const mine1 = await api.get(`${baseUrl}/shifts/mine/open`, { headers: { Authorization: `Bearer ${cashierToken}` } });
    expect(parseFloat(mine1.data.data.cashSalesTotal)).toBe(40);

    await api.post(
      `${baseUrl}/sales/${sale.id}/refund`,
      { reason: 'voided at counter' },
      { headers: { Authorization: `Bearer ${cashierToken}` } },
    );
    const mine2 = await api.get(`${baseUrl}/shifts/mine/open`, { headers: { Authorization: `Bearer ${cashierToken}` } });
    expect(parseFloat(mine2.data.data.voidedTotal)).toBe(40);
  });
});

describe('Phase 4: split payments', () => {
  it('creates a split sale with per-leg payment rows and no change', async () => {
    const res = await api.post(
      `${baseUrl}/sales`,
      {
        items: [{ productId, quantity: 2 }], // total 40
        paymentMethod: 'split',
        payments: [
          { paymentMethod: 'cash', amount: 15 },
          { paymentMethod: 'gcash', amount: 25 },
        ],
      },
      { headers: { Authorization: `Bearer ${adminToken}` } },
    );
    expect(res.status).toBe(201);
    expect(res.data.data.paymentMethod).toBe('split');
    expect(res.data.data.cashAmount).toBe(15);
    expect(res.data.data.changeAmount).toBeNull();
    const legs = res.data.data.payments;
    expect(legs).toHaveLength(2);
    const sum = legs.reduce((s: number, p: any) => s + parseFloat(p.amount), 0);
    expect(sum).toBe(40);
  });

  it('rejects a split whose legs do not sum to the total (400)', async () => {
    const res = await api.post(
      `${baseUrl}/sales`,
      {
        items: [{ productId, quantity: 1 }], // total 20
        paymentMethod: 'split',
        payments: [
          { paymentMethod: 'cash', amount: 5 },
          { paymentMethod: 'gcash', amount: 5 },
        ],
      },
      { headers: { Authorization: `Bearer ${adminToken}` } },
    );
    expect(res.status).toBe(400);
  });

  it('rejects a split with fewer than two legs (422)', async () => {
    const res = await api.post(
      `${baseUrl}/sales`,
      {
        items: [{ productId, quantity: 1 }],
        paymentMethod: 'split',
        payments: [{ paymentMethod: 'cash', amount: 20 }],
      },
      { headers: { Authorization: `Bearer ${adminToken}` } },
    );
    expect(res.status).toBe(422);
  });
});

describe('Phase 4: receipt resend', () => {
  it('400s for a walk-in sale (no customer email)', async () => {
    const sale = await cashSale(cashierToken, 1);
    const res = await api.post(`${baseUrl}/sales/${sale.id}/email-receipt`, {}, { headers: { Authorization: `Bearer ${adminToken}` } });
    expect(res.status).toBe(400);
  });

  it('200s for a sale with a customer email (SMTP unconfigured still resolves)', async () => {
    const customer = await Customer.create({ firstName: 'Receipt', lastName: 'Test', email: 'receipt@test.com' });
    const sale = await cashSale(cashierToken, 1, { customerId: customer.id });
    const res = await api.post(`${baseUrl}/sales/${sale.id}/email-receipt`, {}, { headers: { Authorization: `Bearer ${adminToken}` } });
    expect(res.status).toBe(200);
    expect(res.data.data.to).toBe('receipt@test.com');
  });
});

describe('Phase 4: employee temp password', () => {
  it('approve issues a generated one-time password (not the old employee123) + mustChangePassword', async () => {
    const deptId = (beforeAll as any).__p4DeptId as number;
    const posId = (beforeAll as any).__p4PosId as number;
    const create = await api.post(
      `${baseUrl}/hrms/employees`,
      {
        firstName: 'Temp', lastName: 'Worker', email: 'temp-p4@example.com',
        hireDate: new Date().toISOString(), departmentId: deptId, positionId: posId, salary: 15000,
      },
      { headers: { Authorization: `Bearer ${adminToken}` } },
    );
    expect(create.status).toBe(201);
    const empId = create.data.data.id;

    const approve = await api.put(`${baseUrl}/hrms/employees/${empId}/approve`, {}, { headers: { Authorization: `Bearer ${adminToken}` } });
    expect(approve.status).toBe(200);
    const tempPassword: string | undefined = approve.data.data.tempPassword;
    expect(tempPassword).toBeTruthy();
    expect(tempPassword).not.toBe('employee123');

    const empUser = await User.findOne({ where: { email: 'temp-p4@example.com' } });
    expect(empUser!.mustChangePassword).toBe(true);
  });
});
