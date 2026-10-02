import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

process.env.DB_DIALECT = 'sqlite';
process.env.DB_STORAGE = ':memory:';

const models = require('../../../src/models');
const { sequelize, Department, Position, Employee, Role, User } = models;
const departmentService = require('../../../src/services/hrms/department.service');

beforeAll(async () => {
  await sequelize.sync({ force: true });

  // Create role for employee
  await Role.create({ name: 'Employee', slug: 'employee' });
});

afterAll(async () => {
  await sequelize.close();
});

beforeEach(async () => {
  await Employee.destroy({ where: {}, force: true });
  await Position.destroy({ where: {}, force: true });
  await Department.destroy({ where: {}, force: true });
});

describe('department.service - create', () => {
  it('creates a new department', async () => {
    const dept = await departmentService.create({
      name: 'Engineering',
      description: 'Tech team',
    });

    expect(dept.name).toBe('Engineering');
    expect(dept.description).toBe('Tech team');
  });

  it('rejects duplicate department name (case insensitive)', async () => {
    await departmentService.create({ name: 'Sales' });

    await expect(
      departmentService.create({ name: 'SALES' })
    ).rejects.toThrow(/already exists/i);
  });
});

describe('department.service - getAll', () => {
  it('returns paginated departments', async () => {
    await departmentService.create({ name: 'HR' });
    await departmentService.create({ name: 'Finance' });

    const result = await departmentService.getAll({ page: 1, limit: 10 });

    expect(result.departments).toHaveLength(2);
    expect(result.pagination.totalItems).toBe(2);
  });

  it('includes position count', async () => {
    const dept = await departmentService.create({ name: 'IT' });
    await Position.create({
      title: 'Developer',
      departmentId: dept.id,
      baseSalary: 50000,
    });

    const result = await departmentService.getAll({});

    expect(result.departments[0].positionCount).toBe(1);
  });

  it('searches by name', async () => {
    await departmentService.create({ name: 'Marketing' });
    await departmentService.create({ name: 'Operations' });

    const result = await departmentService.getAll({ search: 'Market' });

    expect(result.departments).toHaveLength(1);
    expect(result.departments[0].name).toBe('Marketing');
  });

  it('paginates correctly', async () => {
    for (let i = 0; i < 5; i++) {
      await departmentService.create({ name: `Dept ${i}` });
    }

    const result = await departmentService.getAll({ page: 1, limit: 2 });

    expect(result.departments).toHaveLength(2);
    expect(result.pagination.totalItems).toBe(5);
    expect(result.pagination.hasNextPage).toBe(true);
  });
});

describe('department.service - getById', () => {
  it('returns department with positions and employees', async () => {
    const dept = await departmentService.create({ name: 'Admin' });
    await Position.create({
      title: 'Admin Staff',
      departmentId: dept.id,
      baseSalary: 30000,
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
      departmentId: dept.id,
      salary: 30000,
      employmentType: 'full-time',
      userId: user.id,
    });

    const result = await departmentService.getById(dept.id);

    expect(result.name).toBe('Admin');
    expect(result.positions).toHaveLength(1);
    expect(result.employees).toHaveLength(1);
  });

  it('throws for non-existent department', async () => {
    await expect(departmentService.getById(999999)).rejects.toThrow(/not found/i);
  });
});

describe('department.service - update', () => {
  it('updates department fields', async () => {
    const dept = await departmentService.create({ name: 'Legal' });

    const updated = await departmentService.update(dept.id, {
      description: 'Legal Affairs Department',
    });

    expect(updated.description).toBe('Legal Affairs Department');
  });

  it('rejects duplicate name on update', async () => {
    const dept1 = await departmentService.create({ name: 'Support' });
    await departmentService.create({ name: 'Logistics' });

    await expect(
      departmentService.update(dept1.id, { name: 'Logistics' })
    ).rejects.toThrow(/already exists/i);
  });

  it('allows updating to same name (case insensitive)', async () => {
    const dept = await departmentService.create({ name: 'Training' });

    const updated = await departmentService.update(dept.id, {
      name: 'TRAINING',
      description: 'Updated',
    });

    expect(updated.description).toBe('Updated');
  });

  it('throws for non-existent department', async () => {
    await expect(
      departmentService.update(999999, { name: 'Ghost' })
    ).rejects.toThrow(/not found/i);
  });
});

describe('department.service - delete', () => {
  it('deletes an empty department', async () => {
    const dept = await departmentService.create({ name: 'Temp' });

    await departmentService.delete(dept.id);

    const count = await Department.count({ where: { id: dept.id } });
    expect(count).toBe(0);
  });

  it('rejects deleting department with employees', async () => {
    const dept = await departmentService.create({ name: 'Sales' });

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
      departmentId: dept.id,
      salary: 40000,
      employmentType: 'full-time',
      userId: user.id,
    });

    await expect(departmentService.delete(dept.id)).rejects.toThrow(/with employees/i);
  });

  it('rejects deleting department with positions', async () => {
    const dept = await departmentService.create({ name: 'Research' });

    await Position.create({
      title: 'Researcher',
      departmentId: dept.id,
      baseSalary: 60000,
    });

    await expect(departmentService.delete(dept.id)).rejects.toThrow(/with positions/i);
  });

  it('throws for non-existent department', async () => {
    await expect(departmentService.delete(999999)).rejects.toThrow(/not found/i);
  });
});
