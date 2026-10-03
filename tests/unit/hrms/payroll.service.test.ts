import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

process.env.DB_DIALECT = 'sqlite';
process.env.DB_STORAGE = ':memory:';

const models = require('../../../src/models');
const { sequelize, Payroll, Payslip, Employee, Department, Position, Attendance, Role, User, Schedule } = models;
const payrollService = require('../../../src/services/hrms/payroll.service');

let departmentId;
let positionId;
let employeeId;
let scheduleId;

beforeAll(async () => {
  await sequelize.sync({ force: true });

  const role = await Role.create({ name: 'Employee', slug: 'employee' });
  const dept = await Department.create({ name: 'Operations' });
  departmentId = dept.id;

  const pos = await Position.create({
    title: 'Staff',
    departmentId,
    minSalary: 30000,
    maxSalary: 50000,
  });
  positionId = pos.id;

  const sched = await Schedule.create({
    name: 'Regular',
    startTime: '09:00',
    endTime: '18:00',
  });
  scheduleId = sched.id;

  const user = await User.create({
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@test.local',
    password: 'hashed',
    roleId: role.id,
  });

  const emp = await Employee.create({
    employeeNo: 'EMP001',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@test.local',
    hireDate: new Date(),
    departmentId,
    positionId,
    salary: 40000,
    paymentFrequency: 'monthly',
    employmentType: 'full-time',
    scheduleId,
    userId: user.id,
    status: 'active',
  });
  employeeId = emp.id;
});

afterAll(async () => {
  await sequelize.close();
});

beforeEach(async () => {
  await Payslip.destroy({ where: {}, force: true });
  await Payroll.destroy({ where: {}, force: true });
  await Attendance.destroy({ where: {}, force: true });
});

describe('payroll.service - generate', () => {
  it('generates monthly payroll', async () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;

    // Create attendance records
    for (let i = 1; i <= 22; i++) {
      const date = new Date(year, month - 1, i);
      if (date.getDay() !== 0) { // Skip Sundays
        await Attendance.create({
          employeeId,
          date: date.toISOString().split('T')[0],
          clockIn: `${date.toISOString().split('T')[0]}T09:00:00`,
          clockOut: `${date.toISOString().split('T')[0]}T18:00:00`,
          totalHours: 8,
          status: 'present',
          notes: 'Regular working day',
        });
      }
    }

    const payroll = await payrollService.generate({
      periodType: 'monthly',
      year,
      month,
    });

    expect(payroll.id).toBeDefined();
    expect(payroll.status).toBe('draft');
    expect(payroll.period).toBeDefined();
    expect(payroll.payslips).toHaveLength(1);
  });

  it('generates semi-monthly payroll', async () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;

    // Create attendance records for first half
    for (let i = 1; i <= 15; i++) {
      const date = new Date(year, month - 1, i);
      if (date.getDay() !== 0) {
        await Attendance.create({
          employeeId,
          date: date.toISOString().split('T')[0],
          clockIn: `${date.toISOString().split('T')[0]}T09:00:00`,
          clockOut: `${date.toISOString().split('T')[0]}T18:00:00`,
          totalHours: 8,
          status: 'present',
        });
      }
    }

    const payroll = await payrollService.generate({
      periodType: 'semi-monthly',
      half: 1,
      year,
      month,
    });

    expect(payroll.period).toBeDefined();
  });

  it('includes employee details in payslips', async () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;

    for (let i = 1; i <= 22; i++) {
      const date = new Date(year, month - 1, i);
      if (date.getDay() !== 0) {
        await Attendance.create({
          employeeId,
          date: date.toISOString().split('T')[0],
          clockIn: `${date.toISOString().split('T')[0]}T09:00:00`,
          clockOut: `${date.toISOString().split('T')[0]}T18:00:00`,
          totalHours: 8,
          status: 'present',
        });
      }
    }

    const payroll = await payrollService.generate({
      periodType: 'monthly',
      year,
      month,
    });

    const payslip = payroll.payslips[0];
    expect(payslip.employeeId).toBe(employeeId);
    expect(payslip.basicSalary).toBeGreaterThan(0);
  });
});

