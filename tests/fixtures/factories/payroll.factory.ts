// Payroll Factory
import { faker } from '@faker-js/faker';
import type { Sequelize } from 'sequelize';

export const PayrollFactory = {
  /**
   * Build a payroll object (not persisted)
   */
  build: (overrides: Record<string, any> = {}) => ({
    periodStart: new Date('2024-01-01'),
    periodEnd: new Date('2024-01-15'),
    status: 'draft',
    totalGross: 0,
    totalDeductions: 0,
    totalNet: 0,
    processedBy: null,
    processedAt: null,
    ...overrides,
  }),

  /**
   * Create and persist a payroll
   */
  create: async (db: Sequelize, overrides: Record<string, any> = {}) => {
    const { Payroll, PayrollItem, Employee } = db.models;

    const payroll = await Payroll.create({
      periodStart: new Date('2024-01-01'),
      periodEnd: new Date('2024-01-15'),
      status: 'draft',
      totalGross: 0,
      totalDeductions: 0,
      totalNet: 0,
      processedBy: null,
      processedAt: null,
      ...overrides,
    });

    // Create payroll items for active employees
    const employees = await Employee.findAll({ where: { status: 'active' }, limit: 10 });
    
    let totalGross = 0;
    let totalDeductions = 0;
    let totalNet = 0;

    for (const employee of employees) {
      const basicSalary = parseFloat(employee.basicSalary) || 15000;
      const dailyRate = basicSalary / 26; // Assuming 26 working days
      const daysWorked = 13; // Semi-monthly
      const grossPay = dailyRate * daysWorked;

      // Calculate deductions (simplified)
      const sss = Math.min(grossPay * 0.045, 1350); // 4.5% up to cap
      const philhealth = grossPay * 0.02; // 2% (employee share)
      const pagibig = Math.min(grossPay * 0.02, 100); // 2% up to 100
      const tax = Math.max(0, (grossPay * 12 - 250000) * 0.2 / 12); // Simplified tax
      const totalDeductionsEmp = sss + philhealth + pagibig + tax;
      const netPay = grossPay - totalDeductionsEmp;

      await db.models.PayrollItem.create({
        payrollId: payroll.id,
        employeeId: employee.id,
        basicSalary: employee.basicSalary,
        daysWorked: 13,
        grossPay,
        sss,
        philhealth,
        pagibig,
        tax,
        totalDeductions: totalDeductionsEmp,
        netPay,
      });

      totalGross += grossPay;
      totalDeductions += totalDeductionsEmp;
      totalNet += netPay;
    }

    await payroll.update({
      totalGross,
      totalDeductions,
      totalNet,
    });

    return payroll;
  },

  /**
   * Create a processed payroll
   */
  createProcessed: async (db: Sequelize, overrides: Record<string, any> = {}) => {
    const user = await db.models.User.findOne({ where: { isActive: true } });
    if (!user) throw new Error('No user found');

    return PayrollFactory.create(db, {
      status: 'processed',
      processedBy: user.id,
      processedAt: new Date(),
      ...overrides,
    });
  },

  /**
   * Create a paid payroll
   */
  createPaid: async (db: Sequelize, overrides: Record<string, any> = {}) => {
    return PayrollFactory.createProcessed(db, {
      status: 'paid',
      ...overrides,
    });
  },

  /**
   * Create payroll for specific period
   */
  createForPeriod: async (db: Sequelize, periodStart: Date, periodEnd: Date, overrides: Record<string, any> = {}) => {
    return PayrollFactory.create(db, {
      periodStart,
      periodEnd,
      ...overrides,
    });
  },
};