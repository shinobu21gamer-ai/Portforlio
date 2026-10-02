import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

process.env.DB_DIALECT = 'sqlite';
process.env.DB_STORAGE = ':memory:';

const models = require('../../../src/models');
const { sequelize, Department, Position, Employee, Role, User } = models;
const positionService = require('../../../src/services/hrms/position.service');

let departmentId;
let departmentId2;

beforeAll(async () => {
  await sequelize.sync({ force: true });
  await Role.create({ name: 'Employee', slug: 'employee' });
});

afterAll(async () => {
  await sequelize.close();
});

beforeEach(async () => {
  await Employee.destroy({ where: {}, force: true });
  await Position.destroy({ where: {}, force: true });
  await Department.destroy({ where: {}, force: true });

  const dept1 = await Department.create({ name: 'Engineering' });
  const dept2 = await Department.create({ name: 'Sales' });
  departmentId = dept1.id;
  departmentId2 = dept2.id;
});

describe('position.service - create', () => {
  it('creates a new position', async () => {
    const pos = await positionService.create({
      title: 'Software Engineer',
      departmentId,
      minSalary: 50000,
      maxSalary: 80000,
      description: 'Builds software',
    });

    expect(pos.title).toBe('Software Engineer');
    expect(pos.departmentId).toBe(departmentId);
    expect(parseFloat(pos.minSalary)).toBe(50000);
    expect(parseFloat(pos.maxSalary)).toBe(80000);
  });

  it('rejects duplicate title in same department (case insensitive)', async () => {
    await positionService.create({
      title: 'Manager',
      departmentId,
      minSalary: 60000,
      maxSalary: 90000,
    });

    await expect(
      positionService.create({
        title: 'MANAGER',
        departmentId,
        minSalary: 65000,
        maxSalary: 95000,
      })
    ).rejects.toThrow(/already exists in this department/i);
  });

  it('allows same title in different departments', async () => {
    await positionService.create({
      title: 'Manager',
      departmentId,
      minSalary: 60000,
      maxSalary: 90000,
    });

    const pos2 = await positionService.create({
      title: 'Manager',
      departmentId: departmentId2,
      minSalary: 55000,
      maxSalary: 85000,
    });

    expect(pos2.title).toBe('Manager');
    expect(pos2.departmentId).toBe(departmentId2);
  });

  it('rejects non-existent department', async () => {
    await expect(
      positionService.create({
        title: 'Ghost Position',
        departmentId: 999999,
        minSalary: 40000,
        maxSalary: 60000,
      })
    ).rejects.toThrow(/Department not found/i);
  });
});

describe('position.service - getAll', () => {
  it('returns paginated positions', async () => {
    await positionService.create({ title: 'Developer', departmentId, minSalary: 50000, maxSalary: 80000 });
    await positionService.create({ title: 'Designer', departmentId, minSalary: 45000, maxSalary: 70000 });

    const result = await positionService.getAll({ page: 1, limit: 10 });

    expect(result.positions).toHaveLength(2);
    expect(result.pagination.totalItems).toBe(2);
  });

  it('includes department info', async () => {
    await positionService.create({ title: 'Analyst', departmentId, minSalary: 40000, maxSalary: 60000 });

    const result = await positionService.getAll({});

    expect(result.positions[0].department).toBeDefined();
    expect(result.positions[0].department.name).toBe('Engineering');
  });

  it('searches by title', async () => {
    await positionService.create({ title: 'Senior Developer', departmentId, minSalary: 70000, maxSalary: 100000 });
    await positionService.create({ title: 'Junior Developer', departmentId, minSalary: 35000, maxSalary: 55000 });
    await positionService.create({ title: 'Manager', departmentId, minSalary: 80000, maxSalary: 120000 });

    const result = await positionService.getAll({ search: 'Developer' });

    expect(result.positions).toHaveLength(2);
  });

  it('filters by department', async () => {
    await positionService.create({ title: 'Engineer', departmentId, minSalary: 50000, maxSalary: 80000 });
    await positionService.create({ title: 'Sales Rep', departmentId: departmentId2, minSalary: 35000, maxSalary: 55000 });

    const result = await positionService.getAll({ departmentId });

    expect(result.positions).toHaveLength(1);
    expect(result.positions[0].title).toBe('Engineer');
  });

  it('paginates correctly', async () => {
    for (let i = 0; i < 5; i++) {
      await positionService.create({ title: `Position ${i}`, departmentId, minSalary: 40000, maxSalary: 60000 });
    }

    const result = await positionService.getAll({ page: 1, limit: 2 });

    expect(result.positions).toHaveLength(2);
    expect(result.pagination.totalItems).toBe(5);
    expect(result.pagination.hasNextPage).toBe(true);
  });
});

