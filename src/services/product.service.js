const { Product, Category, StockMovement, SaleItem, sequelize } = require('../models');
const { Op, fn, col } = require('sequelize');
const ApiError = require('../utils/ApiError');
const config = require('../config');
const {
  slugify,
  generateSKU,
  generateBarcode,
  getPagination,
  getPaginationMeta,
  sanitizeObject,
  escapeLike,
} = require('../utils/helpers');

class ProductService {
  normalizeValue(value) {
    if (value === null || value === undefined) return null;
    return String(value).trim().replace(/\s+/g, ' ').toLowerCase();
  }

  async findDuplicateProduct({ name, sku, barcode }, excludeId = null) {
    const checks = [];
    const normalizedName = this.normalizeValue(name);
    const normalizedSku = this.normalizeValue(sku);
    const normalizedBarcode = this.normalizeValue(barcode);

    if (normalizedBarcode) {
      checks.push({ field: 'barcode', value: normalizedBarcode });
    }
    if (normalizedSku) {
      checks.push({ field: 'sku', value: normalizedSku });
    }
    if (normalizedName) {
      checks.push({ field: 'name', value: normalizedName });
    }

    if (checks.length === 0) return null;

    for (const check of checks) {
      const where = {
        [Op.and]: [sequelize.where(fn('LOWER', col(check.field)), check.value)],
      };

      if (excludeId) {
        where[Op.and].push({ id: { [Op.ne]: excludeId } });
      }

      const existingProduct = await Product.findOne({ where });
      if (existingProduct) {
        return { field: check.field, product: existingProduct };
      }
    }

    return null;
  }

  async getAll(query) {
    const { page, limit, offset } = getPagination(query.page, query.limit);
    const where = {};

    if (query.search) {
      const safeSearch = escapeLike(query.search);
      where[Op.or] = [
        { name: { [Op.like]: `%${safeSearch}%` } },
        { sku: { [Op.like]: `%${safeSearch}%` } },
        { barcode: { [Op.like]: `%${safeSearch}%` } },
      ];
    }
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.supplierId) where.supplierId = query.supplierId;
    if (query.brand) where.brand = { [Op.like]: `%${escapeLike(query.brand)}%` };
    if (query.isActive !== undefined) where.isActive = query.isActive === 'true';
    if (query.minStockLevel === 'true') {
      where[Op.and] = [
        { stockQuantity: { [Op.ne]: null } },
        { minStockLevel: { [Op.ne]: null } },
        { stockQuantity: { [Op.lte]: { [Op.col]: 'min_stock_level' } } },
      ];
    }

    const sortBy = ['price', 'sellingPrice', 'name', 'createdAt', 'stockQuantity', 'categoryId', 'sku', 'isActive'].includes(query.sortBy) ? query.sortBy : 'createdAt';
    const sortOrder = query.sortOrder === 'ASC' ? 'ASC' : 'DESC';

    const { rows, count } = await Product.findAndCountAll({
      where,
      include: [{ association: 'category', attributes: ['id', 'name', 'slug'] }],
      offset,
      limit,
      order: [[sortBy, sortOrder]],
    });