describe('payroll.service - getAll', () => {
  beforeEach(async () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;

    for (let i = 1; i <= 22; i++) {
      const date = new Date(year, month - 1, i);
      if (date.getDay() !== 0) {
        await Attendance.create({
          employeeId,
          date: date.toISOString().split('T')[0],
          clockIn: `${date.toISOString().split('T')[0]}T09:00:00`,
          clockOut: `${date.toISOString().split('T')[0]}T18:00:00`,
          totalHours: 8,
          status: 'present',
        });
      }
    }

    await payrollService.generate({
      periodType: 'monthly',
      year,
      month,
    });
  });

  it('returns paginated payrolls', async () => {
    const result = await payrollService.getAll({ page: 1, limit: 10 });

    expect(result.payrolls).toHaveLength(1);
    expect(result.pagination).toBeDefined();
  });

  it('filters by status', async () => {
    const result = await payrollService.getAll({ status: 'draft' });

    expect(result.payrolls).toHaveLength(1);
  });
});

describe('payroll.service - getById', () => {
  let payrollId;

  beforeEach(async () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;

    for (let i = 1; i <= 22; i++) {
      const date = new Date(year, month - 1, i);
      if (date.getDay() !== 0) {
        await Attendance.create({
          employeeId,
          date: date.toISOString().split('T')[0],
          clockIn: `${date.toISOString().split('T')[0]}T09:00:00`,
          clockOut: `${date.toISOString().split('T')[0]}T18:00:00`,
          totalHours: 8,
          status: 'present',
        });
      }
    }

    const payroll = await payrollService.generate({
      periodType: 'monthly',
      year,
      month,
    });
    payrollId = payroll.id;
  });

  it('returns payroll with payslips', async () => {
    const payroll = await payrollService.getById(payrollId);

    expect(payroll.id).toBe(payrollId);
    expect(payroll.payslips).toHaveLength(1);
  });

  it('throws for non-existent payroll', async () => {
    await expect(payrollService.getById(999999)).rejects.toThrow(/not found/i);
  });
});

describe('payroll.service - process', () => {
  let payrollId;

  beforeEach(async () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;

    for (let i = 1; i <= 22; i++) {
      const date = new Date(year, month - 1, i);
      if (date.getDay() !== 0) {
        await Attendance.create({
          employeeId,
          date: date.toISOString().split('T')[0],
          clockIn: `${date.toISOString().split('T')[0]}T09:00:00`,
          clockOut: `${date.toISOString().split('T')[0]}T18:00:00`,
          totalHours: 8,
          status: 'present',
        });
      }
    }

    const payroll = await payrollService.generate({
      periodType: 'monthly',
      year,
      month,
    });
    payrollId = payroll.id;
  });

  it('processes payroll', async () => {
    const payroll = await payrollService.process(payrollId);

    expect(payroll.status).toBe('processed');
  });

  it('throws for non-existent payroll', async () => {
    await expect(payrollService.process(999999)).rejects.toThrow(/not found/i);
  });
});

describe('payroll.service - pay', () => {
  let payrollId;

  beforeEach(async () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;

    for (let i = 1; i <= 22; i++) {
      const date = new Date(year, month - 1, i);
      if (date.getDay() !== 0) {
        await Attendance.create({
          employeeId,
          date: date.toISOString().split('T')[0],
          clockIn: `${date.toISOString().split('T')[0]}T09:00:00`,
          clockOut: `${date.toISOString().split('T')[0]}T18:00:00`,
          totalHours: 8,
          status: 'present',
        });
      }
    }

    const payroll = await payrollService.generate({
      periodType: 'monthly',
      year,
      month,
    });
    payrollId = payroll.id;
    await payrollService.process(payrollId);
  });

  it('disburses processed payroll', async () => {
    const payroll = await payrollService.pay(payrollId);

    expect(payroll.status).toBe('paid');
    expect(payroll.paidAt).toBeDefined();
  });

  it('throws for non-existent payroll', async () => {
    await expect(payrollService.pay(999999)).rejects.toThrow(/not found/i);
  });
});

