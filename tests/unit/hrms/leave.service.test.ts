import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

process.env.DB_DIALECT = 'sqlite';
process.env.DB_STORAGE = ':memory:';

const models = require('../../../src/models');
const { sequelize, LeaveRequest, Employee, Department, Position, Role, User, Attendance } = models;
const leaveService = require('../../../src/services/hrms/leave.service');

let employeeId;
let userId;

beforeAll(async () => {
  await sequelize.sync({ force: true });

  const role = await Role.create({ name: 'Employee', slug: 'employee' });
  const dept = await Department.create({ name: 'Operations' });
  const pos = await Position.create({
    title: 'Staff',
    departmentId: dept.id,
    minSalary: 30000,
    maxSalary: 50000,
  });

  const user = await User.create({
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@test.local',
    password: 'hashed',
    roleId: role.id,
  });
  userId = user.id;

  const emp = await Employee.create({
    employeeNo: 'EMP001',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@test.local',
    hireDate: new Date(),
    departmentId: dept.id,
    positionId: pos.id,
    salary: 40000,
    employmentType: 'full-time',
    userId: user.id,
    status: 'active',
  });
  employeeId = emp.id;
});

afterAll(async () => {
  await sequelize.close();
});

beforeEach(async () => {
  await Attendance.destroy({ where: {}, force: true });
  await LeaveRequest.destroy({ where: {}, force: true });
});

// Helper to get Monday of next week
const getNextMonday = () => {
  const date = new Date();
  date.setDate(date.getDate() + ((1 + 7 - date.getDay()) % 7 || 7));
  return date;
};

const nextMonday = getNextMonday();
const startDate = nextMonday.toISOString().split('T')[0];

const nextWednesday = new Date(nextMonday);
nextWednesday.setDate(nextWednesday.getDate() + 2);
const endDate = nextWednesday.toISOString().split('T')[0]; // Mon-Wed = 3 days

describe('leave.service - create', () => {
  it('creates a leave request', async () => {
    const leave = await leaveService.create({
      employeeId,
      leaveType: 'sick',
      startDate,
      endDate,
      reason: 'Medical appointment',
    });

    expect(leave.employeeId).toBe(employeeId);
    expect(leave.leaveType).toBe('sick');
    expect(leave.status).toBe('pending');
    expect(leave.days).toBeGreaterThan(0);
  });

  it('calculates weekdays correctly', async () => {
    const leave = await leaveService.create({
      employeeId,
      leaveType: 'vacation',
      startDate,
      endDate,
      reason: 'Family trip',
    });

    // 3 weekdays between dates
    expect(leave.days).toBe(3);
  });

  it('rejects if end date before start date', async () => {
    await expect(
      leaveService.create({
        employeeId,
        leaveType: 'sick',
        startDate: endDate,
        endDate: startDate,
        reason: 'Invalid dates',
      })
    ).rejects.toThrow(/End date must be on or after start date/i);
  });

  it('rejects for non-existent employee', async () => {
    await expect(
      leaveService.create({
        employeeId: 999999,
        leaveType: 'sick',
        startDate,
        endDate,
        reason: 'Test',
      })
    ).rejects.toThrow(/Employee not found/i);
  });

  it('rejects overlapping leave requests', async () => {
    await leaveService.create({
      employeeId,
      leaveType: 'sick',
      startDate,
      endDate,
      reason: 'First leave',
    });

    await expect(
      leaveService.create({
        employeeId,
        leaveType: 'vacation',
        startDate,
        endDate,
        reason: 'Overlapping leave',
      })
    ).rejects.toThrow(/overlaps with an existing leave/i);
  });

  it('rejects if insufficient leave credits', async () => {
    // Create 13 days of approved sick leave (within 15 day limit)
    const year = new Date().getFullYear();

    // First leave: Jan 2-13 (2 weeks = 10 weekdays)
    await LeaveRequest.create({
      employeeId,
      leaveType: 'sick',
      startDate: `${year}-01-02`,
      endDate: `${year}-01-13`,
      days: 10,
      status: 'admin-approved',
      reason: 'Illness',
    });

    // Second leave: Jan 16-19 (4 weekdays)
    await LeaveRequest.create({
      employeeId,
      leaveType: 'sick',
      startDate: `${year}-01-16`,
      endDate: `${year}-01-19`,
      days: 4,
      status: 'admin-approved',
      reason: 'Recovery',
    });

    // Total used: 14 days, remaining: 1 day
    // Try to request 3 more days (exceeds limit)
    await expect(
      leaveService.create({
        employeeId,
        leaveType: 'sick',
        startDate,
        endDate, // 3 weekdays
        reason: 'More sick leave',
      })
    ).rejects.toThrow(/Insufficient sick leave credits/i);
  });

  it('creates leave using userId', async () => {
    const leave = await leaveService.create({
      userId,
      leaveType: 'personal',
      startDate,
      endDate,
      reason: 'Personal matter',
    });

    expect(leave.employeeId).toBe(employeeId);
  });
});

