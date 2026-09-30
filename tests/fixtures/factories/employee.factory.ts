// Employee Factory
import { faker } from '@faker-js/faker';
import type { Sequelize } from 'sequelize';

export const EmployeeFactory = {
  /**
   * Build an employee object (not persisted)
   */
  build: (overrides: Record<string, any> = {}) => ({
    employeeNo: `EMP-${faker.string.numeric(4)}`,
    firstName: faker.person.firstName(),
    middleName: '',
    lastName: faker.person.lastName(),
    email: faker.internet.email().toLowerCase(),
    departmentId: 1,
    positionId: 1,
    hireDate: faker.date.past({ years: 5 }),
    employmentType: 'regular',
    basicSalary: parseFloat(faker.commerce.price({ min: 15000, max: 50000, dec: 2 })),
    payFrequency: 'semi-monthly',
    status: 'active',
    ...overrides,
  }),

  /**
   * Create and persist an employee
   */
  create: async (db: Sequelize, overrides: Record<string, any> = {}) => {
    const { Employee, Department, Position } = db.models;

    let departmentId = overrides.departmentId;
    if (!departmentId) {
      let department = await Department.findOne({ where: { slug: 'test-department' } });
      if (!department) {
        department = await Department.create({
          name: 'Test Department',
          slug: 'test-department',
          description: 'Test department',
          isActive: true,
        });
      }
      departmentId = department.id;
    }

    let positionId = overrides.positionId;
    if (!positionId) {
      let position = await db.models.Position.findOne({ where: { slug: 'test-position' } });
      if (!position) {
        position = await db.models.Position.create({
          name: 'Test Position',
          slug: 'test-position',
          description: 'Test position',
          departmentId,
          isActive: true,
        });
      }
      positionId = position.id;
    }

    return Employee.create({
      employeeNo: `EMP-${faker.string.numeric(4)}`,
      firstName: faker.person.firstName(),
      middleName: '',
      lastName: faker.person.lastName(),
      email: faker.internet.email().toLowerCase(),
      departmentId,
      positionId,
      hireDate: faker.date.past({ years: 5 }),
      employmentType: 'regular',
      basicSalary: parseFloat(faker.commerce.price({ min: 15000, max: 50000, dec: 2 })),
      payFrequency: 'semi-monthly',
      status: 'active',
      ...overrides,
    });
  },

  /**
   * Create an employee with user account
   */
  createWithUser: async (db: Sequelize, roleSlug: string = 'employee', overrides: Record<string, any> = {}) => {
    const { Employee, User, Role } = db.models;
    
    const role = await Role.findOne({ where: { slug: roleSlug } });
    if (!role) throw new Error(`Role ${roleSlug} not found`);

    const bcrypt = (await import('bcryptjs')).default;
    const hashedPassword = await bcrypt.hash('password123', 10);

    const user = await User.create({
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      email: faker.internet.email().toLowerCase(),
      password: hashedPassword,
      roleId: role.id,
      isActive: true,
    });

    return Employee.create({
      employeeNo: `EMP-${faker.string.numeric(4)}`,
      firstName: user.firstName,
      middleName: '',
      lastName: user.lastName,
      email: user.email,
      departmentId: overrides.departmentId || 1,
      positionId: overrides.positionId || 1,
      hireDate: faker.date.past({ years: 5 }),
      employmentType: 'regular',
      basicSalary: parseFloat(faker.commerce.price({ min: 15000, max: 50000, dec: 2 })),
      payFrequency: 'semi-monthly',
      status: 'active',
      userId: user.id,
      ...overrides,
    });
  },

  /**
   * Create multiple employees
   */
  createMany: async (db: Sequelize, count: number, overrides: Record<string, any> = {}) => {
    const employees = [];
    for (let i = 0; i < count; i++) {
      employees.push(await EmployeeFactory.create(db, { ...overrides }));
    }
    return employees;
  },

  /**
   * Create employees for different departments
   */
  createForDepartments: async (db: Sequelize, departments: any[]) => {
    const employees = [];
    for (const dept of departments) {
      employees.push(await EmployeeFactory.create(db, { departmentId: dept.id }));
    }
    return employees;
  },
};