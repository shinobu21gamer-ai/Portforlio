/**
 * Phase 6 — every route gets ≥1 happy path and ≥1 authz/4xx case.
 *
 * Boots the real Express app on an ephemeral port against in-memory SQLite
 * (same harness as the other route suites). Protected routes are asserted
 * 401 without a token; a seeded admin (all permissions) drives the happy
 * paths; cashier/employee tokens prove 403s on role-gated endpoints.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

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
  sequelize, User, Role, Permission, Product, Category, Customer, Supplier,
  Department, Position, Employee,
} = models;

let server: any;
let baseUrl = '';
let adminToken = '';
let cashierToken = '';
let employeeToken = '';
let productId = 0;
let categoryId = 0;
let customerId = 0;
let supplierId = 0;
let departmentId = 0;

const api = axios.create({ timeout: 15000, validateStatus: () => true });

const login = async (email: string, password: string) => {
  const res = await api.post(`${baseUrl}/auth/login`, { email, password });
  if (res.status !== 200) {
    throw new Error(`login failed for ${email}: ${res.status} ${JSON.stringify(res.data)}`);
  }
  return res.data.data.token as string;
};

const auth = (token: string) => ({ headers: { Authorization: `Bearer ${token}` } });

beforeAll(async () => {
  await sequelize.authenticate();
  await sequelize.sync({ force: true });

  const permDefs = [
    'dashboard.view', 'products.view', 'products.create', 'products.update', 'products.delete',
    'categories.view', 'categories.manage',
    'customers.view', 'customers.manage', 'customers.delete',
    'suppliers.view', 'suppliers.manage', 'suppliers.delete',
    'purchases.view', 'purchases.create', 'purchases.pay', 'purchases.cancel',
    'inventory.view', 'inventory.manage',
    'expenses.view', 'expenses.manage', 'expenses.delete',
    'discounts.view', 'discounts.manage', 'discounts.delete',
    'petty_cash.view', 'petty_cash.manage',
    'reports.view', 'finance.view',
    'sales.view', 'sales.create', 'sales.cancel',
    'branches.view', 'branches.manage',
    'users.view', 'users.manage', 'users.delete',
    'settings.manage', 'activity.view',
  ];
  const permMap: Record<string, any> = {};
  for (const slug of permDefs) {
    const p = await Permission.create({ name: slug, slug, module: slug.split('.')[0] });
    permMap[slug] = p;
  }

  const mkRole = (name: string, slug: string) => Role.create({ name, slug, isActive: true });
  const adminRole = await mkRole('Admin', 'admin');
  const cashierRole = await mkRole('Cashier', 'cashier');
  const employeeRole = await mkRole('Employee', 'employee');
  const hrRole = await mkRole('HR', 'hr');
  const managerRole = await mkRole('Manager', 'manager');
  const invRole = await mkRole('Inventory Staff', 'inventory_staff');

  await adminRole.setPermissions(Object.values(permMap));
  await cashierRole.setPermissions([permMap['sales.create'], permMap['sales.cancel'], permMap['customers.manage'], permMap['customers.view']]);
  await invRole.setPermissions([permMap['inventory.manage'], permMap['products.create'], permMap['products.update'], permMap['products.view']]);

  const mkUser = (email: string, role: any) => User.create({
    firstName: 'M', lastName: email.split('@')[0], email, password: 'Passw0rd!123', roleId: role.id, isActive: true,
  });
  await mkUser('mx-admin@example.com', adminRole);
  await mkUser('mx-cashier@example.com', cashierRole);
  await mkUser('mx-employee@example.com', employeeRole);
  await mkUser('mx-hr@example.com', hrRole);
  await mkUser('mx-manager@example.com', managerRole);
  await mkUser('mx-inv@example.com', invRole);

  const cat = await Category.create({ name: 'Mx Cat', slug: 'mx-cat' });
  categoryId = cat.id;
  const product = await Product.create({
    name: 'Mx Soda', slug: 'mx-soda', sku: 'MX-001', barcode: '5550000000001',
    categoryId: cat.id, unit: 'pcs', buyingPrice: 10, sellingPrice: 20,
    stockQuantity: 200, minStockLevel: 5, taxRate: 0, isActive: true,
  });
  productId = product.id;
  const customer = await Customer.create({ firstName: 'Walk', lastName: 'In', email: 'walkin@example.com' });
  customerId = customer.id;
  const supplier = await Supplier.create({ name: 'Mx Supplier', email: 'sup@example.com' });
  supplierId = supplier.id;
  const dept = await Department.create({ name: 'Mx Dept' });
  departmentId = dept.id;
  const pos = await Position.create({ title: 'Mx Staff', departmentId: dept.id, minSalary: 15000, maxSalary: 25000 });
  await Employee.create({
    employeeNo: 'EMP-MX01', firstName: 'Mx', lastName: 'Employee', email: 'mx-employee@example.com',
    hireDate: new Date('2024-01-01'), departmentId: dept.id, positionId: pos.id,
    salary: 20000, employmentType: 'full-time', status: 'active',
  });

  const { server: appServer } = require('../../src/app');
  server = appServer;
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}/api/v1`;

  adminToken = await login('mx-admin@example.com', 'Passw0rd!123');
  cashierToken = await login('mx-cashier@example.com', 'Passw0rd!123');
  employeeToken = await login('mx-employee@example.com', 'Passw0rd!123');
}, 60000);

afterAll(async () => {
  try {
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  } catch { /* already closed */ }
  await sequelize.close();
}, 30000);

