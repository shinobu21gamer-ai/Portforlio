/**
 * Regression tests for the full-system review (Oct 2026).
 *
 * Every case below pins a bug that the audit found in a live path none of the
 * existing suites covered: raw `col()` names in a shift aggregate, a mis-destructured
 * pagination helper, sort params a service silently ignored, the settings keys the
 * UI writes vs the ones the public payload reads, the forced first-login password
 * change, leave filed on behalf of an employee, geofenced clock-in from HR, and the
 * payslip maths that produced a negative net pay.
 *
 * Same harness as phase4.routes.integration.test.ts — the real app on an ephemeral
 * port against in-memory SQLite, so route + Joi + service + model all run together.
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
// Keep the settings singleton off the repo's data/ file.
process.env.SETTINGS_FILE = '/tmp/audit-fixes-settings.json';

import axios from 'axios';
import fs from 'fs';

const models = require('../../src/models');
const {
  sequelize, User, Role, Permission, Category, Product, Customer, Branch, Shift,
  Department, Employee, Attendance, LeaveRequest,
} = models;

let server: any;
let baseUrl = '';
let adminToken = '';
let employeeToken = '';
let ownEmployeeId = 0;
let otherEmployeeId = 0;
let branchId = 0;

const api = axios.create({ timeout: 10000, validateStatus: () => true });
const auth = (token: string) => ({ headers: { Authorization: `Bearer ${token}` } });
const PASSWORD = 'Passw0rd!123';

const login = async (email: string) => {
  const res = await api.post(`${baseUrl}/auth/login`, { email, password: PASSWORD });
  expect(res.status).toBe(200);
  return res.data.data.token as string;
};

beforeAll(async () => {
  fs.rmSync('/tmp/audit-fixes-settings.json', { force: true });
  await sequelize.authenticate();
  await sequelize.sync({ force: true });

  const adminRole = await Role.create({ name: 'Admin', slug: 'admin', isActive: true });
  // Branch writes are permission-gated, and the fence lives on the branch.
  const branchPerm = await Permission.create({ name: 'Manage Branches', slug: 'branches.manage', module: 'branches' });
  await adminRole.addPermission(branchPerm);
  const empRole = await Role.create({ name: 'Employee', slug: 'employee', isActive: true });

  await User.create({ firstName: 'Audit', lastName: 'Admin', email: 'af-admin@example.com', password: PASSWORD, roleId: adminRole.id, isActive: true });
  const empUser = await User.create({ firstName: 'Audit', lastName: 'Worker', email: 'af-emp@example.com', password: PASSWORD, roleId: empRole.id, isActive: true });

  const dept = await Department.create({ name: 'Audit Ops', description: 'test' });
  const own = await Employee.create({
    employeeNo: 'AF-001', firstName: 'Audit', lastName: 'Worker', email: 'af-emp@example.com',
    hireDate: '2024-01-01', salary: 20000, employmentType: 'full-time', paymentFrequency: 'monthly',
    status: 'active', departmentId: dept.id, userId: empUser.id,
  });
  ownEmployeeId = own.id;
  const other = await Employee.create({
    employeeNo: 'AF-002', firstName: 'Other', lastName: 'Worker', email: 'af-other@example.com',
    hireDate: '2024-01-01', salary: 30000, employmentType: 'full-time', paymentFrequency: 'monthly',
    status: 'active', departmentId: dept.id,
  });
  otherEmployeeId = other.id;

  for (const name of ['Alpha', 'Beta', 'Gamma']) {
    await Category.create({ name, slug: name.toLowerCase() });
  }

  const cat = await Category.findOne({ where: { slug: 'alpha' } });
  const expiry = [
    ['AF Exp C', 30, '2026-12-31', 100],
    ['AF Exp A', 10, '2026-10-31', 300],
    ['AF Exp B', 20, '2026-11-30', 200],
  ] as const;
  for (const [name, stock, expiryDate, buyingPrice] of expiry) {
    await Product.create({
      name, slug: name.toLowerCase().replace(/ /g, '-'), sku: `AF-${name}`,
      categoryId: cat.id, unit: 'pcs', buyingPrice, sellingPrice: buyingPrice * 2,
      stockQuantity: stock, minStockLevel: 1, taxRate: 0, isActive: true, expiryDate,
    });
  }

  await Customer.create({ firstName: 'Loyal', lastName: 'One', email: 'af-c1@example.com', loyaltyPoints: 5 });
  await Customer.create({ firstName: 'Loyal', lastName: 'Two', email: 'af-c2@example.com', loyaltyPoints: 90 });
  await Customer.create({ firstName: 'Loyal', lastName: 'Three', email: 'af-c3@example.com', loyaltyPoints: 40 });

  const branch = await Branch.create({ name: 'AF Branch', code: 'AFB', city: 'Taguig', address: 'Test', phone: '09170000000' });
  branchId = branch.id;
  // Geofencing resolves the caller's branch through User.branchId.
  await empUser.update({ branchId: branch.id });

  const { server: appServer } = require('../../src/app');
  server = appServer;
  await new Promise<void>((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`;

  adminToken = await login('af-admin@example.com');
  employeeToken = await login('af-emp@example.com');
}, 90000);

afterAll(async () => {
  try {
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  } catch { /* already closed */ }
  fs.rmSync('/tmp/audit-fixes-settings.json', { force: true });
  await sequelize.close();
}, 30000);

