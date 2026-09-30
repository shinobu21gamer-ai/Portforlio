import { faker } from '@faker-js/faker';
import { UserFactory, CategoryFactory, ProductFactory, BranchFactory, DepartmentFactory, PositionFactory, EmployeeFactory } from './index';

export async function seedComprehensiveTestData(db: any): Promise<any> {
  // Roles
  const adminRole = await db.Role.findOne({ where: { slug: 'admin' } });
  const cashierRole = await db.Role.findOne({ where: { slug: 'cashier' } });
  const employeeRole = await db.Role.findOne({ where: { slug: 'employee' } });
  const hrRole = await db.Role.findOne({ where: { slug: 'hr' } });
  const managerRole = await db.Role.findOne({ where: { slug: 'manager' } });
  const inventoryStaffRole = await db.Role.findOne({ where: { slug: 'inventory_staff' } });

  // Users
  const users = await Promise.all([
    UserFactory.create(db, { email: 'admin@test.com', roleId: adminRole.id }),
    UserFactory.create(db, { email: 'cashier@test.com', roleId: cashierRole.id }),
    UserFactory.create(db, { email: 'employee@test.com', roleId: employeeRole }),
    UserFactory.create(db, { email: 'hr@test.com', roleId: hrRole }),
    UserFactory.create(db, { email: 'manager@test.com', roleId: managerRole }),
    UserFactory.create(db, { email: 'inventory@test.com', roleId: inventoryStaffRole }),
  ]);

  // Branch
  const branch = await BranchFactory.create(db);

  // Categories
  const categories = await Promise.all([
    CategoryFactory.create(db, { name: 'Beverages', slug: 'beverages' }),
    CategoryFactory.create(db, { name: 'Snacks', slug: 'snacks' }),
    CategoryFactory.create(db, { name: 'Personal Care', slug: 'personal-care' }),
    CategoryFactory.create(db, { name: 'Household', slug: 'household' }),
  ]);

  // Products
  const products = await Promise.all(
    categories.flatMap((cat) =>
      Array.from({ length: 5 }).map(() =>
        ProductFactory.create(db, { categoryId: cat.id, stockQuantity: faker.number.int({ min: 0, max: 200 }) })
      )
    )
  );

  // Departments
  const departments = await Promise.all([
    DepartmentFactory.create(db, { name: 'Sales', code: 'SAL' }),
    DepartmentFactory.create(db, { name: 'HR', code: 'HRD' }),
    DepartmentFactory.create(db, { name: 'IT', code: 'ITD' }),
    DepartmentFactory.create(db, { name: 'Finance', code: 'FIN' }),
  ]);

  // Positions
  const positions = await Promise.all(
    departments.flatMap((dept) =>
      Array.from({ length: 3 }).map(() =>
        PositionFactory.create(db, { departmentId: dept.id })
      )
    )
  );

  // Employees
  const employees = await Promise.all(
    Array.from({ length: 10 }).map(() =>
      EmployeeFactory.create(db, {
        departmentId: faker.helpers.arrayElement(departments).id,
        positionId: faker.helpers.arrayElement(positions).id,
      })
    )
  );

  return {
    users,
    branch,
    categories,
    products,
    departments,
    positions,
    employees,
  };
}

export async function seedMinimalTestData(db: any): Promise<any> {
  const adminRole = await db.Role.findOne({ where: { slug: 'admin' } });
  const cashierRole = await db.Role.findOne({ where: { slug: 'cashier' } });

  const admin = await UserFactory.create(db, { email: 'admin@test.com', roleId: adminRole.id });
  const cashier = await UserFactory.create(db, { email: 'cashier@test.com', roleId: cashierRole.id });

  const category = await CategoryFactory.create(db);
  const product = await ProductFactory.create(db, { categoryId: category.id });

  return { admin, cashier, category, product };
}