import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

process.env.DB_DIALECT = 'sqlite';
process.env.DB_STORAGE = ':memory:';

const models = require('../../../src/models');
const { sequelize, Employee, Department, Position, Role, User, Contract, ShiftAssignment, Notification } = models;
const employeeService = require('../../../src/services/hrms/employee.service');

let departmentId;
let positionId;
let roleId;
let employeeId;

beforeAll(async () => {
  await sequelize.sync({ force: true });

  const role = await Role.create({ name: 'Employee', slug: 'employee' });
  roleId = role.id;

  const dept = await Department.create({ name: 'Operations' });
  departmentId = dept.id;

  const pos = await Position.create({
    title: 'Staff',
    departmentId: departmentId,
    minSalary: 30000,
    maxSalary: 50000,
  });
  positionId = pos.id;

  // Create POS roles for testing
  await Role.create({ name: 'Cashier', slug: 'cashier' });
  await Role.create({ name: 'Manager', slug: 'manager' });
  await Role.create({ name: 'Inventory Staff', slug: 'inventory_staff' });
});

afterAll(async () => {
  await sequelize.close();
});

beforeEach(async () => {
  await Employee.destroy({ where: {}, force: true });
  await User.destroy({ where: {}, force: true });
});

describe('employee.service - create', () => {
  it('creates a new employee with pending status', async () => {
    const emp = await employeeService.create({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@test.local',
      hireDate: new Date(),
      departmentId,
      positionId,
      salary: 40000,
      paymentFrequency: 'monthly',
      employmentType: 'full-time',
    });

    expect(emp.firstName).toBe('John');
    expect(emp.status).toBe('pending');
    expect(emp.employeeNo).toBeDefined();
    expect(emp.userId).toBeDefined();
  });

  it('generates unique employee numbers', async () => {
    const emp1 = await employeeService.create({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john1@test.local',
      hireDate: new Date(),
      departmentId,
      positionId,
      salary: 40000,
      paymentFrequency: 'monthly',
      employmentType: 'full-time',
    });

    const emp2 = await employeeService.create({
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane1@test.local',
      hireDate: new Date(),
      departmentId,
      positionId,
      salary: 45000,
      paymentFrequency: 'monthly',
      employmentType: 'full-time',
    });

    expect(emp1.employeeNo).not.toBe(emp2.employeeNo);
  });

  it('creates user account with temporary password', async () => {
    const emp = await employeeService.create({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@test.local',
      hireDate: new Date(),
      departmentId,
      positionId,
      salary: 40000,
      paymentFrequency: 'monthly',
      employmentType: 'full-time',
    });

    const user = await User.findByPk(emp.userId);
    expect(user).toBeDefined();
    expect(user.email).toBe('john@test.local');
    expect(user.isActive).toBe(false);
  });

  it('rejects duplicate email', async () => {
    await employeeService.create({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@test.local',
      hireDate: new Date(),
      departmentId,
      positionId,
      salary: 40000,
      paymentFrequency: 'monthly',
      employmentType: 'full-time',
    });

    await expect(
      employeeService.create({
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'john@test.local',
        hireDate: new Date(),
        departmentId,
        positionId,
        salary: 45000,
        paymentFrequency: 'monthly',
        employmentType: 'full-time',
      })
    ).rejects.toThrow(/already exists/i);
  });

  it('rejects invalid department', async () => {
    await expect(
      employeeService.create({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@test.local',
        hireDate: new Date(),
        departmentId: 999999,
        positionId,
        salary: 40000,
        paymentFrequency: 'monthly',
        employmentType: 'full-time',
      })
    ).rejects.toThrow(/not found/i);
  });

  it('rejects invalid position', async () => {
    await expect(
      employeeService.create({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@test.local',
        hireDate: new Date(),
        departmentId,
        positionId: 999999,
        salary: 40000,
        paymentFrequency: 'monthly',
        employmentType: 'full-time',
      })
    ).rejects.toThrow(/not found/i);
  });
});