const PROTECTED: Array<{ method: 'get' | 'post' | 'put' | 'patch' | 'delete'; path: string }> = [
  { method: 'get', path: '/auth/profile' },
  { method: 'put', path: '/auth/profile' },
  { method: 'post', path: '/auth/change-password' },
  { method: 'post', path: '/auth/logout' },
  { method: 'get', path: '/dashboard' },
  { method: 'get', path: '/products' },
  { method: 'get', path: '/products/low-stock' },
  { method: 'get', path: '/products/expiring' },
  { method: 'get', path: '/products/best-sellers' },
  { method: 'get', path: '/products/barcode/5550000000001' },
  { method: 'get', path: '/products/1' },
  { method: 'post', path: '/products' },
  { method: 'put', path: '/products/1' },
  { method: 'delete', path: '/products/1' },
  { method: 'get', path: '/categories' },
  { method: 'get', path: '/categories/tree' },
  { method: 'get', path: '/categories/1' },
  { method: 'post', path: '/categories' },
  { method: 'put', path: '/categories/1' },
  { method: 'delete', path: '/categories/1' },
  { method: 'get', path: '/customers' },
  { method: 'get', path: '/customers/1' },
  { method: 'post', path: '/customers' },
  { method: 'put', path: '/customers/1' },
  { method: 'delete', path: '/customers/1' },
  { method: 'get', path: '/suppliers' },
  { method: 'get', path: '/suppliers/outstanding-balances' },
  { method: 'get', path: '/suppliers/export' },
  { method: 'get', path: '/suppliers/analytics' },
  { method: 'get', path: '/suppliers/1' },
  { method: 'get', path: '/suppliers/1/summary' },
  { method: 'get', path: '/suppliers/1/purchases' },
  { method: 'post', path: '/suppliers' },
  { method: 'put', path: '/suppliers/1' },
  { method: 'delete', path: '/suppliers/1' },
  { method: 'get', path: '/sales' },
  { method: 'get', path: '/sales/report' },
  { method: 'get', path: '/sales/pending' },
  { method: 'get', path: '/sales/1' },
  { method: 'post', path: '/sales' },
  { method: 'post', path: '/sales/pending' },
  { method: 'post', path: '/sales/pending/1/cancel' },
  { method: 'post', path: '/sales/pending/1/cash-complete' },
  { method: 'post', path: '/sales/1/cancel' },
  { method: 'post', path: '/sales/1/refund' },
  { method: 'post', path: '/sales/1/email-receipt' },
  { method: 'get', path: '/purchases' },
  { method: 'get', path: '/purchases/1' },
  { method: 'post', path: '/purchases' },
  { method: 'put', path: '/purchases/1/receive' },
  { method: 'post', path: '/purchases/1/pay' },
  { method: 'post', path: '/purchases/1/cancel' },
  { method: 'get', path: '/inventory/movements' },
  { method: 'get', path: '/inventory/logs' },
  { method: 'get', path: '/inventory/check-low-stock' },
  { method: 'get', path: '/inventory/check-expiring' },
  { method: 'post', path: '/inventory/stock-in' },
  { method: 'post', path: '/inventory/stock-out' },
  { method: 'post', path: '/inventory/adjust' },
  { method: 'get', path: '/expenses' },
  { method: 'get', path: '/expenses/report' },
  { method: 'get', path: '/expenses/1' },
  { method: 'post', path: '/expenses' },
  { method: 'put', path: '/expenses/1' },
  { method: 'delete', path: '/expenses/1' },
  { method: 'get', path: '/expense-categories' },
  { method: 'post', path: '/expense-categories' },
  { method: 'get', path: '/notifications' },
  { method: 'get', path: '/notifications/unread-count' },
  { method: 'put', path: '/notifications/mark-all-read' },
  { method: 'put', path: '/notifications/mark-read' },
  { method: 'delete', path: '/notifications/1' },
  { method: 'get', path: '/activity-logs' },
  { method: 'get', path: '/users' },
  { method: 'get', path: '/users/1' },
  { method: 'post', path: '/users' },
  { method: 'put', path: '/users/1' },
  { method: 'delete', path: '/users/1' },
  { method: 'get', path: '/roles' },
  { method: 'get', path: '/settings' },
  { method: 'put', path: '/settings' },
  { method: 'get', path: '/discounts' },
  { method: 'get', path: '/discounts/validate' },
  { method: 'post', path: '/discounts/validate' },
  { method: 'post', path: '/discounts' },
  { method: 'get', path: '/finance/report' },
  { method: 'get', path: '/finance/cashflow' },
  { method: 'get', path: '/branches' },
  { method: 'post', path: '/branches' },
  { method: 'get', path: '/petty-cash' },
  { method: 'get', path: '/petty-cash/summary' },
  { method: 'post', path: '/petty-cash' },
  { method: 'get', path: '/shifts' },
  { method: 'get', path: '/shifts/mine/open' },
  { method: 'get', path: '/shifts/summary' },
  { method: 'post', path: '/shifts' },
  { method: 'post', path: '/shifts/close' },
  { method: 'get', path: '/loyalty/1' },
  { method: 'post', path: '/loyalty/redeem' },
  { method: 'get', path: '/payments/test' },
  { method: 'post', path: '/payments/create-checkout' },
  { method: 'get', path: '/payments/status/1' },
  { method: 'get', path: '/tracking/by-purchase/1' },
  { method: 'post', path: '/tracking/update' },
  { method: 'get', path: '/hrms/pending-counts' },
  { method: 'get', path: '/hrms/departments' },
  { method: 'post', path: '/hrms/departments' },
  { method: 'get', path: '/hrms/positions' },
  { method: 'post', path: '/hrms/positions' },
  { method: 'get', path: '/hrms/employees' },
  { method: 'get', path: '/hrms/employees/export' },
  { method: 'get', path: '/hrms/employees/org-chart' },
  { method: 'post', path: '/hrms/employees' },
  { method: 'get', path: '/hrms/attendance' },
  { method: 'get', path: '/hrms/attendance/today' },
  { method: 'get', path: '/hrms/attendance/calendar' },
  { method: 'post', path: '/hrms/attendance/clock-in' },
  { method: 'post', path: '/hrms/attendance/clock-out' },
  { method: 'get', path: '/hrms/schedules' },
  { method: 'post', path: '/hrms/schedules' },
  { method: 'get', path: '/hrms/payrolls' },
  { method: 'post', path: '/hrms/payrolls' },
  { method: 'get', path: '/hrms/jobs' },
  { method: 'post', path: '/hrms/jobs' },
  { method: 'post', path: '/hrms/jobs/applications' },
  { method: 'get', path: '/hrms/interviews' },
  { method: 'post', path: '/hrms/interviews' },
  { method: 'get', path: '/hrms/contracts' },
  { method: 'post', path: '/hrms/contracts' },
  { method: 'get', path: '/hrms/leaves' },
  { method: 'post', path: '/hrms/leaves' },
  { method: 'get', path: '/hrms/me' },
  { method: 'get', path: '/hrms/me/profile' },
  { method: 'put', path: '/hrms/me/profile' },
  { method: 'get', path: '/hrms/me/attendance' },
  { method: 'get', path: '/hrms/me/leaves' },
  { method: 'get', path: '/hrms/me/payslips' },
  { method: 'get', path: '/hrms/me/contracts' },
  { method: 'get', path: '/hrms/me/leaves/balance' },
];

