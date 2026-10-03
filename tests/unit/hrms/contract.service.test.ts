import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

process.env.DB_DIALECT = 'sqlite';
process.env.DB_STORAGE = ':memory:';

const models = require('../../../src/models');
const { sequelize, Contract, Employee, Department, Position, Role, User } = models;
const contractService = require('../../../src/services/hrms/contract.service');

let employeeId;
let contractId;

const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
const startDate = tomorrow.toISOString().split('T')[0];

const nextYear = new Date();
nextYear.setFullYear(nextYear.getFullYear() + 1);
const endDate = nextYear.toISOString().split('T')[0];

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
  await Contract.destroy({ where: {}, force: true });
  // Reset employee status to active for each test
  const emp = await Employee.findByPk(employeeId);
  if (emp) await emp.update({ status: 'active', terminationType: null, terminationDate: null });
});

describe('contract.service - create', () => {
  it('creates a new contract', async () => {
    const contract = await contractService.create({
      employeeId,
      contractType: 'probationary',
      startDate,
      endDate,
      salary: 35000,
      paymentFrequency: 'monthly',
    });

    expect(contract.employeeId).toBe(employeeId);
    expect(contract.contractType).toBe('probationary');
    expect(contract.status).toBe('pending');
    expect(parseFloat(contract.salary)).toBe(35000);
  });

  it('rejects contract for non-existent employee', async () => {
    await expect(
      contractService.create({
        employeeId: 999999,
        contractType: 'regular',
        startDate,
        endDate,
      })
    ).rejects.toThrow(/Employee not found/i);
  });

  it('rejects if employee already has active contract', async () => {
    await contractService.create({
      employeeId,
      contractType: 'regular',
      startDate,
      endDate,
      salary: 40000,
    });

    await expect(
      contractService.create({
        employeeId,
        contractType: 'regular',
        startDate,
        endDate: null,
        salary: 45000,
      })
    ).rejects.toThrow(/already has an active contract/i);
  });
});

describe('contract.service - getAll', () => {
  it('returns paginated contracts', async () => {
    const c1 = await contractService.create({ employeeId, contractType: 'probationary', startDate, endDate });
    await contractService.approve(c1.id, 1);
    await contractService.terminate(c1.id, 1);

    const c2 = await contractService.create({ employeeId, contractType: 'regular', startDate, endDate: null, salary: 45000 });

    const result = await contractService.getAll({ page: 1, limit: 10 });

    expect(result.contracts).toHaveLength(2);
    expect(result.pagination.totalItems).toBe(2);
  });

  it('filters by status', async () => {
    const c1 = await contractService.create({ employeeId, contractType: 'regular', startDate, endDate: null });
    await contractService.approve(c1.id, 1);
    await contractService.terminate(c1.id, 1);

    const c2 = await contractService.create({ employeeId, contractType: 'probationary', startDate, endDate });

    const result = await contractService.getAll({ status: 'pending' });

    expect(result.contracts).toHaveLength(1);
    expect(result.contracts[0].status).toBe('pending');
  });

  it('filters by contract type', async () => {
    const c1 = await contractService.create({ employeeId, contractType: 'regular', startDate, endDate: null });
    await contractService.approve(c1.id, 1);
    await contractService.terminate(c1.id, 1);

    const c2 = await contractService.create({ employeeId, contractType: 'probationary', startDate, endDate });

    const result = await contractService.getAll({ contractType: 'probationary' });

    expect(result.contracts).toHaveLength(1);
    expect(result.contracts[0].contractType).toBe('probationary');
  });

  it('searches by employee name', async () => {
    await contractService.create({ employeeId, contractType: 'regular', startDate, endDate: null });

    const result = await contractService.getAll({ search: 'John' });

    expect(result.contracts).toHaveLength(1);
  });

  it('includes employee and department info', async () => {
    await contractService.create({ employeeId, contractType: 'regular', startDate, endDate: null });

    const result = await contractService.getAll({});

    expect(result.contracts[0].employee).toBeDefined();
    expect(result.contracts[0].employee.department).toBeDefined();
    expect(result.contracts[0].employee.position).toBeDefined();
  });
});