describe('employee.service - getAll', () => {
  beforeEach(async () => {
    employeeId = (await employeeService.create({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@test.local',
      hireDate: new Date(),
      departmentId,
      positionId,
      salary: 40000,
      paymentFrequency: 'monthly',
      employmentType: 'full-time',
    })).id;
  });

  it('returns paginated employees', async () => {
    const result = await employeeService.getAll({ page: 1, limit: 10 });

    expect(result.employees).toHaveLength(1);
    expect(result.pagination.totalItems).toBe(1);
  });

  it('filters by status', async () => {
    const result = await employeeService.getAll({ status: 'pending' });

    expect(result.employees).toHaveLength(1);
    expect(result.employees[0].status).toBe('pending');
  });

  it('filters by department', async () => {
    const result = await employeeService.getAll({ departmentId });

    expect(result.employees).toHaveLength(1);
  });

  it('searches by name', async () => {
    const result = await employeeService.getAll({ search: 'John' });

    expect(result.employees).toHaveLength(1);
  });

  it('searches by email', async () => {
    const result = await employeeService.getAll({ search: 'john@test' });

    expect(result.employees).toHaveLength(1);
  });

  it('includes department and position info', async () => {
    const result = await employeeService.getAll({});

    expect(result.employees[0].department).toBeDefined();
    expect(result.employees[0].position).toBeDefined();
  });
});

describe('employee.service - getById', () => {
  beforeEach(async () => {
    employeeId = (await employeeService.create({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@test.local',
      hireDate: new Date(),
      departmentId,
      positionId,
      salary: 40000,
      paymentFrequency: 'monthly',
      employmentType: 'full-time',
    })).id;
  });

  it('returns employee with details', async () => {
    const emp = await employeeService.getById(employeeId);

    expect(emp.id).toBe(employeeId);
    expect(emp.firstName).toBe('John');
    expect(emp.department).toBeDefined();
  });

  it('throws for non-existent employee', async () => {
    await expect(employeeService.getById(999999)).rejects.toThrow(/not found/i);
  });
});

describe('employee.service - update', () => {
  beforeEach(async () => {
    employeeId = (await employeeService.create({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@test.local',
      hireDate: new Date(),
      departmentId,
      positionId,
      salary: 40000,
      paymentFrequency: 'monthly',
      employmentType: 'full-time',
    })).id;
  });

  it('updates employee information', async () => {
    const updated = await employeeService.update(employeeId, {
      firstName: 'Jane',
      salary: 45000,
    });

    expect(updated.firstName).toBe('Jane');
    expect(parseFloat(updated.salary)).toBe(45000);
  });

  it('updates active contract when salary changes', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const startDate = tomorrow.toISOString().split('T')[0];

    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    const endDate = nextYear.toISOString().split('T')[0];

    // Approve employee first
    await employeeService.approve(employeeId);

    // Create active contract
    const contract = await Contract.create({
      employeeId,
      contractType: 'regular',
      startDate,
      endDate,
      salary: 40000,
      status: 'active',
    });

    const updated = await employeeService.update(employeeId, { salary: 50000 });

    const updatedContract = await Contract.findByPk(contract.id);
    expect(parseFloat(updatedContract.salary)).toBe(50000);
  });

  it('throws for non-existent employee', async () => {
    await expect(employeeService.update(999999, { firstName: 'Test' })).rejects.toThrow(/not found/i);
  });
});

describe('employee.service - approve', () => {
  beforeEach(async () => {
    employeeId = (await employeeService.create({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@test.local',
      hireDate: new Date(),
      departmentId,
      positionId,
      salary: 40000,
      paymentFrequency: 'monthly',
      employmentType: 'full-time',
    })).id;
  });

  it('approves pending employee and activates user', async () => {
    const { employee: emp, tempPassword } = await employeeService.approve(employeeId);

    expect(emp.status).toBe('active');
    expect(emp.approvedAt).toBeDefined();

    const user = await User.findByPk(emp.userId);
    expect(user.isActive).toBe(true);
    // Phase 4: approve issues a generated one-time password (never the old
    // fixed 'employee123') and forces a change at first login.
    expect(tempPassword).toBeTruthy();
    expect(tempPassword).not.toBe('employee123');
    expect(user.mustChangePassword).toBe(true);
  });

  it('throws for non-existent employee', async () => {
    await expect(employeeService.approve(999999)).rejects.toThrow(/not found/i);
  });
});