describe('leave.service - getAll', () => {
  it('returns paginated leave requests', async () => {
    await leaveService.create({ employeeId, leaveType: 'sick', startDate, endDate, reason: 'Sick' });

    // Second leave 2 weeks later
    const nextMonth = new Date(nextMonday);
    nextMonth.setDate(nextMonth.getDate() + 14);
    const start2 = nextMonth.toISOString().split('T')[0];
    const end2 = new Date(nextMonth);
    end2.setDate(end2.getDate() + 2);

    await leaveService.create({ employeeId, leaveType: 'vacation', startDate: start2, endDate: end2.toISOString().split('T')[0], reason: 'Vacation' });

    const result = await leaveService.getAll({ page: 1, limit: 10 });

    expect(result.leaves).toHaveLength(2);
    expect(result.pagination.totalItems).toBe(2);
  });

  it('filters by status', async () => {
    const leave = await leaveService.create({ employeeId, leaveType: 'sick', startDate, endDate, reason: 'Sick' });
    await leaveService.hrReview(leave.id, 1, 'Reviewed');

    const result = await leaveService.getAll({ status: 'hr-reviewed' });

    expect(result.leaves).toHaveLength(1);
    expect(result.leaves[0].status).toBe('hr-reviewed');
  });

  it('filters by leave type', async () => {
    await leaveService.create({ employeeId, leaveType: 'sick', startDate, endDate, reason: 'Sick' });

    // Second leave 2 weeks later
    const nextMonth = new Date(nextMonday);
    nextMonth.setDate(nextMonth.getDate() + 14);
    const start2 = nextMonth.toISOString().split('T')[0];
    const end2 = new Date(nextMonth);
    end2.setDate(end2.getDate() + 2);

    await leaveService.create({ employeeId, leaveType: 'vacation', startDate: start2, endDate: end2.toISOString().split('T')[0], reason: 'Vacation' });

    const result = await leaveService.getAll({ leaveType: 'sick' });

    expect(result.leaves).toHaveLength(1);
    expect(result.leaves[0].leaveType).toBe('sick');
  });

  it('searches by employee name', async () => {
    await leaveService.create({ employeeId, leaveType: 'sick', startDate, endDate, reason: 'Sick' });

    const result = await leaveService.getAll({ search: 'John' });

    expect(result.leaves).toHaveLength(1);
  });

  it('includes employee and department info', async () => {
    await leaveService.create({ employeeId, leaveType: 'sick', startDate, endDate, reason: 'Sick' });

    const result = await leaveService.getAll({});

    expect(result.leaves[0].employee).toBeDefined();
    expect(result.leaves[0].employee.department).toBeDefined();
  });
});

