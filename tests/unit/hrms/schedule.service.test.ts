import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

process.env.DB_DIALECT = 'sqlite';
process.env.DB_STORAGE = ':memory:';

const models = require('../../../src/models');
const { sequelize, Schedule, ShiftAssignment, Employee, Department, Position, Role, User } = models;
const scheduleService = require('../../../src/services/hrms/schedule.service');

let employeeId;
let scheduleId;

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
  await ShiftAssignment.destroy({ where: {}, force: true });
  await Schedule.destroy({ where: {}, force: true });
});

describe('schedule.service - create', () => {
  it('creates a new schedule', async () => {
    const schedule = await scheduleService.create({
      name: 'Morning Shift',
      startTime: '08:00',
      endTime: '17:00',
      daysOfWeek: '1,2,3,4,5',
    });

    expect(schedule.name).toBe('Morning Shift');
    expect(schedule.startTime).toBe('08:00');
    expect(schedule.endTime).toBe('17:00');
  });

  it('creates schedule with description', async () => {
    const schedule = await scheduleService.create({
      name: 'Night Shift',
      startTime: '22:00',
      endTime: '06:00',
      description: 'Overnight operations',
    });

    expect(schedule.description).toBe('Overnight operations');
  });
});

describe('schedule.service - getAll', () => {
  it('returns paginated schedules', async () => {
    await scheduleService.create({ name: 'Morning', startTime: '08:00', endTime: '17:00' });
    await scheduleService.create({ name: 'Evening', startTime: '14:00', endTime: '23:00' });

    const result = await scheduleService.getAll({ page: 1, limit: 10 });

    expect(result.schedules).toHaveLength(2);
    expect(result.pagination.totalItems).toBe(2);
  });

  it('searches by name', async () => {
    await scheduleService.create({ name: 'Day Shift', startTime: '09:00', endTime: '18:00' });
    await scheduleService.create({ name: 'Night Shift', startTime: '21:00', endTime: '06:00' });

    const result = await scheduleService.getAll({ search: 'Day' });

    expect(result.schedules).toHaveLength(1);
    expect(result.schedules[0].name).toBe('Day Shift');
  });

  it('paginates correctly', async () => {
    for (let i = 0; i < 5; i++) {
      await scheduleService.create({ name: `Schedule ${i}`, startTime: '08:00', endTime: '17:00' });
    }

    const result = await scheduleService.getAll({ page: 1, limit: 2 });

    expect(result.schedules).toHaveLength(2);
    expect(result.pagination.totalItems).toBe(5);
    expect(result.pagination.hasNextPage).toBe(true);
  });
});

describe('schedule.service - getById', () => {
  it('returns schedule with assignments', async () => {
    const schedule = await scheduleService.create({
      name: 'Standard',
      startTime: '09:00',
      endTime: '18:00',
    });

    await scheduleService.assign({
      scheduleId: schedule.id,
      employeeId,
      date: '2026-10-15',
    });

    const result = await scheduleService.getById(schedule.id);

    expect(result.name).toBe('Standard');
    expect(result.assignments).toBeDefined();
    expect(result.assignments.length).toBeGreaterThanOrEqual(1);
  });

  it('throws for non-existent schedule', async () => {
    await expect(scheduleService.getById(999999)).rejects.toThrow(/not found/i);
  });
});

describe('schedule.service - update', () => {
  it('updates schedule fields', async () => {
    const schedule = await scheduleService.create({
      name: 'Temp',
      startTime: '10:00',
      endTime: '19:00',
    });

    const updated = await scheduleService.update(schedule.id, {
      name: 'Updated Shift',
      startTime: '11:00',
      endTime: '20:00',
    });

    expect(updated.name).toBe('Updated Shift');
    expect(updated.startTime).toBe('11:00');
    expect(updated.endTime).toBe('20:00');
  });

  it('throws for non-existent schedule', async () => {
    await expect(
      scheduleService.update(999999, { name: 'Ghost' })
    ).rejects.toThrow(/not found/i);
  });
});

describe('schedule.service - delete', () => {
  it('deletes a schedule and removes assignments', async () => {
    const schedule = await scheduleService.create({
      name: 'To Delete',
      startTime: '08:00',
      endTime: '17:00',
    });

    await scheduleService.assign({
      scheduleId: schedule.id,
      employeeId,
      date: '2026-10-20',
    });

    await scheduleService.delete(schedule.id);

    const count = await Schedule.count({ where: { id: schedule.id } });
    expect(count).toBe(0);

    const assignmentCount = await ShiftAssignment.count({ where: { scheduleId: schedule.id } });
    expect(assignmentCount).toBe(0);

    // Verify employee scheduleId is cleared
    const emp = await Employee.findByPk(employeeId);
    expect(emp.scheduleId).toBeNull();
  });

  it('throws for non-existent schedule', async () => {
    await expect(scheduleService.delete(999999)).rejects.toThrow(/not found/i);
  });
});