describe('review fix: shift aggregates and shift list pagination', () => {
  it('GET /shifts/summary answers with numbers instead of a 500', async () => {
    const opened = await api.post(`${baseUrl}/shifts`, { openingFloat: 500 }, auth(adminToken));
    expect(opened.status).toBe(201);
    const closed = await api.post(`${baseUrl}/shifts/close`, { countedCash: 700 }, auth(adminToken));
    expect(closed.status).toBe(200);

    const summary = await api.get(`${baseUrl}/shifts/summary`, auth(adminToken));
    expect(summary.status).toBe(200);
    expect(typeof summary.data.data.cashSales).toBe('number');
    expect(typeof summary.data.data.difference).toBe('number');
    expect(summary.data.data.closedShifts).toBeGreaterThanOrEqual(1);
  });

  it('GET /shifts honours page and limit and reports a real totalPages', async () => {
    for (const day of ['2026-09-01', '2026-09-02', '2026-09-03']) {
      await Shift.create({
        userId: 1, status: 'closed', openedAt: new Date(`${day}T08:00:00`),
        closedAt: new Date(`${day}T17:00:00`), openingFloat: 0, cashSalesTotal: 0,
        expectedCash: 0, countedCash: 0, cashDifference: 0,
      });
    }
    const res = await api.get(`${baseUrl}/shifts?page=2&limit=1`, auth(adminToken));
    expect(res.status).toBe(200);
    // The endpoint answers with { rows, meta }.
    const meta = res.data.data.meta;
    expect(meta.page).toBe(2);
    expect(meta.limit).toBe(1);
    expect(res.data.data.rows).toHaveLength(1);
    expect(meta.totalPages).toBeGreaterThan(1);
    expect(meta.totalItems).toBeGreaterThanOrEqual(2);
  });
});

describe('review fix: category list sorting', () => {
  it('honours sortBy/sortOrder instead of pinning name ASC', async () => {
    const desc = await api.get(`${baseUrl}/categories?limit=100&sortBy=name&sortOrder=DESC`, auth(adminToken));
    expect(desc.data.data.categories.map((c: any) => c.name)).toEqual(['Gamma', 'Beta', 'Alpha']);

    const bySlug = await api.get(`${baseUrl}/categories?limit=100&sortBy=slug&sortOrder=ASC`, auth(adminToken));
    expect(bySlug.data.data.categories.map((c: any) => c.slug)).toEqual(['alpha', 'beta', 'gamma']);
  });
});

