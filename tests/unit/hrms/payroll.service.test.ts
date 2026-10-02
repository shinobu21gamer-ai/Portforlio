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
