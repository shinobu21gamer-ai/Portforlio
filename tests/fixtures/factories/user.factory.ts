// User Factory
import { faker } from '@faker-js/faker';
import bcrypt from 'bcryptjs';
import type { Sequelize } from 'sequelize';

export const UserFactory = {
  /**
   * Build a user object (not persisted)
   */
  build: (overrides: Record<string, any> = {}) => ({
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    email: faker.internet.email().toLowerCase(),
    password: 'password123',
    roleId: 1,
    branchId: null,
    isActive: true,
    ...overrides,
  }),

  /**
   * Create and persist a user
   */
  create: async (db: Sequelize, overrides: Record<string, any> = {}) => {
    const { Role, User } = db.models;
    const hashedPassword = await bcrypt.hash('password123', 10);
    
    let roleId = overrides.roleId;
    if (!roleId && overrides.roleSlug) {
      const role = await Role.findOne({ where: { slug: overrides.roleSlug } });
      if (role) roleId = role.id;
    }

    return User.create({
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      email: faker.internet.email().toLowerCase(),
      password: hashedPassword,
      roleId: roleId || 1,
      branchId: null,
      isActive: true,
      ...overrides,
    });
  },

  /**
   * Create an admin user
   */
  createAdmin: async (db: Sequelize, overrides: Record<string, any> = {}) => {
    const { Role } = db.models;
    const adminRole = await Role.findOne({ where: { slug: 'admin' } });
    if (!adminRole) throw new Error('Admin role not found');
    
    return UserFactory.create(db, { roleId: adminRole.id, ...overrides });
  },

  /**
   * Create a cashier user
   */
  createCashier: async (db: Sequelize, branchId?: number, overrides: Record<string, any> = {}) => {
    const { Role } = db.models;
    const cashierRole = await Role.findOne({ where: { slug: 'cashier' } });
    if (!cashierRole) throw new Error('Cashier role not found');
    
    return UserFactory.create(db, { roleId: cashierRole.id, branchId, ...overrides });
  },

  /**
   * Create an HR user
   */
  createHR: async (db: Sequelize, overrides: Record<string, any> = {}) => {
    const { Role } = db.models;
    const hrRole = await Role.findOne({ where: { slug: 'hr' } });
    if (!hrRole) throw new Error('HR role not found');
    
    return UserFactory.create(db, { roleId: hrRole.id, ...overrides });
  },

  /**
   * Create an employee user
   */
  createEmployee: async (db: Sequelize, overrides: Record<string, any> = {}) => {
    const { Role } = db.models;
    const empRole = await Role.findOne({ where: { slug: 'employee' } });
    if (!empRole) throw new Error('Employee role not found');
    
    return UserFactory.create(db, { roleId: empRole.id, ...overrides });
  },

  /**
   * Create an inventory staff user
   */
  createInventoryStaff: async (db: Sequelize, branchId?: number, overrides: Record<string, any> = {}) => {
    const { Role } = db.models;
    const invRole = await Role.findOne({ where: { slug: 'inventory_staff' } });
    if (!invRole) throw new Error('Inventory Staff role not found');
    
    return UserFactory.create(db, { roleId: invRole.id, branchId, ...overrides });
  },

  /**
   * Create multiple users with different roles
   */
  createRoleSet: async (db: Sequelize) => {
    const [admin, cashier, hr, employee, inventory] = await Promise.all([
      UserFactory.createAdmin(db),
      UserFactory.createCashier(db),
      UserFactory.createHR(db),
      UserFactory.createEmployee(db),
      UserFactory.createInventoryStaff(db),
    ]);

    return { admin, cashier, hr, employee, inventory };
  },
};