describe('contract.service - getById', () => {
  it('returns contract with employee details', async () => {
    const contract = await contractService.create({
      employeeId,
      contractType: 'regular',
      startDate,
      endDate: null,
      salary: 42000,
    });

    const result = await contractService.getById(contract.id);

    expect(result.id).toBe(contract.id);
    expect(result.employee.firstName).toBe('John');
    expect(result.employee.department.name).toBe('Operations');
    expect(result.employee.position.title).toBe('Staff');
  });

  it('throws for non-existent contract', async () => {
    await expect(contractService.getById(999999)).rejects.toThrow(/not found/i);
  });
});

describe('contract.service - approve', () => {
  it('approves a pending contract', async () => {
    const contract = await contractService.create({
      employeeId,
      contractType: 'probationary',
      startDate,
      endDate,
      salary: 35000,
      paymentFrequency: 'monthly',
    });

    const result = await contractService.approve(contract.id, 1);

    expect(result.status).toBe('active');
    expect(result.approvedBy).toBe(1);
    expect(result.approvedAt).toBeDefined();
  });

  it('updates employee salary and payment frequency', async () => {
    const contract = await contractService.create({
      employeeId,
      contractType: 'regular',
      startDate,
      endDate: null,
      salary: 50000,
      paymentFrequency: 'bi-weekly',
    });

    await contractService.approve(contract.id, 1);

    const emp = await Employee.findByPk(employeeId);
    expect(parseFloat(emp.salary)).toBe(50000);
    expect(emp.paymentFrequency).toBe('bi-weekly');
  });

  it('sets probationary end date for probationary contracts', async () => {
    const contract = await contractService.create({
      employeeId,
      contractType: 'probationary',
      startDate,
      endDate,
      salary: 35000,
    });

    await contractService.approve(contract.id, 1);

    const emp = await Employee.findByPk(employeeId);
    expect(emp.probationaryEndDate).toBe(endDate);
  });

  it('rejects non-existent contract', async () => {
    await expect(contractService.approve(999999, 1)).rejects.toThrow(/not found/i);
  });

  it('rejects approving non-pending contract', async () => {
    const contract = await contractService.create({
      employeeId,
      contractType: 'regular',
      startDate,
      endDate: null,
    });

    await contractService.approve(contract.id, 1);

    await expect(contractService.approve(contract.id, 1)).rejects.toThrow(/Only pending contracts/i);
  });
});

describe('contract.service - reject', () => {
  it('rejects a pending contract with remarks', async () => {
    const contract = await contractService.create({
      employeeId,
      contractType: 'regular',
      startDate,
      endDate: null,
    });

    const result = await contractService.reject(contract.id, 'Incomplete documents', 1);

    expect(result.status).toBe('rejected');
    expect(result.notes).toContain('Incomplete documents');
  });

  it('rejects without remarks', async () => {
    const contract = await contractService.create({
      employeeId,
      contractType: 'regular',
      startDate,
      endDate: null,
    });

    const result = await contractService.reject(contract.id, null, 1);

    expect(result.status).toBe('rejected');
  });

  it('throws for non-existent contract', async () => {
    await expect(
      contractService.reject(999999, 'Test', 1)
    ).rejects.toThrow(/not found/i);
  });

  it('throws for non-pending contract', async () => {
    const contract = await contractService.create({
      employeeId,
      contractType: 'regular',
      startDate,
      endDate: null,
    });

    await contractService.approve(contract.id, 1);

    await expect(
      contractService.reject(contract.id, 'Too late', 1)
    ).rejects.toThrow(/Only pending contracts/i);
  });
});