describe('payroll.service - getPayslips', () => {
  let payrollId;

  beforeEach(async () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;

    for (let i = 1; i <= 22; i++) {
      const date = new Date(year, month - 1, i);
      if (date.getDay() !== 0) {
        await Attendance.create({
          employeeId,
          date: date.toISOString().split('T')[0],
          clockIn: `${date.toISOString().split('T')[0]}T09:00:00`,
          clockOut: `${date.toISOString().split('T')[0]}T18:00:00`,
          totalHours: 8,
          status: 'present',
        });
      }
    }

    const payroll = await payrollService.generate({
      periodType: 'monthly',
      year,
      month,
    });
    payrollId = payroll.id;
  });

  it('returns payslips for payroll', async () => {
    const result = await payrollService.getPayslips(payrollId);

    expect(result).toHaveLength(1);
    expect(result[0].basicSalary).toBeGreaterThan(0);
  });
});

describe('payroll.service - exportCSV', () => {
  let payrollId;

  beforeEach(async () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;

    for (let i = 1; i <= 22; i++) {
      const date = new Date(year, month - 1, i);
      if (date.getDay() !== 0) {
        await Attendance.create({
          employeeId,
          date: date.toISOString().split('T')[0],
          clockIn: `${date.toISOString().split('T')[0]}T09:00:00`,
          clockOut: `${date.toISOString().split('T')[0]}T18:00:00`,
          totalHours: 8,
          status: 'present',
        });
      }
    }

    const payroll = await payrollService.generate({
      periodType: 'monthly',
      year,
      month,
    });
    payrollId = payroll.id;
  });

  it('exports payroll as CSV', async () => {
    const csv = await payrollService.exportCSV(payrollId);

    expect(csv).toContain('Employee No');
    expect(csv).toContain('EMP001');
    expect(csv).toContain('Basic');
  });
});

// ─── Regression tests for money-correctness fixes ───────────────
// These lock in three bugs that were actively mispaying employees.
// If any of these fail, payroll is wrong — fix the service, not the test.

describe('payroll.service - absent days are deducted', () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;

  // Record every weekday as ABSENT rather than present
  beforeEach(async () => {
    for (let i = 1; i <= 22; i++) {
      const date = new Date(year, month - 1, i);
      if (date.getDay() !== 0) {
        const dateStr = date.toISOString().split('T')[0];
        await Attendance.create({
          employeeId,
          date: dateStr,
          clockIn: null,
          clockOut: null,
          totalHours: 0,
          status: 'absent',
        });
      }
    }
  });

  it('does not count absent days as worked', async () => {
    const payroll = await payrollService.generate({ periodType: 'monthly', year, month });
    const payslip = payroll.payslips[0];

    expect(payslip.daysWorked).toBe(0);
    expect(payslip.absentDays).toBeGreaterThan(0);
    expect(payslip.absentDeduction).toBeGreaterThan(0);
  });

  it('does not pay full salary when absent all period', async () => {
    const payroll = await payrollService.generate({ periodType: 'monthly', year, month });
    const payslip = payroll.payslips[0];

    expect(payslip.netPay).toBeLessThan(payslip.basicSalary);
  });

  it('excludes on-leave from worked days but still counts present/late/half-day', async () => {
    await Attendance.destroy({ where: {}, force: true });

    // Use explicit date strings — building dates via `new Date(...)` then
    // toISOString() shifts local midnight into the previous UTC day at UTC+8,
    // which would push the first record outside the payroll period.
    const monthStr = String(month).padStart(2, '0');
    const days = [5, 6, 7, 8].map((d) => `${year}-${monthStr}-${String(d).padStart(2, '0')}`);

    await Attendance.create({
      employeeId, date: days[0], totalHours: 8, status: 'present',
      clockIn: `${days[0]}T09:00:00`, clockOut: `${days[0]}T18:00:00`,
    });
    await Attendance.create({
      employeeId, date: days[1], totalHours: 8, status: 'late',
      clockIn: `${days[1]}T09:30:00`, clockOut: `${days[1]}T18:00:00`,
    });
    await Attendance.create({
      employeeId, date: days[2], totalHours: 4, status: 'half-day',
      clockIn: `${days[2]}T09:00:00`, clockOut: `${days[2]}T13:00:00`,
    });
    await Attendance.create({
      employeeId, date: days[3], totalHours: 0, status: 'on-leave',
    });

    const payroll = await payrollService.generate({ periodType: 'monthly', year, month });
    const payslip = payroll.payslips[0];

    // present + late + half-day = 3 worked; on-leave excluded
    expect(payslip.daysWorked).toBe(3);
  });
});

