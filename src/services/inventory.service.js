const { Op } = require('sequelize');
const { Product, StockMovement, Inventory, Notification, sequelize } = require('../models');
const ApiError = require('../utils/ApiError');
const { getPagination, getPaginationMeta, escapeLike } = require('../utils/helpers');
const config = require('../config');

class InventoryService {
  async stockIn(data, userId) {
    const qty = parseInt(data.quantity, 10);
    if (!qty || qty <= 0) throw ApiError.badRequest('Quantity must be a positive integer');
    const t = await sequelize.transaction({ isolationLevel: 'REPEATABLE READ' });
    try {
      const product = await Product.findOne({
        where: { id: data.productId },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (!product) throw ApiError.notFound('Product not found');

      const previousStock = product.stockQuantity;
      const newStock = previousStock + qty;

      await product.update({ stockQuantity: newStock }, { transaction: t });

      await StockMovement.create({
        productId: product.id,
        userId,
        type: 'in',
        quantity: qty,
        previousStock,
        newStock,
        referenceType: 'Manual',
        notes: data.notes || 'Stock in adjustment',
      }, { transaction: t });

      await Inventory.create({
        productId: product.id,
        userId,
        type: 'stock_in',
        quantity: qty,
        previousStock,
        currentStock: newStock,
        notes: data.notes || 'Stock in',
      }, { transaction: t });

      await t.commit();
      return { product: await Product.findByPk(product.id), message: 'Stock added successfully' };
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  async stockOut(data, userId) {
    const qty = parseInt(data.quantity, 10);
    if (!qty || qty <= 0) throw ApiError.badRequest('Quantity must be a positive integer');
    const t = await sequelize.transaction({ isolationLevel: 'REPEATABLE READ' });
    try {
      const product = await Product.findOne({
        where: { id: data.productId },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (!product) throw ApiError.notFound('Product not found');

      if (product.stockQuantity < qty) {
        throw ApiError.badRequest(`Insufficient stock. Available: ${product.stockQuantity}`);
      }

      const previousStock = product.stockQuantity;
      const newStock = previousStock - qty;

      await product.update({ stockQuantity: newStock }, { transaction: t });

      await StockMovement.create({
        productId: product.id,
        userId,
        type: 'out',
        quantity: qty,
        previousStock,
        newStock,
        referenceType: 'Manual',
        notes: data.notes || 'Stock out adjustment',
      }, { transaction: t });

      await Inventory.create({
        productId: product.id,
        userId,
        type: 'stock_out',
        quantity: -qty,
        previousStock,
        currentStock: newStock,
        notes: data.notes || 'Stock out',
      }, { transaction: t });

      await t.commit();
      return { product: await Product.findByPk(product.id), message: 'Stock removed successfully' };
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  async adjustStock(data, userId) {
    const newQty = parseInt(data.newQuantity, 10);
    if (isNaN(newQty) || newQty < 0) throw ApiError.badRequest('newQuantity must be a non-negative integer');
    const t = await sequelize.transaction({ isolationLevel: 'REPEATABLE READ' });
    try {
      const product = await Product.findOne({
        where: { id: data.productId },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (!product) throw ApiError.notFound('Product not found');

      const previousStock = product.stockQuantity;
      const newStock = Math.max(0, newQty);
      const quantityDiff = newStock - previousStock;

      await product.update({ stockQuantity: newStock }, { transaction: t });

      await StockMovement.create({
        productId: product.id,
        userId,
        type: 'adjustment',
        quantity: quantityDiff,
        previousStock,
        newStock,
        referenceType: 'Manual',
        notes: data.reason || `Stock adjusted from ${previousStock} to ${newStock}`,
      }, { transaction: t });

      const invType = data.type || 'adjustment';
      await Inventory.create({
        productId: product.id,
        userId,
        type: invType,
        quantity: quantityDiff,
        previousStock,
        currentStock: newStock,
        notes: data.reason || `Stock adjusted to ${newStock}`,
      }, { transaction: t });

      await t.commit();
      return { product: await Product.findByPk(product.id), message: 'Stock adjusted successfully' };
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  async getMovements(query) {
    const { page, limit, offset } = getPagination(query.page, query.limit);
    const where = {};
    const productWhere = {};

    if (query.productId) where.productId = query.productId;
    if (query.type) where.type = query.type;
    if (query.startDate && query.endDate) {
      where.createdAt = { [Op.between]: [new Date(query.startDate), new Date(query.endDate + 'T23:59:59')] };
    } else if (query.startDate) {
      where.createdAt = { [Op.gte]: new Date(query.startDate) };
    } else if (query.endDate) {
      where.createdAt = { [Op.lte]: new Date(query.endDate + 'T23:59:59') };
    }
    if (query.search) {
      productWhere.name = { [Op.like]: `%${escapeLike(query.search)}%` };
    }

    const sortBy = ['createdAt', 'type', 'quantity'].includes(query.sortBy) ? query.sortBy : 'createdAt';
    const sortOrder = query.sortOrder === 'ASC' ? 'ASC' : 'DESC';

    const { rows, count } = await StockMovement.findAndCountAll({
      where,
      include: [
        { association: 'product', attributes: ['id', 'name', 'sku'], where: Object.keys(productWhere).length ? productWhere : undefined },
        { association: 'user', attributes: ['id', 'firstName', 'lastName'] },
      ],
      offset,
      limit,
      order: [[sortBy, sortOrder]],
    });

    return { movements: rows, pagination: getPaginationMeta(count, page, limit) };
  }

  async getInventoryLogs(query) {
    const { page, limit, offset } = getPagination(query.page, query.limit);
    const where = {};

    if (query.productId) where.productId = query.productId;
    if (query.type) where.type = query.type;
    if (query.startDate && query.endDate) {
      where.createdAt = { [Op.between]: [new Date(query.startDate), new Date(query.endDate + 'T23:59:59')] };
    } else if (query.startDate) {
      where.createdAt = { [Op.gte]: new Date(query.startDate) };
    } else if (query.endDate) {
      where.createdAt = { [Op.lte]: new Date(query.endDate + 'T23:59:59') };
    }

    const { rows, count } = await Inventory.findAndCountAll({
      where,
      include: [
        { association: 'product', attributes: ['id', 'name', 'sku'] },
        { association: 'user', attributes: ['id', 'firstName', 'lastName'] },
      ],
      offset,
      limit,
      order: [['createdAt', 'DESC']],
    });

    return { logs: rows, pagination: getPaginationMeta(count, page, limit) };
  }

  async checkLowStock() {
    const t = await sequelize.transaction({ isolationLevel: 'REPEATABLE READ' });
    try {
      const products = await Product.findAll({
        where: {
          isActive: true,
          stockQuantity: { [Op.lte]: sequelize.col('min_stock_level') },
        },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      for (const product of products) {
        const existing = await Notification.findOne({
          where: {
            type: 'low_stock',
            'data.productId': product.id,
          },
          order: [['createdAt', 'DESC']],
          transaction: t,
        });

        if (!existing || (Date.now() - new Date(existing.createdAt).getTime()) > 6 * 60 * 60 * 1000) {
          await Notification.create({
            type: 'low_stock',
            title: `Low Stock: ${product.name}`,
            message: `${product.name} has only ${product.stockQuantity} units left (min: ${product.minStockLevel})`,
            data: { productId: product.id, stockQuantity: product.stockQuantity, minStockLevel: product.minStockLevel },
          }, { transaction: t });
        }
      }

      await t.commit();
      return { count: products.length, products };
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  async checkExpiringProducts(days) {
    const warningDays = days || config.app.expiryWarningDays;
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + warningDays);

    const t = await sequelize.transaction({ isolationLevel: 'REPEATABLE READ' });
    try {
      const products = await Product.findAll({
        where: {
          isActive: true,
          expiryDate: {
            [Op.not]: null,
            [Op.between]: [new Date(), targetDate],
          },
        },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      for (const product of products) {
        const existing = await Notification.findOne({
          where: {
            type: 'expiring_product',
            'data.productId': product.id,
          },
          order: [['createdAt', 'DESC']],
          transaction: t,
        });

        if (!existing || (Date.now() - new Date(existing.createdAt).getTime()) > 24 * 60 * 60 * 1000) {
          await Notification.create({
            type: 'expiring_product',
            title: `Expiring: ${product.name}`,
            message: `${product.name} expires on ${product.expiryDate}`,
            data: { productId: product.id, expiryDate: product.expiryDate },
          }, { transaction: t });
        }
      }

      await t.commit();
      return { count: products.length, products };
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }
}

module.exports = new InventoryService();