describe('review fix: list screens that need every row', () => {
  it('returns all categories when the screen asks for them', async () => {
    const all = await api.get(`${baseUrl}/categories?limit=100`, auth(adminToken));
    expect(all.data.data.categories).toHaveLength(3);
    expect(all.data.data.pagination.totalItems).toBe(3);
  });
});

describe('review fix: sort keys offered by the tables', () => {
  it('sorts products by expiryDate and buyingPrice', async () => {
    const byExpiry = await api.get(`${baseUrl}/products?limit=10&sortBy=expiryDate&sortOrder=ASC`, auth(adminToken));
    expect(byExpiry.data.data.products.map((p: any) => p.expiryDate?.slice(0, 10))).toEqual([
      '2026-10-31', '2026-11-30', '2026-12-31',
    ]);

    const byCost = await api.get(`${baseUrl}/products?limit=10&sortBy=buyingPrice&sortOrder=DESC`, auth(adminToken));
    expect(byCost.data.data.products.map((p: any) => Number(p.buyingPrice))).toEqual([300, 200, 100]);
  });

  it('sorts customers by loyaltyPoints', async () => {
    const res = await api.get(`${baseUrl}/customers?limit=10&sortBy=loyaltyPoints&sortOrder=DESC`, auth(adminToken));
    expect(res.data.data.customers.map((c: any) => c.loyaltyPoints)).toEqual([90, 40, 5]);
  });
});

describe('review fix: settings keys the UI can actually reach', () => {
  it('mirrors the legacy store* aliases onto the keys the public payload reads', async () => {
    const put = await api.put(`${baseUrl}/settings`, {
      storeEmail: 'hello@audit.ph', storeAddress: 'Audit Street 1', storePhone: '09170000000', receiptHeader: 'Served with pride',
    }, auth(adminToken));
    expect(put.status).toBe(200);

    const pub = await api.get(`${baseUrl}/public/settings`);
    expect(pub.status).toBe(200);
    expect(pub.data.data.email).toBe('hello@audit.ph');
    expect(pub.data.data.address).toBe('Audit Street 1');
    expect(pub.data.data.phone).toBe('09170000000');

    const full = await api.get(`${baseUrl}/settings`, auth(adminToken));
    expect(full.data.data.receiptHeader).toBe('Served with pride');

    // A canonical write still wins over a stale alias.
    await api.put(`${baseUrl}/settings`, { email: 'next@audit.ph' }, auth(adminToken));
    const again = await api.get(`${baseUrl}/public/settings`);
    expect(again.data.data.email).toBe('next@audit.ph');
  });
});

describe('review fix: password change is a real change', () => {
  it('rejects re-using the current password', async () => {
    // A throwaway account: changing a password invalidates every token issued
    // before it, so the shared admin token must stay untouched.
    const role = await Role.findOne({ where: { slug: 'admin' } });
    await User.create({ firstName: 'Rotate', lastName: 'Me', email: 'af-rotate@example.com', password: PASSWORD, roleId: role.id, isActive: true, mustChangePassword: true });
    const token = await login('af-rotate@example.com');

    const same = await api.post(`${baseUrl}/auth/change-password`, { currentPassword: PASSWORD, newPassword: PASSWORD }, auth(token));
    expect(same.status).toBe(400);
    expect(same.data.message).toMatch(/different/i);

    // A real change goes through and clears the forced-change flag.
    const rotated = await api.post(`${baseUrl}/auth/change-password`, { currentPassword: PASSWORD, newPassword: 'Rotated!Pass456' }, auth(token));
    expect(rotated.status).toBe(200);
    // A real change clears the forced-change flag and the new password works.
    const relogin = await api.post(`${baseUrl}/auth/login`, { email: 'af-rotate@example.com', password: 'Rotated!Pass456' });
    expect(relogin.status).toBe(200);
    expect(relogin.data.data.user.mustChangePassword).toBe(false);
    const stale = await api.post(`${baseUrl}/auth/login`, { email: 'af-rotate@example.com', password: PASSWORD });
    expect(stale.status).toBe(401);
  });
});