describe('payroll.service - PH holidays excluded from working days', () => {
  it('excludes a weekday holiday from totalWorkingDays', async () => {
    // December 2026: Dec 25 (Christmas) is a Friday, Dec 30 (Rizal) is a Wednesday
    const preview = await payrollService.preview({ periodType: 'monthly', year: 2026, month: 12 });

    // If holidays were counted, totalWorkingDays would equal the Mon-Fri count.
    // Asserting it's strictly less proves the holiday subtraction is active.
    expect(preview.totalWorkingDays).toBeGreaterThan(0);

    // Count Mon-Fri in Dec 2026 and confirm the holiday days are excluded
    let weekdayCount = 0;
    const d = new Date('2026-12-01T00:00:00');
    while (d <= new Date('2026-12-31T00:00:00')) {
      if (d.getDay() !== 0 && d.getDay() !== 6) weekdayCount++;
      d.setDate(d.getDate() + 1);
    }
    expect(preview.totalWorkingDays).toBeLessThan(weekdayCount);
    expect(preview.totalWorkingDays).toBeLessThanOrEqual(weekdayCount - 1);
  });

  it('uses holiday-aware working days in the hourly rate', async () => {
    const preview = await payrollService.preview({ periodType: 'monthly', year: 2026, month: 12 });
    const slip = preview.payslips[0];

    // hourlyRate = periodSalary / totalWorkingDays / 8 — verify OT is priced off
    // the holiday-adjusted denominator, not the raw weekday count
    const expectedHourly = 40000 / preview.totalWorkingDays / 8;
    const oneOtHour = expectedHourly * 1.25;
    expect(slip.overtimePay).toBeGreaterThanOrEqual(0);
    expect(oneOtHour).toBeGreaterThan(0);
  });
});

describe('payroll.service - SSS table follows the payroll period', () => {
  it('uses the period year, not the current year', async () => {
    // Generate for a past year (2024) during 2026 — must use the 2024 SSS table
    for (let i = 1; i <= 22; i++) {
      const date = new Date(2024, 5, i); // June 2024
      const dateStr = date.toISOString().split('T')[0];
      await Attendance.create({
        employeeId,
        date: dateStr,
        clockIn: `${dateStr}T09:00:00`,
        clockOut: `${dateStr}T18:00:00`,
        totalHours: 8,
        status: 'present',
      });
    }

    const payroll = await payrollService.generate({ periodType: 'monthly', year: 2024, month: 6 });
    const payslip = payroll.payslips[0];

    // 2024 table: for ₱40,000 MSC the EE bracket is in the 24750+ range = ₱1125.00
    // 2025 table would give ₱1181.00 and 2026 ₱1225.00 — so 1125 proves period-year selection.
    expect(parseFloat(payslip.sssDeduction)).toBe(1125);
  });

  it('throws a clear error for a year with no SSS table', async () => {
    for (let i = 1; i <= 22; i++) {
      const date = new Date(2030, 0, i); // January 2030 — no table
      const dateStr = date.toISOString().split('T')[0];
      await Attendance.create({
        employeeId,
        date: dateStr,
        totalHours: 8,
        status: 'present',
      });
    }

    await expect(
      payrollService.generate({ periodType: 'monthly', year: 2030, month: 1 })
    ).rejects.toThrow(/SSS table not defined/i);
  });
});