describe('position.service - getById', () => {
  it('returns position with department and employees', async () => {
    const pos = await positionService.create({
      title: 'Team Lead',
      departmentId,
      minSalary: 70000,
      maxSalary: 100000,
    });

    const role = await Role.findOne({ where: { slug: 'employee' } });
    const user = await User.create({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@test.local',
      password: 'hashed',
      roleId: role.id,
    });

    await Employee.create({
      employeeNo: 'EMP001',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@test.local',
      hireDate: new Date(),
      departmentId,
      positionId: pos.id,
      salary: 85000,
      employmentType: 'full-time',
      userId: user.id,
    });

    const result = await positionService.getById(pos.id);

    expect(result.title).toBe('Team Lead');
    expect(result.department).toBeDefined();
    expect(result.employees).toHaveLength(1);
  });

  it('throws for non-existent position', async () => {
    await expect(positionService.getById(999999)).rejects.toThrow(/not found/i);
  });
});

describe('position.service - update', () => {
  it('updates position fields', async () => {
    const pos = await positionService.create({
      title: 'Coordinator',
      departmentId,
      minSalary: 35000,
      maxSalary: 50000,
    });

    const updated = await positionService.update(pos.id, {
      minSalary: 40000,
      maxSalary: 55000,
      description: 'Updated description',
    });

    expect(parseFloat(updated.minSalary)).toBe(40000);
    expect(parseFloat(updated.maxSalary)).toBe(55000);
    expect(updated.description).toBe('Updated description');
  });

  it('allows moving position to another department', async () => {
    const pos = await positionService.create({
      title: 'Specialist',
      departmentId,
      minSalary: 45000,
      maxSalary: 65000,
    });

    const updated = await positionService.update(pos.id, {
      departmentId: departmentId2,
    });

    expect(updated.departmentId).toBe(departmentId2);
  });

  it('rejects duplicate title in target department', async () => {
    await positionService.create({ title: 'Consultant', departmentId, minSalary: 60000, maxSalary: 90000 });
    const pos2 = await positionService.create({ title: 'Advisor', departmentId, minSalary: 55000, maxSalary: 85000 });

    await expect(
      positionService.update(pos2.id, { title: 'Consultant' })
    ).rejects.toThrow(/already exists in this department/i);
  });

  it('rejects duplicate when moving to department with same title', async () => {
    await positionService.create({ title: 'Director', departmentId, minSalary: 90000, maxSalary: 130000 });
    const pos2 = await positionService.create({ title: 'Director', departmentId: departmentId2, minSalary: 85000, maxSalary: 120000 });

    await expect(
      positionService.update(pos2.id, { departmentId })
    ).rejects.toThrow(/already exists in this department/i);
  });

  it('allows updating to same title in same department', async () => {
    const pos = await positionService.create({
      title: 'Associate',
      departmentId,
      minSalary: 38000,
      maxSalary: 55000,
    });

    const updated = await positionService.update(pos.id, {
      title: 'ASSOCIATE',
      minSalary: 42000,
      maxSalary: 60000,
    });

    expect(parseFloat(updated.minSalary)).toBe(42000);
    expect(parseFloat(updated.maxSalary)).toBe(60000);
  });

  it('rejects non-existent department', async () => {
    const pos = await positionService.create({ title: 'Temp', departmentId, minSalary: 30000, maxSalary: 45000 });

    await expect(
      positionService.update(pos.id, { departmentId: 999999 })
    ).rejects.toThrow(/Department not found/i);
  });

  it('throws for non-existent position', async () => {
    await expect(
      positionService.update(999999, { minSalary: 40000 })
    ).rejects.toThrow(/not found/i);
  });
});

describe('position.service - delete', () => {
  it('deletes a position with no employees', async () => {
    const pos = await positionService.create({ title: 'Temp Position', departmentId, minSalary: 28000, maxSalary: 40000 });

    await positionService.delete(pos.id);

    const count = await Position.count({ where: { id: pos.id } });
    expect(count).toBe(0);
  });

  it('rejects deleting position with employees', async () => {
    const pos = await positionService.create({ title: 'Staff', departmentId, minSalary: 35000, maxSalary: 50000 });

    const role = await Role.findOne({ where: { slug: 'employee' } });
    const user = await User.create({
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@test.local',
      password: 'hashed',
      roleId: role.id,
    });

    await Employee.create({
      employeeNo: 'EMP002',
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@test.local',
      hireDate: new Date(),
      departmentId,
      positionId: pos.id,
      salary: 42000,
      employmentType: 'full-time',
      userId: user.id,
    });

    await expect(positionService.delete(pos.id)).rejects.toThrow(/with employees/i);
  });

  it('throws for non-existent position', async () => {
    await expect(positionService.delete(999999)).rejects.toThrow(/not found/i);
  });
});
