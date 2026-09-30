// Sale Factory
import { faker } from '@faker-js/faker';
import type { Sequelize } from 'sequelize';

export const SaleFactory = {
  /**
   * Build a sale object (not persisted)
   */
  build: (overrides: Record<string, any> = {}) => ({
    invoiceNo: `INV-${faker.string.alphanumeric(10).toUpperCase()}`,
    customerId: null,
    userId: 1,
    subtotal: 100.00,
    discountAmount: 0,
    taxAmount: 12.00,
    total: 112.00,
    paymentMethod: 'cash',
    paymentStatus: 'paid',
    status: 'completed',
    ...overrides,
  }),

  /**
   * Create and persist a completed sale
   */
  create: async (db: Sequelize, overrides: Record<string, any> = {}) => {
    const { Sale, SaleItem, Product, User } = db.models;

    // Ensure we have a user
    let userId = overrides.userId;
    if (!userId) {
      const user = await db.models.User.findOne({ where: { isActive: true } });
      if (!user) throw new Error('No active user found');
      userId = user.id;
    }

    // Create sale items if not provided
    let items = overrides.items;
    if (!items) {
      const products = await db.models.Product.findAll({ limit: 3, where: { isActive: true } });
      if (products.length === 0) throw new Error('No products available');
      
      items = products.slice(0, 3).map((product, index) => ({
        productId: product.id,
        quantity: faker.number.int({ min: 1, max: 5 }),
        unitPrice: parseFloat(product.sellingPrice),
        discount: 0,
      }));
    }

    // Calculate totals
    const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const discountAmount = overrides.discountAmount || 0;
    const taxableBase = subtotal - discountAmount;
    const taxAmount = parseFloat((taxableBase * 0.12).toFixed(2));
    const total = parseFloat((taxableBase + taxAmount).toFixed(2));

    const sale = await db.models.Sale.create({
      invoiceNo: `INV-${faker.string.alphanumeric(10).toUpperCase()}`,
      customerId: null,
      userId,
      subtotal: parseFloat(subtotal.toFixed(2)),
      discountAmount: parseFloat(discountAmount.toFixed(2)),
      taxAmount: parseFloat(taxAmount.toFixed(2)),
      total: parseFloat(total.toFixed(2)),
      paymentMethod: 'cash',
      paymentStatus: 'paid',
      status: 'completed',
      ...overrides,
    });

    // Create sale items
    for (const item of items) {
      await SaleItem.create({
        saleId: sale.id,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount || 0,
        total: parseFloat((item.unitPrice * item.quantity).toFixed(2)),
      });
    }

    return sale;
  },

  /**
   * Create a pending sale
   */
  createPending: async (db: Sequelize, overrides: Record<string, any> = {}) => {
    return SaleFactory.create(db, {
      status: 'pending',
      paymentStatus: 'pending',
      paymentMethod: 'cash',
      ...overrides,
    });
  },

  /**
   * Create a sale with specific payment method
   */
  createWithPayment: async (db: Sequelize, paymentMethod: string, overrides: Record<string, any> = {}) => {
    return SaleFactory.create(db, { paymentMethod, ...overrides });
  },

  /**
   * Create a sale with discount
   */
  createWithDiscount: async (db: Sequelize, discountAmount: number, overrides: Record<string, any> = {}) => {
    return SaleFactory.create(db, { discountAmount, ...overrides });
  },

  /**
   * Create a mixed payment sale
   */
  createMixedPayment: async (db: Sequelize, payments: Array<{ method: string; amount: number }>, overrides: Record<string, any> = {}) => {
    const total = payments.reduce((sum, p) => sum + p.amount, 0);
    
    return SaleFactory.create(db, {
      paymentMethod: 'mixed',
      paymentDetails: payments,
      total: total,
      ...overrides,
    });
  },

  /**
   * Create multiple sales for reporting
   */
  createMany: async (db: Sequelize, count: number, overrides: Record<string, any> = {}) => {
    const sales = [];
    for (let i = 0; i < count; i++) {
      sales.push(await SaleFactory.create(db, { ...overrides }));
    }
    return sales;
  },

  /**
   * Create sales across date range for reporting
   */
  createForDateRange: async (db: Sequelize, startDate: Date, endDate: Date, countPerDay: number = 5) => {
    const sales = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      for (let i = 0; i < countPerDay; i++) {
        const sale = await SaleFactory.create(db, {
          createdAt: new Date(currentDate.getTime() + faker.number.int({ min: 0, max: 23 * 60 * 60 * 1000 })),
        });
        sales.push(sale);
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return sales;
  },
};