    return { products: rows, pagination: getPaginationMeta(count, page, limit) };
  }

  async getById(id) {
    const product = await Product.findByPk(id, {
      include: [{ association: 'category', attributes: ['id', 'name', 'slug'] }],
    });
    if (!product) throw ApiError.notFound('Product not found');
    return { product };
  }

  async getByBarcode(barcode) {
    const product = await Product.findOne({
      where: { barcode },
      include: [{ association: 'category', attributes: ['id', 'name', 'slug'] }],
    });
    if (!product) throw ApiError.notFound('Product not found');
    return { product };
  }

  async getBySku(sku) {
    const product = await Product.findOne({
      where: { sku },
      include: [{ association: 'category', attributes: ['id', 'name', 'slug'] }],
    });
    if (!product) throw ApiError.notFound('Product not found');
    return { product };
  }

  async getLowStock(query) {
    const { page, limit, offset } = getPagination(query.page, query.limit);
    const { rows, count } = await Product.findAndCountAll({
      where: {
        isActive: true,
        stockQuantity: { [Op.lte]: { [Op.col]: 'min_stock_level' } },
      },
      include: [{ association: 'category', attributes: ['id', 'name', 'slug'] }],
      offset,
      limit,
      order: [['stockQuantity', 'ASC']],
    });

    return { products: rows, pagination: getPaginationMeta(count, page, limit) };
  }

  async getExpiring(days) {
    const warningDays = days || config.app.expiryWarningDays;
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + warningDays);

    const products = await Product.findAll({
      where: {
        expiryDate: {
          [Op.between]: [today, futureDate],
        },
      },
      include: [{ association: 'category', attributes: ['id', 'name', 'slug'] }],
      order: [['expiryDate', 'ASC']],
    });

    return { products };
  }

  async create(data) {
    const sanitized = sanitizeObject(data);

    if (!sanitized.name) throw ApiError.badRequest('Product name is required');

    const slug = slugify(sanitized.name);

    const t = await sequelize.transaction({ isolationLevel: 'REPEATABLE READ' });
    try {
      const existingSlug = await Product.findOne({
        where: sequelize.where(fn('LOWER', col('slug')), slug.toLowerCase()),
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (existingSlug) throw ApiError.conflict('A product with this name already exists');

      const duplicateProduct = await this.findDuplicateProduct({
        name: sanitized.name,
        sku: sanitized.sku,
        barcode: sanitized.barcode,
      });
      if (duplicateProduct) {
        if (duplicateProduct.field === 'sku') {
          throw ApiError.conflict('SKU already exists');
        }
        if (duplicateProduct.field === 'barcode') {
          throw ApiError.conflict('Barcode already exists');
        }
        throw ApiError.conflict('A product with this name already exists');
      }

      if (sanitized.sellingPrice !== undefined && sanitized.buyingPrice !== undefined) {
        if (parseFloat(sanitized.sellingPrice) < parseFloat(sanitized.buyingPrice)) {
          throw ApiError.badRequest('Selling price cannot be less than buying price');
        }
      }

      if (sanitized.stockQuantity !== undefined && parseInt(sanitized.stockQuantity, 10) < 0) {
        throw ApiError.badRequest('Stock quantity cannot be negative');
      }

      let categoryName = null;
      if (sanitized.categoryId) {
        const category = await Category.findByPk(sanitized.categoryId, { transaction: t });
        if (!category) throw ApiError.notFound('Category not found');
        categoryName = category.name;
      }

      if (!sanitized.sku) {
        sanitized.sku = generateSKU(categoryName, Date.now());
      }

      if (!sanitized.barcode) {
        sanitized.barcode = generateBarcode();
      }

      sanitized.slug = slug;
      const product = await Product.create(sanitized, { transaction: t });
      await t.commit();
      return this.getById(product.id);
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  async update(id, data) {
    const t = await sequelize.transaction({ isolationLevel: 'REPEATABLE READ' });
    try {
      const product = await Product.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
      if (!product) throw ApiError.notFound('Product not found');

      const sanitized = sanitizeObject(data);

      if (sanitized.name && sanitized.name !== product.name) {
        sanitized.slug = slugify(sanitized.name);
        const existingSlug = await Product.findOne({
          where: {
            [Op.and]: [
              sequelize.where(fn('LOWER', col('slug')), sanitized.slug.toLowerCase()),
              { id: { [Op.ne]: id } },
            ],
          },
          transaction: t,
        });
        if (existingSlug) throw ApiError.conflict('A product with this name already exists');
      }

      const duplicateProduct = await this.findDuplicateProduct({
        name: sanitized.name || product.name,
        sku: sanitized.sku || product.sku,
        barcode: sanitized.barcode || product.barcode,
      }, id);
      if (duplicateProduct) {
        if (duplicateProduct.field === 'sku') {
          throw ApiError.conflict('SKU already exists');
        }
        if (duplicateProduct.field === 'barcode') {
          throw ApiError.conflict('Barcode already exists');
        }
        throw ApiError.conflict('A product with this name already exists');
      }

      if (sanitized.sellingPrice !== undefined && sanitized.buyingPrice !== undefined) {
        if (parseFloat(sanitized.sellingPrice) < parseFloat(sanitized.buyingPrice)) {
          throw ApiError.badRequest('Selling price cannot be less than buying price');
        }
      } else if (sanitized.sellingPrice !== undefined) {
        if (parseFloat(sanitized.sellingPrice) < parseFloat(product.buyingPrice)) {
          throw ApiError.badRequest('Selling price cannot be less than buying price');
        }
      } else if (sanitized.buyingPrice !== undefined) {
        if (parseFloat(product.sellingPrice) < parseFloat(sanitized.buyingPrice)) {
          throw ApiError.badRequest('Selling price cannot be less than buying price');
        }
      }

      if (sanitized.stockQuantity !== undefined && parseInt(sanitized.stockQuantity, 10) < 0) {
        throw ApiError.badRequest('Stock quantity cannot be negative');
      }

      if (sanitized.categoryId) {
        const category = await Category.findByPk(sanitized.categoryId, { transaction: t });
        if (!category) throw ApiError.notFound('Category not found');
      }

      const oldStock = product.stockQuantity;
      const newStock = sanitized.stockQuantity !== undefined ? parseInt(sanitized.stockQuantity, 10) : undefined;

      await product.update(sanitized, { transaction: t });

      if (newStock !== undefined && newStock !== oldStock) {
        const difference = newStock - oldStock;
        await StockMovement.create({
          productId: product.id,
          userId: sanitized.updatedBy || 1,
          type: 'adjustment',
          quantity: Math.abs(difference),
          previousStock: oldStock,
          newStock: newStock,
          referenceType: 'Product',
          referenceId: product.id,
          notes: `Stock adjusted via product edit (${difference > 0 ? '+' : ''}${difference})`,
        }, { transaction: t });
      }

      await t.commit();
      return this.getById(id);
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  async delete(id) {
    const product = await Product.findByPk(id);
    if (!product) throw ApiError.notFound('Product not found');
    await product.destroy();
    return { message: 'Product deleted successfully' };
  }

  async bulkCreate(products) {
    if (!Array.isArray(products) || products.length === 0) {
      throw ApiError.badRequest('Products array is required');
    }

    const created = [];
    const errors = [];

    for (let i = 0; i < products.length; i++) {
      try {
        const result = await this.create(products[i]);
        created.push(result.product);
      } catch (error) {
        errors.push({ index: i, message: error.message, data: products[i] });
      }
    }

    return { products: created, errors };
  }

  async getBestSellers(limit = 10, startDate, endDate) {
    const where = {};

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt[Op.gte] = new Date(startDate);
      if (endDate) where.createdAt[Op.lte] = new Date(endDate);
    }

    const items = await SaleItem.findAll({
      attributes: [
        'productId',
        [SaleItem.sequelize.fn('SUM', SaleItem.sequelize.col('SaleItem.quantity')), 'totalSold'],
        [SaleItem.sequelize.fn('COUNT', SaleItem.sequelize.col('SaleItem.id')), 'saleCount'],
      ],
      where,
      include: [
        {
          association: 'product',
          include: [{ association: 'category', attributes: ['id', 'name', 'slug'] }],
        },
      ],
      group: ['productId', 'product.id', 'product->category.id'],
      order: [[SaleItem.sequelize.literal('totalSold'), 'DESC']],
      limit: Math.min(limit, 100),
      subQuery: false,
    });

    const products = items.map((item) => ({
      product: item.product,
      totalSold: parseInt(item.get('totalSold'), 10),
      saleCount: parseInt(item.get('saleCount'), 10),
    }));

    return { products };
  }
}

module.exports = new ProductService();
