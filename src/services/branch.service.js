const { Branch, User, Product, Sale } = require('../models');
const { escapeLike, sanitizeObject } = require('../utils/helpers');

class BranchService {
  async getAll({ page = 1, limit = 20, search, isActive, sortBy: sortByRaw, sortOrder: sortOrderRaw }) {
    const where = {};
    if (search) where.name = { [require('sequelize').Op.like]: `%${escapeLike(search)}%` };
    if (isActive !== undefined) where.isActive = isActive === 'true';

    const allowedSort = ['name', 'code', 'city', 'phone', 'createdAt'];
    const sortBy = allowedSort.includes(sortByRaw) ? sortByRaw : 'name';
    const sortOrder = sortOrderRaw === 'DESC' ? 'DESC' : 'ASC';

    const { count, rows } = await Branch.findAndCountAll({
      where,
      include: [
        { model: User, as: 'manager', attributes: ['id', 'firstName', 'lastName'], required: false },
      ],
      order: [[sortBy, sortOrder]],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
    });

    return {
      branches: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        totalPages: Math.ceil(count / parseInt(limit)),
      },
    };
  }

  async getById(id) {
    return Branch.findByPk(id, {
      include: [
        { model: User, as: 'manager', attributes: ['id', 'firstName', 'lastName'] },
      ],
    });
  }

  async create(data) {
    const sanitized = sanitizeObject(data);
    return Branch.create(sanitized);
  }

  async update(id, data) {
    const branch = await Branch.findByPk(id);
    if (!branch) throw new Error('Branch not found');
    const sanitized = sanitizeObject(data);
    await branch.update(sanitized);
    return branch;
  }

  async delete(id) {
    const branch = await Branch.findByPk(id);
    if (!branch) throw new Error('Branch not found');
    const { Product, Sale, User } = require('../models');
    const [productCount, saleCount, userCount] = await Promise.all([
      Product.count({ where: { branchId: id } }),
      Sale.count({ where: { branchId: id } }),
      User.count({ where: { branchId: id } }),
    ]);
    if (productCount > 0 || saleCount > 0 || userCount > 0) {
      throw new Error(`Cannot delete branch: ${productCount} products, ${saleCount} sales, and ${userCount} users are still assigned to it`);
    }
    await branch.destroy();
  }

  async getStats(id) {
    const [productCount, saleCount, revenueResult] = await Promise.all([
      Product.count({ where: { branchId: id, isActive: true } }),
      Sale.count({ where: { branchId: id, status: 'completed' } }),
      Sale.findOne({
        attributes: [[require('sequelize').fn('COALESCE', require('sequelize').fn('SUM', require('sequelize').col('total')), 0), 'totalRevenue']],
        where: { branchId: id, status: 'completed' },
        raw: true,
      }),
    ]);

    return {
      productCount,
      saleCount,
      totalRevenue: parseFloat(revenueResult?.totalRevenue || 0),
    };
  }
}

module.exports = new BranchService();