describe('review fix: leave on behalf of an employee', () => {
  it('lets HR/admin file for a chosen employee', async () => {
    const res = await api.post(`${baseUrl}/hrms/leaves`, {
      employeeId: otherEmployeeId, leaveType: 'personal', startDate: '2026-12-08', endDate: '2026-12-09', reason: 'Filed by HR',
    }, auth(adminToken));
    expect(res.status).toBe(201);
    expect(res.data.data.employeeId).toBe(otherEmployeeId);
    await LeaveRequest.destroy({ where: { id: res.data.data.id }, force: true });
  });

  it('keeps the self-service path pinned to the caller', async () => {
    const res = await api.post(`${baseUrl}/hrms/leaves`, {
      employeeId: otherEmployeeId, leaveType: 'sick', startDate: '2026-12-10', endDate: '2026-12-10', reason: 'Should be mine only',
    }, auth(employeeToken));
    expect(res.status).toBe(201);
    expect(res.data.data.employeeId).toBe(ownEmployeeId);
    await LeaveRequest.destroy({ where: { id: res.data.data.id }, force: true });
  });
});

describe('review fix: geofenced branches', () => {
  const setFence = async (on: boolean) => {
    const res = await api.put(`${baseUrl}/branches/${branchId}`, {
      name: 'AF Branch',
      enforceGeofence: on, latitude: on ? 14.55 : null, longitude: on ? 121.05 : null, geofenceRadiusMeters: on ? 200 : null,
    }, auth(adminToken));
    expect(res.status).toBe(200);
  };

  it('still demands a location from the employee, but not from an HR-entered clock-in', async () => {
    await setFence(true);
    await Attendance.destroy({ where: { employeeId: ownEmployeeId }, force: true });

    const self = await api.post(`${baseUrl}/hrms/attendance/clock-in`, {}, auth(employeeToken));
    expect(self.status).toBe(400);
    expect(self.data.message).toMatch(/requires location/i);

    // HR clocking someone in is done from their own desk, so the fence cannot
    // apply — used to fail the whole batch with the message above.
    const bulk = await api.post(`${baseUrl}/hrms/attendance/bulk-clock-in`, { employeeIds: [ownEmployeeId] }, auth(adminToken));
    expect(bulk.status).toBe(200);
    expect(bulk.data.data.succeeded).toEqual([ownEmployeeId]);

    const record = await Attendance.findOne({ where: { employeeId: ownEmployeeId } });
    expect(record).not.toBeNull();
    expect(record.isGeofenceVerified).toBe(false);
    expect(record.notes).toMatch(/geofence not verified/i);

    await setFence(false);
    await Attendance.destroy({ where: { employeeId: ownEmployeeId }, force: true });
  });
});