describe('leave.service - getById', () => {
  it('returns leave request with details', async () => {
    const leave = await leaveService.create({
      employeeId,
      leaveType: 'vacation',
      startDate,
      endDate,
      reason: 'Holiday',
    });

    const result = await leaveService.getById(leave.id);

    expect(result.id).toBe(leave.id);
    expect(result.employee.firstName).toBe('John');
    expect(result.employee.department.name).toBe('Operations');
  });

  it('throws for non-existent leave', async () => {
    await expect(leaveService.getById(999999)).rejects.toThrow(/not found/i);
  });
});

describe('leave.service - getLeaveBalance', () => {
  it('returns leave balance for all types', async () => {
    const balance = await leaveService.getLeaveBalance(employeeId);

    expect(balance.sick.total).toBe(15);
    expect(balance.sick.used).toBe(0);
    expect(balance.sick.remaining).toBe(15);
    expect(balance.vacation.total).toBe(15);
    expect(balance.personal.total).toBe(5);
  });

  it('deducts approved leaves from balance', async () => {
    const year = new Date().getFullYear();
    const jan1 = `${year}-01-01`;
    const jan5 = `${year}-01-05`; // 5 weekdays

    await LeaveRequest.create({
      employeeId,
      leaveType: 'vacation',
      startDate: jan1,
      endDate: jan5,
      days: 5,
      status: 'admin-approved',
      reason: 'Holiday',
    });

    const balance = await leaveService.getLeaveBalance(employeeId);

    expect(balance.vacation.used).toBe(5);
    expect(balance.vacation.remaining).toBe(10);
  });

  it('ignores pending/rejected leaves in balance', async () => {
    const year = new Date().getFullYear();
    const jan1 = `${year}-01-01`;
    const jan5 = `${year}-01-05`;

    await LeaveRequest.create({
      employeeId,
      leaveType: 'sick',
      startDate: jan1,
      endDate: jan5,
      days: 5,
      status: 'pending',
      reason: 'Pending',
    });

    const balance = await leaveService.getLeaveBalance(employeeId);

    expect(balance.sick.used).toBe(0);
    expect(balance.sick.remaining).toBe(15);
  });

  it('throws for non-existent employee', async () => {
    await expect(leaveService.getLeaveBalance(999999)).rejects.toThrow(/not found/i);
  });
});

describe('leave.service - hrReview', () => {
  it('reviews a pending leave request', async () => {
    const leave = await leaveService.create({
      employeeId,
      leaveType: 'sick',
      startDate,
      endDate,
      reason: 'Medical',
    });

    const result = await leaveService.hrReview(leave.id, 1, 'Approved by HR');

    expect(result.status).toBe('hr-reviewed');
    expect(result.reviewedBy).toBe(1);
    expect(result.reviewedAt).toBeDefined();
  });

  it('throws for non-existent leave', async () => {
    await expect(leaveService.hrReview(999999, 1, 'Test')).rejects.toThrow(/not found/i);
  });

  it('throws for non-pending leave', async () => {
    const leave = await leaveService.create({
      employeeId,
      leaveType: 'sick',
      startDate,
      endDate,
      reason: 'Medical',
    });

    await leaveService.hrReview(leave.id, 1, 'Reviewed');

    await expect(leaveService.hrReview(leave.id, 1, 'Again')).rejects.toThrow(/Only pending leaves/i);
  });
});