describe('employee.service - reject', () => {
  beforeEach(async () => {
    employeeId = (await employeeService.create({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@test.local',
      hireDate: new Date(),
      departmentId,
      positionId,
      salary: 40000,
      paymentFrequency: 'monthly',
      employmentType: 'full-time',
    })).id;
  });

  it('rejects pending employee and deactivates user', async () => {
    const emp = await employeeService.reject(employeeId);

    expect(emp.status).toBe('inactive');

    const user = await User.findByPk(emp.userId);
    expect(user.isActive).toBe(false);
  });

  it('throws for non-existent employee', async () => {
    await expect(employeeService.reject(999999)).rejects.toThrow(/not found/i);
  });
});

describe('employee.service - terminate', () => {
  beforeEach(async () => {
    employeeId = (await employeeService.create({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@test.local',
      hireDate: new Date(),
      departmentId,
      positionId,
      salary: 40000,
      paymentFrequency: 'monthly',
      employmentType: 'full-time',
    })).id;

    // Approve employee first
    await employeeService.approve(employeeId);
  });

  it('terminates active employee', async () => {
    const result = await employeeService.terminate(employeeId);

    expect(result.message).toContain('terminated');

    const emp = await Employee.findByPk(employeeId);
    expect(emp.status).toBe('inactive');
    expect(emp.terminationType).toBe('end-of-contract');
    expect(emp.terminationDate).toBeDefined();
  });

  it('terminates active contracts', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const startDate = tomorrow.toISOString().split('T')[0];

    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    const endDate = nextYear.toISOString().split('T')[0];

    await Contract.create({
      employeeId,
      contractType: 'regular',
      startDate,
      endDate,
      salary: 40000,
      status: 'active',
    });

    await employeeService.terminate(employeeId);

    const contract = await Contract.findOne({ where: { employeeId } });
    expect(contract.status).toBe('terminated');
  });

  it('deactivates user account', async () => {
    await employeeService.terminate(employeeId);

    const user = await User.findByPk((await Employee.findByPk(employeeId)).userId);
    expect(user.isActive).toBe(false);
  });

  it('throws for already terminated employee', async () => {
    await employeeService.terminate(employeeId);

    await expect(employeeService.terminate(employeeId)).rejects.toThrow(/already terminated/i);
  });

  it('throws for non-existent employee', async () => {
    await expect(employeeService.terminate(999999)).rejects.toThrow(/not found/i);
  });
});

describe('employee.service - delete', () => {
  beforeEach(async () => {
    employeeId = (await employeeService.create({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@test.local',
      hireDate: new Date(),
      departmentId,
      positionId,
      salary: 40000,
      paymentFrequency: 'monthly',
      employmentType: 'full-time',
    })).id;
  });

  it('deletes employee record', async () => {
    const result = await employeeService.delete(employeeId);

    expect(result.message).toContain('deleted');

    const emp = await Employee.findByPk(employeeId);
    expect(emp).toBeNull();
  });

  it('deactivates user account', async () => {
    const emp = await Employee.findByPk(employeeId);
    const userId = emp.userId;

    await employeeService.delete(employeeId);

    const user = await User.findByPk(userId);
    expect(user.isActive).toBe(false);
  });

  it('throws for non-existent employee', async () => {
    await expect(employeeService.delete(999999)).rejects.toThrow(/not found/i);
  });
});