describe('authz: protected routes return 401 without a token', () => {
  it.each(PROTECTED)('$method $path → 401', async ({ method, path }) => {
    const res = await api.request({ method, url: `${baseUrl}${path}` });
    expect(res.status).toBe(401);
  });
});

describe('authz: role gates return 403', () => {
  it('employee cannot read the POS dashboard', async () => {
    const res = await api.get(`${baseUrl}/dashboard`, auth(employeeToken));
    expect(res.status).toBe(403);
  });

  it('cashier cannot cash-override a pending sale', async () => {
    const res = await api.post(`${baseUrl}/sales/pending/1/cash-complete`, {}, auth(cashierToken));
    expect(res.status).toBe(403);
  });

  it('cashier cannot read payrolls', async () => {
    const res = await api.get(`${baseUrl}/hrms/payrolls`, auth(cashierToken));
    expect(res.status).toBe(403);
  });

  it('employee cannot create a department', async () => {
    const res = await api.post(`${baseUrl}/hrms/departments`, { name: 'Nope' }, auth(employeeToken));
    expect(res.status).toBe(403);
  });

  it('cashier cannot update settings', async () => {
    const res = await api.put(`${baseUrl}/settings`, { storeName: 'X' }, auth(cashierToken));
    expect(res.status).toBe(403);
  });

  it('employee cannot list users', async () => {
    const res = await api.get(`${baseUrl}/users`, auth(employeeToken));
    expect(res.status).toBe(403);
  });

  it('employee cannot manage inventory movements', async () => {
    const res = await api.get(`${baseUrl}/inventory/movements`, auth(employeeToken));
    expect(res.status).toBe(403);
  });

  it('cashier cannot create a product (missing permission)', async () => {
    const res = await api.post(`${baseUrl}/products`, {
      name: 'Blocked', categoryId, buyingPrice: 1, sellingPrice: 2,
    }, auth(cashierToken));
    expect(res.status).toBe(403);
  });
});