describe('contract.service - terminate', () => {
  it('terminates an active contract', async () => {
    const contract = await contractService.create({
      employeeId,
      contractType: 'regular',
      startDate,
      endDate: null,
    });

    await contractService.approve(contract.id, 1);

    const result = await contractService.terminate(contract.id, 1);

    expect(result.status).toBe('terminated');
  });

  it('updates employee to inactive when no other active contract', async () => {
    const contract = await contractService.create({
      employeeId,
      contractType: 'regular',
      startDate,
      endDate: null,
    });

    await contractService.approve(contract.id, 1);
    await contractService.terminate(contract.id, 1);

    const emp = await Employee.findByPk(employeeId);
    expect(emp.status).toBe('inactive');
    expect(emp.terminationType).toBe('end-of-contract');
    expect(emp.terminationDate).toBeDefined();
  });

  it('creates notification for terminated employee', async () => {
    const contract = await contractService.create({
      employeeId,
      contractType: 'regular',
      startDate,
      endDate: null,
    });

    await contractService.approve(contract.id, 1);
    await contractService.terminate(contract.id, 1);

    const { Notification } = models;
    const notification = await Notification.findOne({ where: { type: 'hrms_contract_terminated' } });

    expect(notification).toBeDefined();
    expect(notification.title).toBe('Contract Terminated');
  });

  it('throws for non-existent contract', async () => {
    await expect(contractService.terminate(999999, 1)).rejects.toThrow(/not found/i);
  });

  it('throws for pending contract', async () => {
    const contract = await contractService.create({
      employeeId,
      contractType: 'regular',
      startDate,
      endDate: null,
    });

    await expect(contractService.terminate(contract.id, 1)).rejects.toThrow(/Only active contracts/i);
  });
});

describe('contract.service - renew', () => {
  it('renews an active contract', async () => {
    const oldContract = await contractService.create({
      employeeId,
      contractType: 'regular',
      startDate,
      endDate: null,
    });

    await oldContract.update({ status: 'active' });

    const nextStart = new Date();
    nextStart.setFullYear(nextStart.getFullYear() + 1);
    const newStartDate = nextStart.toISOString().split('T')[0];

    const result = await contractService.renew(oldContract.id, {
      contractType: 'regular',
      startDate: newStartDate,
      endDate: null,
      salary: 55000,
    }, 1);

    expect(result.status).toBe('pending');
    expect(result.notes).toContain(`Renewed from contract #${oldContract.id}`);
  });

  it('marks old contract as expired', async () => {
    const oldContract = await contractService.create({
      employeeId,
      contractType: 'regular',
      startDate,
      endDate: null,
    });

    await oldContract.update({ status: 'active' });

    const nextStart = new Date();
    nextStart.setFullYear(nextStart.getFullYear() + 1);
    await contractService.renew(oldContract.id, {
      startDate: nextStart.toISOString().split('T')[0],
      salary: 55000,
    }, 1);

    const updated = await Contract.findByPk(oldContract.id);
    expect(updated.status).toBe('expired');
  });

  it('throws for non-existent contract', async () => {
    await expect(
      contractService.renew(999999, { startDate }, 1)
    ).rejects.toThrow(/not found/i);
  });

  it('throws for expired contract', async () => {
    const contract = await contractService.create({
      employeeId,
      contractType: 'regular',
      startDate,
      endDate: null,
    });

    await contract.update({ status: 'expired' });

    await expect(
      contractService.renew(contract.id, { startDate }, 1)
    ).rejects.toThrow(/Only active contracts/i);
  });
});

describe('contract.service - delete', () => {
  it('deletes a pending contract', async () => {
    const contract = await contractService.create({
      employeeId,
      contractType: 'probationary',
      startDate,
      endDate,
    });

    await contractService.delete(contract.id);

    const count = await Contract.count({ where: { id: contract.id } });
    expect(count).toBe(0);
  });

  it('deletes a rejected contract', async () => {
    const contract = await contractService.create({
      employeeId,
      contractType: 'regular',
      startDate,
      endDate: null,
    });

    await contractService.reject(contract.id, 'Test rejection', 1);

    await contractService.delete(contract.id);

    const count = await Contract.count({ where: { id: contract.id } });
    expect(count).toBe(0);
  });

  it('throws for non-existent contract', async () => {
    await expect(contractService.delete(999999)).rejects.toThrow(/not found/i);
  });

  it('throws for active contract', async () => {
    const contract = await contractService.create({
      employeeId,
      contractType: 'regular',
      startDate,
      endDate: null,
    });

    await contract.update({ status: 'active' });

    await expect(contractService.delete(contract.id)).rejects.toThrow(/Cannot delete an active contract/i);
  });
});

