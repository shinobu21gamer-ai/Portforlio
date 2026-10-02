const { Customer, LoyaltyPoint, sequelize } = require('../models');
const { Op } = require('sequelize');
const ApiError = require('../utils/ApiError');
const { getPagination, getPaginationMeta, sanitizeObject, escapeLike } = require('../utils/helpers');

class CustomerService {
  async getAll(query) {
    const { page, limit, offset } = getPagination(query.page, query.limit);
    const where = {};

    if (query.search) {
      const safeSearch = escapeLike(query.search);
      where[Op.or] = [
        { firstName: { [Op.like]: `%${safeSearch}%` } },
        { lastName: { [Op.like]: `%${safeSearch}%` } },
        { email: { [Op.like]: `%${safeSearch}%` } },
        { phone: { [Op.like]: `%${safeSearch}%` } },
      ];
    }
    if (query.isActive !== undefined) where.isActive = query.isActive === 'true';
    if (query.city) where.city = { [Op.like]: `%${escapeLike(query.city)}%` };

    const allowedSort = ['name', 'createdAt', 'totalPurchases', 'visitCount'];
    const sortBy = allowedSort.includes(query.sortBy) ? query.sortBy : 'createdAt';
    const sortOrder = query.sortOrder === 'ASC' ? 'ASC' : 'DESC';

    const isSQLite = Customer.sequelize.dialect.name === 'sqlite';
    const nameExpr = isSQLite
      ? Customer.sequelize.literal("first_name || ' ' || last_name")
      : Customer.sequelize.literal('CONCAT(first_name, " ", last_name)');

    const order = sortBy === 'name'
      ? [[nameExpr, sortOrder]]
      : [[sortBy, sortOrder]];

    const { rows, count } = await Customer.findAndCountAll({
      where,
      offset,
      limit,
      order,
    });

    return { customers: rows, pagination: getPaginationMeta(count, page, limit) };
  }

  async getById(id) {
    const customer = await Customer.findByPk(id, {
      include: [
        {
          association: 'sales',
          limit: 10,
          order: [['createdAt', 'DESC']],
        },
        { association: 'loyaltyPointLogs', order: [['createdAt', 'DESC']] },
      ],
    });
    if (!customer) throw ApiError.notFound('Customer not found');
    return { customer };
  }

  async create(data) {
    const sanitized = sanitizeObject(data);
    if (!sanitized.firstName || !sanitized.lastName) {
      throw ApiError.badRequest('First name and last name are required');
    }
    if (sanitized.email) {
      const existing = await Customer.findOne({ where: { email: sanitized.email } });
      if (existing) throw ApiError.conflict('Customer with this email already exists');
    }
    const customer = await Customer.create(sanitized);
    return this.getById(customer.id);
  }

  async update(id, data) {
    const customer = await Customer.findByPk(id);
    if (!customer) throw ApiError.notFound('Customer not found');

    const sanitized = sanitizeObject(data);
    if (sanitized.email && sanitized.email !== customer.email) {
      const existing = await Customer.findOne({
        where: { email: sanitized.email, id: { [Op.ne]: id } },
      });
      if (existing) throw ApiError.conflict('Customer with this email already exists');
    }

    await customer.update(sanitized);
    return this.getById(id);
  }

  async delete(id) {
    const customer = await Customer.findByPk(id);
    if (!customer) throw ApiError.notFound('Customer not found');
    await customer.destroy();
    return { message: 'Customer deleted successfully' };
  }

  async addLoyaltyPoints(customerId, saleId, points) {
    const customer = await Customer.findByPk(customerId);
    if (!customer) throw ApiError.notFound('Customer not found');

    const balanceBefore = customer.loyaltyPoints;
    const balanceAfter = balanceBefore + points;

    await LoyaltyPoint.create({
      customerId,
      saleId,
      points,
      type: 'earned',
      balanceBefore,
      balanceAfter,
    });

    await customer.update({ loyaltyPoints: balanceAfter });
    return this.getById(customerId);
  }

  async redeemLoyaltyPoints(customerId, points) {
    const t = await sequelize.transaction();
    try {
      const customer = await Customer.findByPk(customerId, { transaction: t, lock: true });
      if (!customer) throw ApiError.notFound('Customer not found');

      if (customer.loyaltyPoints < points) {
        throw ApiError.badRequest('Insufficient loyalty points');
      }

      const balanceBefore = customer.loyaltyPoints;
      const balanceAfter = balanceBefore - points;

      await LoyaltyPoint.create({
        customerId,
        points,
        type: 'redeemed',
        balanceBefore,
        balanceAfter,
      }, { transaction: t });

      await customer.update({ loyaltyPoints: balanceAfter }, { transaction: t });
      await t.commit();
      return this.getById(customerId);
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }
}

module.exports = new CustomerService();
