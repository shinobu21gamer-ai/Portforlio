// Product Factory
import { faker } from '@faker-js/faker';
import type { Sequelize } from 'sequelize';

export const ProductFactory = {
  /**
   * Build a product object (not persisted)
   */
  build: (overrides: Record<string, any> = {}) => ({
    name: faker.commerce.productName(),
    sku: `SKU-${faker.string.alphanumeric(8).toUpperCase()}`,
    barcode: faker.string.numeric(13),
    categoryId: 1,
    buyingPrice: parseFloat(faker.commerce.price({ min: 10, max: 500, dec: 2 })),
    sellingPrice: parseFloat(faker.commerce.price({ min: 15, max: 1000, dec: 2 })),
    stockQuantity: faker.number.int({ min: 0, max: 500 }),
    reorderLevel: 10,
    unit: 'pcs',
    isActive: true,
    ...overrides,
  }),

  /**
   * Create and persist a product
   */
  create: async (db: Sequelize, overrides: Record<string, any> = {}) => {
    const { Product, Category } = db.models;
    
    let categoryId = overrides.categoryId;
    if (!categoryId) {
      // Create a default category if needed
      let category = await db.models.Category.findOne({ where: { slug: 'test-category' } });
      if (!category) {
        category = await db.models.Category.create({
          name: 'Test Category',
          slug: 'test-category',
          description: 'Test category',
          isActive: true,
        });
      }
      categoryId = category.id;
    }

    return Product.create({
      name: faker.commerce.productName(),
      sku: `SKU-${faker.string.alphanumeric(8).toUpperCase()}`,
      barcode: faker.string.numeric(13),
      categoryId,
      buyingPrice: parseFloat(faker.commerce.price({ min: 10, max: 500, dec: 2 })),
      sellingPrice: parseFloat(faker.commerce.price({ min: 15, max: 1000, dec: 2 })),
      stockQuantity: faker.number.int({ min: 0, max: 500 }),
      reorderLevel: 10,
      unit: 'pcs',
      isActive: true,
      ...overrides,
    });
  },

  /**
   * Create a low stock product
   */
  createLowStock: async (db: Sequelize, categoryId: number, overrides: Record<string, any> = {}) => {
    return ProductFactory.create(db, {
      categoryId,
      stockQuantity: 5,
      reorderLevel: 10,
      ...overrides,
    });
  },

  /**
   * Create an out of stock product
   */
  createOutOfStock: async (db: Sequelize, categoryId: number, overrides: Record<string, any> = {}) => {
    return ProductFactory.create(db, {
      categoryId,
      stockQuantity: 0,
      reorderLevel: 10,
      ...overrides,
    });
  },

  /**
   * Create multiple products
   */
  createMany: async (db: Sequelize, count: number, categoryId: number, overrides: Record<string, any> = {}) => {
    const products = [];
    for (let i = 0; i < count; i++) {
      products.push(await ProductFactory.create(db, { categoryId, ...overrides }));
    }
    return products;
  },

  /**
   * Create products with specific prices for VAT testing
   */
  createForVATTesting: async (db: Sequelize, categoryId: number) => {
    const products = await Promise.all([
      ProductFactory.create(db, { categoryId, name: 'VAT Standard', sellingPrice: 1000.00, buyingPrice: 500.00 }),
      ProductFactory.create(db, { categoryId, name: 'VAT Zero Rated', sellingPrice: 500.00, buyingPrice: 250.00, isVatExempt: true }),
      ProductFactory.create(db, { categoryId, name: 'VAT Exempt', sellingPrice: 200.00, buyingPrice: 100.00, isVatExempt: true }),
    ]);
    return products;
  },
};