describe('leave.service - adminApprove', () => {
  it('approves an HR-reviewed leave request', async () => {
    const leave = await leaveService.create({
      employeeId,
      leaveType: 'vacation',
      startDate,
      endDate,
      reason: 'Holiday',
    });

    await leaveService.hrReview(leave.id, 1, 'Reviewed');

    const result = await leaveService.adminApprove(leave.id, 2);

    expect(result.status).toBe('admin-approved');
    expect(result.approvedBy).toBe(2);
    expect(result.approvedAt).toBeDefined();
  });

  it('creates attendance records for approved leave', async () => {
    const leave = await leaveService.create({
      employeeId,
      leaveType: 'sick',
      startDate,
      endDate,
      reason: 'Sick',
    });

    await leaveService.hrReview(leave.id, 1, 'OK');
    await leaveService.adminApprove(leave.id, 2);

    const attendanceRecords = await Attendance.count({
      where: { employeeId, status: 'on-leave' },
    });

    expect(attendanceRecords).toBe(3); // 3 weekdays
  });

  // The insert was batched into one bulkCreate with ignoreDuplicates, which
  // relies on the unique index on (employee_id, date) rather than a per-day
  // existence check. This pins that behaviour: a pre-existing record on a day
  // inside the leave range must be left alone, not duplicated or overwritten.
  it('does not overwrite an existing attendance record on a leave day', async () => {
    const leave = await leaveService.create({
      employeeId,
      leaveType: 'sick',
      startDate,
      endDate,
      reason: 'Sick',
    });

    // Pre-create one weekday inside the range with a different status.
    const weekdays = [];
    for (let d = new Date(startDate); d <= new Date(endDate); d.setDate(d.getDate() + 1)) {
      const dow = d.getDay();
      if (dow !== 0 && dow !== 6) weekdays.push(d.toISOString().split('T')[0]);
    }
    const targetDate = weekdays[0];
    await Attendance.create({
      employeeId,
      date: targetDate,
      status: 'present',
      totalHours: 8,
      notes: 'Clocked in normally',
    });

    await leaveService.hrReview(leave.id, 1, 'OK');
    await leaveService.adminApprove(leave.id, 2);

    const existing = await Attendance.findOne({ where: { employeeId, date: targetDate } });
    expect(existing.status).toBe('present');
    expect(existing.notes).toBe('Clocked in normally');

    // The remaining weekdays still get on-leave rows.
    const onLeave = await Attendance.count({ where: { employeeId, status: 'on-leave' } });
    expect(onLeave).toBe(weekdays.length - 1);
  });

  it('skips weekends when creating attendance', async () => {
    const leave = await leaveService.create({
      employeeId,
      leaveType: 'vacation',
      startDate,
      endDate,
      reason: 'Holiday',
    });

    await leaveService.hrReview(leave.id, 1, 'OK');
    await leaveService.adminApprove(leave.id, 2);

    const attendanceRecords = await Attendance.findAll({
      where: { employeeId, status: 'on-leave' },
    });

    // Should not include Saturday/Sunday
    for (const record of attendanceRecords) {
      const date = new Date(record.date);
      const dayOfWeek = date.getDay();
      expect(dayOfWeek).not.toBe(0); // Not Sunday
      expect(dayOfWeek).not.toBe(6); // Not Saturday
    }
  });

  it('throws for non-existent leave', async () => {
    await expect(leaveService.adminApprove(999999, 2)).rejects.toThrow(/not found/i);
  });

  it('throws for non-reviewed leave', async () => {
    const leave = await leaveService.create({
      employeeId,
      leaveType: 'sick',
      startDate,
      endDate,
      reason: 'Sick',
    });

    await expect(leaveService.adminApprove(leave.id, 2)).rejects.toThrow(/Only HR-reviewed leaves/i);
  });

  it('rejects overlapping approved leaves', async () => {
    const leave1 = await leaveService.create({
      employeeId,
      leaveType: 'sick',
      startDate,
      endDate,
      reason: 'First',
    });

    await leaveService.hrReview(leave1.id, 1, 'OK');
    await leaveService.adminApprove(leave1.id, 2);

    // Create second leave 2 weeks later (no overlap with first)
    const nextMonth = new Date(nextMonday);
    nextMonth.setDate(nextMonth.getDate() + 14);
    const start2 = nextMonth.toISOString().split('T')[0];
    const end2 = new Date(nextMonth);
    end2.setDate(end2.getDate() + 2);

    const leave2 = await leaveService.create({
      employeeId,
      leaveType: 'vacation',
      startDate: start2,
      endDate: end2.toISOString().split('T')[0],
      reason: 'Second',
    });

    await leaveService.hrReview(leave2.id, 1, 'OK');

    // Now approve leave2 with same dates as leave1 by updating it
    await leave2.update({ startDate, endDate });

    await expect(leaveService.adminApprove(leave2.id, 2)).rejects.toThrow(/overlaps with an already approved leave/i);
  });
});