describe('review fix: payslip totals', () => {
  const preview = async (body: any) => {
    const res = await api.post(`${baseUrl}/hrms/payrolls/preview`, body, auth(adminToken));
    expect(res.status).toBe(200);
    return res.data.data;
  };
  const workDays = async (employeeId: number, from = 1, to = 31) => {
    for (let day = from; day <= to; day++) {
      const date = `2026-10-${String(day).padStart(2, '0')}`;
      const dow = new Date(`${date}T00:00:00`).getDay();
      if (dow === 0 || dow === 6) continue;
      await Attendance.create({
        employeeId, date, clockIn: `${date}T08:00:00`, clockOut: `${date}T17:00:00`,
        totalHours: 8, status: 'present', overtime: 0, nightShiftHours: 0,
      });
    }
  };

  it('never pays a negative net when nothing was worked', async () => {
    await Attendance.destroy({ where: {}, force: true });
    const data = await preview({ month: 10, year: 2026, periodType: 'monthly' });
    for (const slip of data.payslips) {
      expect(slip.grossPay).toBe(0);
      expect(slip.totalDeductions).toBe(0);
      expect(slip.netPay).toBe(0);
    }
    expect(data.totalNet).toBe(0);
  });

  it('keeps gross, deductions and net consistent on a fully worked month', async () => {
    await Attendance.destroy({ where: {}, force: true });
    await workDays(ownEmployeeId);
    const data = await preview({ month: 10, year: 2026, periodType: 'monthly' });
    const slip = data.payslips.find((p: any) => p.employeeId === ownEmployeeId);
    expect(slip.absentDays).toBe(0);
    expect(slip.grossPay).toBeCloseTo(20000, 2);
    expect(slip.netPay).toBeGreaterThan(0);
    expect(slip.grossPay - slip.totalDeductions).toBeCloseTo(slip.netPay, 2);
    expect(slip.sssDeduction + slip.philhealthDeduction + slip.pagibigDeduction + slip.taxDeduction)
      .toBeCloseTo(slip.totalDeductions, 2);
  });

  it('pays the period being run, not the employee pay frequency', async () => {
    await Attendance.destroy({ where: {}, force: true });
    await workDays(ownEmployeeId);
    await workDays(otherEmployeeId);

    const monthly = await preview({ month: 10, year: 2026, periodType: 'monthly' });
    const fullOther = monthly.payslips.find((p: any) => p.employeeId === otherEmployeeId);
    const fullOwn = monthly.payslips.find((p: any) => p.employeeId === ownEmployeeId);
    // A 1st–31st run credits the whole month to everyone, whatever frequency they
    // are paid on (this used to follow Employee.paymentFrequency, so AF-002 was
    // paid half a month for a full month worked).
    expect(fullOther.basicSalary).toBeCloseTo(30000, 2);
    expect(fullOwn.basicSalary).toBeCloseTo(20000, 2);

    const h1 = await preview({ month: 10, year: 2026, periodType: 'semi-monthly', half: 1 });
    const h2 = await preview({ month: 10, year: 2026, periodType: 'semi-monthly', half: 2 });
    const first = h1.payslips.find((p: any) => p.employeeId === otherEmployeeId);
    const second = h2.payslips.find((p: any) => p.employeeId === otherEmployeeId);
    expect(first.basicSalary).toBeCloseTo(15000, 2);
    // …and a half-run no longer credits a monthly-paid employee a full month.
    expect(h1.payslips.find((p: any) => p.employeeId === ownEmployeeId).basicSalary).toBeCloseTo(10000, 2);

    // One month of statutory contributions per month, not one month per payslip.
    expect(first.sssDeduction + second.sssDeduction).toBeCloseTo(fullOther.sssDeduction, 1);
    expect(first.philhealthDeduction + second.philhealthDeduction).toBeCloseTo(fullOther.philhealthDeduction, 1);
    expect(first.pagibigDeduction + second.pagibigDeduction).toBeCloseTo(fullOther.pagibigDeduction, 1);
    for (const slip of [...h1.payslips, ...h2.payslips]) {
      expect(slip.netPay).toBeGreaterThanOrEqual(0);
      expect(slip.grossPay - slip.totalDeductions).toBeCloseTo(slip.netPay, 2);
    }
    await Attendance.destroy({ where: {}, force: true });
  });

  it('prices an empty period without NaN or Infinity', async () => {
    // A period whose working days count is zero used to divide by it.
    const { computePayslipForEmployee } = require('../../src/services/hrms/payroll.service')._math;
    const emp = { salary: 20000 };
    const empty = { daysWorked: 0, overtime: 0, nightShiftHours: 0, holidayPay: 0, restDayPay: 0 };
    for (const [periodSalary, periodDays, totalDays, semi] of [[0, 0, 0, true], [10000, 0, 22, true], [0, 0, 0, false]] as const) {
      const slip = computePayslipForEmployee(emp, empty, periodSalary, periodDays, totalDays, semi, false, periodSalary, 0, 2026);
      for (const value of [slip.grossPay, slip.totalDeductions, slip.netPay, slip.absentDeduction, slip.overtimePay]) {
        expect(Number.isFinite(value)).toBe(true);
      }
      expect(slip.netPay).toBeGreaterThanOrEqual(0);
    }
  });
});