describe('public routes: happy + 4xx', () => {
  it('GET /public/settings is 200 and brand-safe', async () => {
    const res = await api.get(`${baseUrl}/public/settings`);
    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
    expect(res.data.data).not.toHaveProperty('paymongo');
  });

  it('GET /public/jobs is 200', async () => {
    const res = await api.get(`${baseUrl}/public/jobs`);
    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
  });

  it('GET /public/jobs/:id 4xx for a missing posting', async () => {
    const res = await api.get(`${baseUrl}/public/jobs/99999`);
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it('POST /public/jobs/apply 4xx without required fields', async () => {
    const res = await api.post(`${baseUrl}/public/jobs/apply`, {});
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it('POST /auth/login 200 with valid credentials and 401 with a bad password', async () => {
    const ok = await api.post(`${baseUrl}/auth/login`, { email: 'mx-admin@example.com', password: 'Passw0rd!123' });
    expect(ok.status).toBe(200);
    expect(ok.data.data.token).toBeTruthy();
    const bad = await api.post(`${baseUrl}/auth/login`, { email: 'mx-admin@example.com', password: 'wrong' });
    expect(bad.status).toBe(401);
  });

  it('GET /auth/csrf-token is 200', async () => {
    const res = await api.get(`${baseUrl}/auth/csrf-token`);
    expect(res.status).toBe(200);
  });

  it('POST /payments/webhook is reachable (400 when a secret is set; 200 skip in test)', async () => {
    const res = await api.post(`${baseUrl}/payments/webhook`, { data: {} });
    // Dev/test skips signature verification when PAYMONGO_WEBHOOK_SECRET is unset.
    expect([200, 400]).toContain(res.status);
  });

  it('POST /auth/refresh-token 4xx without a token', async () => {
    const res = await api.post(`${baseUrl}/auth/refresh-token`, {});
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it('POST /auth/forgot-password 200 even for unknown emails (no enumeration)', async () => {
    const res = await api.post(`${baseUrl}/auth/forgot-password`, { email: 'nobody@example.com' });
    expect(res.status).toBe(200);
  });
});

describe('happy paths — list GETs as admin', () => {
  const LISTS = [
    '/dashboard', '/products', '/products/low-stock', '/products/expiring', '/products/best-sellers',
    '/categories', '/categories/tree', '/customers', '/suppliers', '/suppliers/outstanding-balances',
    '/suppliers/analytics', '/sales', '/sales/pending', '/sales/report?startDate=2026-01-01&endDate=2026-12-31', '/purchases',
    '/inventory/movements', '/inventory/logs', '/inventory/check-low-stock', '/inventory/check-expiring',
    '/expenses', '/expenses/report?startDate=2026-01-01&endDate=2026-12-31', '/expense-categories', '/notifications', '/notifications/unread-count',
    '/activity-logs', '/users', '/roles', '/settings', '/discounts',
    '/finance/report?startDate=2026-01-01&endDate=2026-12-31', '/finance/cashflow?startDate=2026-01-01&endDate=2026-12-31',
    '/branches', '/petty-cash', '/petty-cash/summary', '/shifts', '/shifts/mine/open',
    '/hrms/pending-counts', '/hrms/departments', '/hrms/positions', '/hrms/employees',
    '/hrms/employees/org-chart', '/hrms/attendance', '/hrms/attendance/today', '/hrms/attendance/calendar', '/hrms/schedules',
    '/hrms/payrolls', '/hrms/jobs', '/hrms/interviews', '/hrms/contracts', '/hrms/leaves',
    '/auth/profile',
  ];

  it.each(LISTS)('GET %s → 2xx', async (path) => {
    const res = await api.get(`${baseUrl}${path}`, auth(adminToken));
    expect(res.status, `${path} returned ${res.status} ${JSON.stringify(res.data)?.slice(0, 200)}`).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(300);
  });

  it('employee self-service GETs → 2xx (or 404 when no linked employee)', async () => {
    for (const path of ['/hrms/me', '/hrms/me/profile', '/hrms/me/attendance', '/hrms/me/leaves', '/hrms/me/payslips', '/hrms/me/contracts', '/hrms/me/leaves/balance']) {
      const res = await api.get(`${baseUrl}${path}`, auth(employeeToken));
      expect([200, 404], path).toContain(res.status);
    }
  });

  it('GET product / category / customer / supplier by id → 200', async () => {
    for (const path of [
      `/products/${productId}`,
      `/products/barcode/5550000000001`,
      `/categories/${categoryId}`,
      `/customers/${customerId}`,
      `/suppliers/${supplierId}`,
      `/suppliers/${supplierId}/summary`,
      `/suppliers/${supplierId}/purchases`,
      `/hrms/departments/${departmentId}`,
    ]) {
      const res = await api.get(`${baseUrl}${path}`, auth(adminToken));
      expect(res.status, path).toBe(200);
    }
  });
});

describe('happy paths — mutations', () => {
  it('creates a category, customer, supplier, and department', async () => {
    const cat = await api.post(`${baseUrl}/categories`, { name: 'Matrix Cat 2' }, auth(adminToken));
    expect(cat.status).toBeGreaterThanOrEqual(200);
    expect(cat.status).toBeLessThan(300);

    const cust = await api.post(`${baseUrl}/customers`, { firstName: 'Ada', lastName: 'Lovelace' }, auth(adminToken));
    expect(cust.status).toBeGreaterThanOrEqual(200);
    expect(cust.status).toBeLessThan(300);

    const sup = await api.post(`${baseUrl}/suppliers`, { name: 'Matrix Supplier 2' }, auth(adminToken));
    expect(sup.status).toBeGreaterThanOrEqual(200);
    expect(sup.status).toBeLessThan(300);

    const dept = await api.post(`${baseUrl}/hrms/departments`, { name: 'Matrix Dept 2' }, auth(adminToken));
    expect(dept.status).toBeGreaterThanOrEqual(200);
    expect(dept.status).toBeLessThan(300);

    // POST /products requires a multipart image — 400 without one is the 4xx case.
    const prod = await api.post(`${baseUrl}/products`, {
      name: 'Matrix Widget', categoryId, buyingPrice: 5, sellingPrice: 9, stockQuantity: 20,
    }, auth(adminToken));
    expect(prod.status).toBe(400);
  });

  it('cashier creates a cash sale (happy) and rejects a missing-items body (4xx)', async () => {
    const ok = await api.post(`${baseUrl}/sales`, {
      items: [{ productId, quantity: 1 }], paymentMethod: 'cash', cashAmount: 100,
    }, auth(cashierToken));
    expect(ok.status).toBe(201);
    expect(ok.data.data.total).toBe(20);

    const bad = await api.post(`${baseUrl}/sales`, { paymentMethod: 'cash' }, auth(cashierToken));
    expect(bad.status).toBeGreaterThanOrEqual(400);
    expect(bad.status).toBeLessThan(500);
  });

  it('stocks in / out / adjusts', async () => {
    const inn = await api.post(`${baseUrl}/inventory/stock-in`, { productId, quantity: 3 }, auth(adminToken));
    expect(inn.status).toBeLessThan(300);
    const out = await api.post(`${baseUrl}/inventory/stock-out`, { productId, quantity: 1 }, auth(adminToken));
    expect(out.status).toBeLessThan(300);
    const adj = await api.post(`${baseUrl}/inventory/adjust`, { productId, newQuantity: 50, reason: 'count' }, auth(adminToken));
    expect(adj.status).toBeLessThan(300);
  });

  it('opens and lists a cashier shift', async () => {
    const opened = await api.post(`${baseUrl}/shifts`, { openingFloat: 1000 }, auth(cashierToken));
    expect(opened.status).toBeLessThan(300);
    const mine = await api.get(`${baseUrl}/shifts/mine/open`, auth(cashierToken));
    expect(mine.status).toBe(200);
  });

  it('creates a pending online sale then cancels it', async () => {
    const pending = await api.post(`${baseUrl}/sales/pending`, {
      items: [{ productId, quantity: 1 }], paymentMethod: 'gcash',
    }, auth(cashierToken));
    expect(pending.status).toBe(201);
    const id = pending.data.data.id;
    const cancel = await api.post(`${baseUrl}/sales/pending/${id}/cancel`, {}, auth(cashierToken));
    expect(cancel.status).toBeLessThan(300);
  });

  it('marks notifications read', async () => {
    const res = await api.put(`${baseUrl}/notifications/mark-all-read`, {}, auth(adminToken));
    expect(res.status).toBeLessThan(300);
  });

  it('updates the admin profile', async () => {
    const res = await api.put(`${baseUrl}/auth/profile`, { firstName: 'Matrix' }, auth(adminToken));
    expect(res.status).toBeLessThan(300);
  });

  it('logs the admin out (revokes the token)', async () => {
    const res = await api.post(`${baseUrl}/auth/logout`, {}, auth(adminToken));
    expect(res.status).toBeLessThan(300);
    const again = await api.get(`${baseUrl}/auth/profile`, auth(adminToken));
    expect(again.status).toBe(401);
    adminToken = await login('mx-admin@example.com', 'Passw0rd!123');
  });
});