describe('leave.service - adminReject', () => {
  it('rejects an HR-reviewed leave request', async () => {
    const leave = await leaveService.create({
      employeeId,
      leaveType: 'vacation',
      startDate,
      endDate,
      reason: 'Holiday',
    });

    await leaveService.hrReview(leave.id, 1, 'Reviewed');

    const result = await leaveService.adminReject(leave.id, 2, 'Budget constraints');

    expect(result.status).toBe('rejected');
    expect(result.approvedBy).toBe(2);
    expect(result.remarks).toContain('Budget constraints');
  });

  it('removes on-leave attendance records', async () => {
    // Create attendance first
    await Attendance.create({
      employeeId,
      date: startDate,
      status: 'on-leave',
      notes: 'Leave',
    });

    const leave = await leaveService.create({
      employeeId,
      leaveType: 'sick',
      startDate,
      endDate,
      reason: 'Sick',
    });

    await leaveService.hrReview(leave.id, 1, 'OK');
    await leaveService.adminReject(leave.id, 2, 'Denied');

    const attendanceCount = await Attendance.count({
      where: { employeeId, status: 'on-leave' },
    });

    expect(attendanceCount).toBe(0);
  });

  it('throws for non-existent leave', async () => {
    await expect(leaveService.adminReject(999999, 2, 'Test')).rejects.toThrow(/not found/i);
  });

  it('throws for non-reviewed leave', async () => {
    const leave = await leaveService.create({
      employeeId,
      leaveType: 'sick',
      startDate,
      endDate,
      reason: 'Sick',
    });

    await expect(leaveService.adminReject(leave.id, 2, 'No')).rejects.toThrow(/Only HR-reviewed leaves/i);
  });
});

describe('leave.service - cancel', () => {
  it('cancels a pending leave request', async () => {
    const leave = await leaveService.create({
      employeeId,
      leaveType: 'personal',
      startDate,
      endDate,
      reason: 'Personal',
    });

    const result = await leaveService.cancel(leave.id, userId);

    expect(result.message).toContain('cancelled');

    const updated = await LeaveRequest.findByPk(leave.id);
    expect(updated.status).toBe('cancelled');
  });

  it('throws for non-existent leave', async () => {
    await expect(leaveService.cancel(999999, userId)).rejects.toThrow(/not found/i);
  });

  it('throws for non-pending leave', async () => {
    const leave = await leaveService.create({
      employeeId,
      leaveType: 'sick',
      startDate,
      endDate,
      reason: 'Sick',
    });

    await leaveService.hrReview(leave.id, 1, 'OK');

    await expect(leaveService.cancel(leave.id, userId)).rejects.toThrow(/Only pending leaves/i);
  });

  it('throws if user not the owner', async () => {
    const leave = await leaveService.create({
      employeeId,
      leaveType: 'sick',
      startDate,
      endDate,
      reason: 'Sick',
    });

    await expect(leaveService.cancel(leave.id, 99999)).rejects.toThrow(/only cancel your own/i);
  });
});

describe('leave.service - delete', () => {
  it('deletes a leave request', async () => {
    const leave = await leaveService.create({
      employeeId,
      leaveType: 'vacation',
      startDate,
      endDate,
      reason: 'Holiday',
    });

    await leaveService.delete(leave.id);

    const count = await LeaveRequest.count({ where: { id: leave.id } });
    expect(count).toBe(0);
  });

  it('throws for non-existent leave', async () => {
    await expect(leaveService.delete(999999)).rejects.toThrow(/not found/i);
  });
});