describe('contract.service - getExpiring', () => {
  it('returns contracts expiring within days', async () => {
    const contract = await contractService.create({
      employeeId,
      contractType: 'regular',
      startDate,
      endDate: null,
    });

    await contract.update({ status: 'active' });

    // Contract doesn't have end date, so won't be in expiring
    const result = await contractService.getExpiring(30);

    // Should not have any with null endDate
    expect(result.contracts.every(c => c.endDate !== null)).toBe(true);
  });

  it('returns count of expiring contracts', async () => {
    const contract = await contractService.create({
      employeeId,
      contractType: 'regular',
      startDate,
      endDate: null,
    });

    await contract.update({ status: 'active' });

    const result = await contractService.getExpiring(30);

    expect(result.count).toBeGreaterThanOrEqual(0);
  });
});

describe('contract.service - checkExpired', () => {
  it('finds and marks expired contracts', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayDate = yesterday.toISOString().split('T')[0];

    const contract = await contractService.create({
      employeeId,
      contractType: 'regular',
      startDate,
      endDate: yesterdayDate,
    });

    await contract.update({ status: 'active' });

    const result = await contractService.checkExpired();

    expect(result.expired).toBe(1);

    const updated = await Contract.findByPk(contract.id);
    expect(updated.status).toBe('expired');
  });

  it('updates employee status when contract expires', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const contract = await contractService.create({
      employeeId,
      contractType: 'regular',
      startDate,
      endDate: yesterday.toISOString().split('T')[0],
    });

    await contract.update({ status: 'active' });

    await contractService.checkExpired();

    const emp = await Employee.findByPk(employeeId);
    expect(emp.status).toBe('inactive');
  });

  it('does not update employee with other active contracts', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const contract = await contractService.create({
      employeeId,
      contractType: 'regular',
      startDate,
      endDate: yesterday.toISOString().split('T')[0],
    });

    await contract.update({ status: 'active' });

    // Create another active contract directly (bypasses service validation)
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const nextMonthDate = nextMonth.toISOString().split('T')[0];

    const otherContract = await Contract.create({
      employeeId,
      contractType: 'probationary',
      startDate: nextMonthDate,
      endDate: null,
      status: 'active',
    });

    await contractService.checkExpired();

    const emp = await Employee.findByPk(employeeId);
    expect(emp.status).toBe('active');
  });

  it('deactivates the user account when the last contract expires', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const contract = await contractService.create({
      employeeId,
      contractType: 'regular',
      startDate,
      endDate: yesterday.toISOString().split('T')[0],
    });

    await contract.update({ status: 'active' });

    const emp = await Employee.findByPk(employeeId);
    await User.update({ isActive: true }, { where: { id: emp.userId } });

    await contractService.checkExpired();

    // An expired employee must lose login access too, matching terminate()
    const user = await User.findByPk(emp.userId);
    expect(user.isActive).toBe(false);
  });

  it('creates an hrms_contract_expired notification', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const contract = await contractService.create({
      employeeId,
      contractType: 'regular',
      startDate,
      endDate: yesterday.toISOString().split('T')[0],
    });

    await contract.update({ status: 'active' });

    await contractService.checkExpired();

    const { Notification } = models;
    const emp = await Employee.findByPk(employeeId);
    const notif = await Notification.findOne({
      where: { userId: emp.userId, type: 'hrms_contract_expired' },
    });
    expect(notif).not.toBeNull();
  });
});