describe('employee.service - updateProfile', () => {
  beforeEach(async () => {
    employeeId = (await employeeService.create({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@test.local',
      hireDate: new Date(),
      departmentId,
      positionId,
      salary: 40000,
      paymentFrequency: 'monthly',
      employmentType: 'full-time',
    })).id;
  });

  it('updates employee profile information', async () => {
    const emp = await Employee.findByPk(employeeId);
    const updated = await employeeService.updateProfile(emp.userId, {
      phone: '555-1234',
      address: '123 Main St',
      emergencyContactName: 'Jane Doe',
    });

    expect(updated.phone).toBe('555-1234');
    expect(updated.address).toBe('123 Main St');
    expect(updated.emergencyContactName).toBe('Jane Doe');
  });

  it('throws for non-existent user', async () => {
    await expect(employeeService.updateProfile(999999, { phone: '555-1234' })).rejects.toThrow(/not found/i);
  });
});

describe('employee.service - assignPosAccess', () => {
  beforeEach(async () => {
    employeeId = (await employeeService.create({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@test.local',
      hireDate: new Date(),
      departmentId,
      positionId,
      salary: 40000,
      paymentFrequency: 'monthly',
      employmentType: 'full-time',
    })).id;

    // Approve employee to have user account
    await employeeService.approve(employeeId);
  });

  it('assigns POS role to employee', async () => {
    const emp = await employeeService.assignPosAccess(employeeId, { roleSlug: 'cashier' });

    const user = await User.findByPk(emp.userId);
    const role = await Role.findByPk(user.roleId);

    expect(role.slug).toBe('cashier');
  });

  it('accepts valid POS roles', async () => {
    for (const roleSlug of ['cashier', 'manager', 'inventory_staff']) {
      const emp = await employeeService.assignPosAccess(employeeId, { roleSlug });
      const user = await User.findByPk(emp.userId);
      const role = await Role.findByPk(user.roleId);
      expect(role.slug).toBe(roleSlug);
    }
  });

  it('rejects invalid POS role', async () => {
    await expect(employeeService.assignPosAccess(employeeId, { roleSlug: 'invalid' })).rejects.toThrow(/invalid/i);
  });

  it('throws for non-existent employee', async () => {
    await expect(employeeService.assignPosAccess(999999, { roleSlug: 'cashier' })).rejects.toThrow(/not found/i);
  });
});

describe('employee.service - revokePosAccess', () => {
  beforeEach(async () => {
    employeeId = (await employeeService.create({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@test.local',
      hireDate: new Date(),
      departmentId,
      positionId,
      salary: 40000,
      paymentFrequency: 'monthly',
      employmentType: 'full-time',
    })).id;

    // Approve employee
    await employeeService.approve(employeeId);

    // Assign POS access
    await employeeService.assignPosAccess(employeeId, { roleSlug: 'cashier' });
  });

  it('revokes POS access from employee', async () => {
    const emp = await employeeService.revokePosAccess(employeeId);

    const user = await User.findByPk(emp.userId);
    const role = await Role.findByPk(user.roleId);

    expect(role.slug).toBe('employee');
  });

  it('throws for non-existent employee', async () => {
    await expect(employeeService.revokePosAccess(999999)).rejects.toThrow(/not found/i);
  });
});

describe('employee.service - getPosStaff', () => {
  beforeEach(async () => {
    const emp = await employeeService.create({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@test.local',
      hireDate: new Date(),
      departmentId,
      positionId,
      salary: 40000,
      paymentFrequency: 'monthly',
      employmentType: 'full-time',
    });

    // Approve and assign POS role
    await employeeService.approve(emp.id);
    await employeeService.assignPosAccess(emp.id, { roleSlug: 'cashier' });
  });

  it('returns POS staff list', async () => {
    const staff = await employeeService.getPosStaff({});

    expect(staff).toHaveLength(1);
    expect(staff[0].roleSlug).toBe('cashier');
  });
});

describe('employee.service - exportCSV', () => {
  beforeEach(async () => {
    await employeeService.create({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@test.local',
      hireDate: new Date(),
      departmentId,
      positionId,
      salary: 40000,
      paymentFrequency: 'monthly',
      employmentType: 'full-time',
    });
  });

  it('exports employees to CSV format', async () => {
    const csv = await employeeService.exportCSV({});

    expect(csv).toContain('Employee No,First Name,Last Name,Email');
    expect(csv).toContain('John');
    expect(csv).toContain('Doe');
  });
});