describe('schedule.service - assign', () => {
  beforeEach(async () => {
    const schedule = await scheduleService.create({
      name: 'Test Schedule',
      startTime: '08:00',
      endTime: '17:00',
    });
    scheduleId = schedule.id;
  });

  it('assigns schedule to employee permanently', async () => {
    const result = await scheduleService.assign({
      scheduleId,
      employeeId,
    });

    expect(result.assigned).toBe(1);

    const emp = await Employee.findByPk(employeeId);
    expect(emp.scheduleId).toBe(scheduleId);
  });

  it('assigns schedule for specific date', async () => {
    const result = await scheduleService.assign({
      scheduleId,
      employeeId,
      date: '2026-10-25',
    });

    expect(result.assigned).toBe(1);

    const assignment = await ShiftAssignment.findOne({
      where: { employeeId, date: '2026-10-25' },
    });

    expect(assignment).toBeDefined();
    expect(assignment.scheduleId).toBe(scheduleId);
  });

  it('updates existing date assignment', async () => {
    // Create first assignment
    await scheduleService.assign({
      scheduleId,
      employeeId,
      date: '2026-10-30',
    });

    // Create another schedule
    const schedule2 = await scheduleService.create({
      name: 'Alternative',
      startTime: '14:00',
      endTime: '23:00',
    });

    // Reassign same date to different schedule
    await scheduleService.assign({
      scheduleId: schedule2.id,
      employeeId,
      date: '2026-10-30',
    });

    const assignment = await ShiftAssignment.findOne({
      where: { employeeId, date: '2026-10-30' },
    });

    expect(assignment.scheduleId).toBe(schedule2.id);
  });

  it('throws for non-existent schedule', async () => {
    await expect(
      scheduleService.assign({ scheduleId: 999999, employeeId })
    ).rejects.toThrow(/Schedule not found/i);
  });

  it('throws for non-existent employee', async () => {
    await expect(
      scheduleService.assign({ scheduleId, employeeId: 999999 })
    ).rejects.toThrow(/Employee not found/i);
  });
});

describe('schedule.service - getPermanentAssignments', () => {
  it('returns employees with permanent schedules', async () => {
    const schedule = await scheduleService.create({
      name: 'Permanent',
      startTime: '09:00',
      endTime: '18:00',
    });

    await scheduleService.assign({ scheduleId: schedule.id, employeeId });

    const result = await scheduleService.getPermanentAssignments({});

    expect(result.length).toBeGreaterThanOrEqual(1);
    const assigned = result.find(e => e.id === employeeId);
    expect(assigned).toBeDefined();
    expect(assigned.schedule).toBeDefined();
  });

  it('excludes employees without schedules', async () => {
    const result = await scheduleService.getPermanentAssignments({});

    const unassigned = result.find(e => e.scheduleId === null);
    expect(unassigned).toBeUndefined();
  });
});

describe('schedule.service - removePermanentAssignment', () => {
  it('removes permanent schedule from employee', async () => {
    const schedule = await scheduleService.create({
      name: 'To Remove',
      startTime: '08:00',
      endTime: '17:00',
    });

    await scheduleService.assign({ scheduleId: schedule.id, employeeId });

    await scheduleService.removePermanentAssignment(employeeId);

    const emp = await Employee.findByPk(employeeId);
    expect(emp.scheduleId).toBeNull();
  });

  it('throws for non-existent employee', async () => {
    await expect(
      scheduleService.removePermanentAssignment(999999)
    ).rejects.toThrow(/not found/i);
  });
});

describe('schedule.service - getAssignments', () => {
  beforeEach(async () => {
    const schedule = await scheduleService.create({
      name: 'Test Schedule',
      startTime: '08:00',
      endTime: '17:00',
    });
    scheduleId = schedule.id;
  });

  it('returns all assignments', async () => {
    await scheduleService.assign({ scheduleId, employeeId, date: '2026-11-01' });
    await scheduleService.assign({ scheduleId, employeeId, date: '2026-11-02' });

    const result = await scheduleService.getAssignments({});

    expect(result.length).toBeGreaterThanOrEqual(2);
  });

  it('filters by employee', async () => {
    await scheduleService.assign({ scheduleId, employeeId, date: '2026-11-05' });

    const result = await scheduleService.getAssignments({ employeeId });

    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.every(a => a.employeeId === employeeId)).toBe(true);
  });

  it('filters by date', async () => {
    await scheduleService.assign({ scheduleId, employeeId, date: '2026-11-10' });

    const result = await scheduleService.getAssignments({ date: '2026-11-10' });

    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it('filters by date range', async () => {
    await scheduleService.assign({ scheduleId, employeeId, date: '2026-11-15' });
    await scheduleService.assign({ scheduleId, employeeId, date: '2026-11-16' });
    await scheduleService.assign({ scheduleId, employeeId, date: '2026-11-17' });

    const result = await scheduleService.getAssignments({
      startDate: '2026-11-15',
      endDate: '2026-11-17',
    });

    expect(result.length).toBeGreaterThanOrEqual(3);
  });
});

describe('schedule.service - deleteAssignment', () => {
  it('deletes a shift assignment', async () => {
    const schedule = await scheduleService.create({
      name: 'Test',
      startTime: '08:00',
      endTime: '17:00',
    });

    await scheduleService.assign({
      scheduleId: schedule.id,
      employeeId,
      date: '2026-11-20',
    });

    const assignment = await ShiftAssignment.findOne({
      where: { employeeId, date: '2026-11-20' },
    });

    await scheduleService.deleteAssignment(assignment.id);

    const count = await ShiftAssignment.count({ where: { id: assignment.id } });
    expect(count).toBe(0);
  });

  it('throws for non-existent assignment', async () => {
    await expect(scheduleService.deleteAssignment(999999)).rejects.toThrow(/not found/i);
  });
});
