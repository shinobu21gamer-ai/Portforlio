const { Op, fn, col } = require('sequelize');
const { Expense, ExpenseCategory, sequelize } = require('../models');
const ApiError = require('../utils/ApiError');
const { getPagination, getPaginationMeta, sanitizeObject, escapeLike } = require('../utils/helpers');

class ExpenseService {
  async getAll(query) {
    const { page, limit, offset } = getPagination(query.page, query.limit);
    const where = {};

    if (query.expenseCategoryId) where.expenseCategoryId = query.expenseCategoryId;
    if (query.paymentMethod) where.paymentMethod = query.paymentMethod;
    if (query.userId) where.userId = query.userId;
    if (query.startDate && query.endDate) {
      where.expenseDate = { [Op.between]: [query.startDate, query.endDate] };
    } else if (query.startDate) {
      where.expenseDate = { [Op.gte]: query.startDate };
    } else if (query.endDate) {
      where.expenseDate = { [Op.lte]: query.endDate };
    }
    if (query.search) {
      where.description = { [Op.like]: `%${escapeLike(query.search)}%` };
    }

    const sortBy = ['expenseDate', 'amount', 'description', 'createdAt'].includes(query.sortBy) ? query.sortBy : 'expenseDate';
    const sortOrder = query.sortOrder === 'ASC' ? 'ASC' : 'DESC';

    const { rows, count } = await Expense.findAndCountAll({
      where,
      include: [
        { association: 'category', attributes: ['id', 'name'] },
        { association: 'user', attributes: ['id', 'firstName', 'lastName'] },
      ],
      offset,
      limit,
      order: [[sortBy, sortOrder]],
    });

    const totalResult = await Expense.findAll({
      where,
      attributes: [[fn('COALESCE', fn('SUM', col('amount')), 0), 'totalAmount']],
      raw: true,
    });

    return { expenses: rows, pagination: getPaginationMeta(count, page, limit), totalAmount: parseFloat(totalResult[0]?.totalAmount || 0) };
  }

  async getById(id) {
    const expense = await Expense.findByPk(id, {
      include: [
        { association: 'category' },
        { association: 'user', attributes: ['id', 'firstName', 'lastName'] },
      ],
    });
    if (!expense) throw ApiError.notFound('Expense not found');
    return expense;
  }

  async create(data, userId) {
    const t = await sequelize.transaction({ isolationLevel: 'REPEATABLE READ' });
    try {
      if (!data.amount || parseFloat(data.amount) <= 0) {
        throw ApiError.badRequest('Expense amount must be greater than zero');
      }
      if (!data.expenseCategoryId) {
        throw ApiError.badRequest('Expense category is required');
      }
      if (!data.expenseDate) {
        throw ApiError.badRequest('Expense date is required');
      }

      const category = await ExpenseCategory.findByPk(data.expenseCategoryId, { transaction: t });
      if (!category) throw ApiError.notFound('Expense category not found');

      const expense = await Expense.create({ ...sanitizeObject(data), userId }, { transaction: t });
      await t.commit();
      return expense;
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  async update(id, data) {
    const t = await sequelize.transaction({ isolationLevel: 'REPEATABLE READ' });
    try {
      const expense = await Expense.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
      if (!expense) throw ApiError.notFound('Expense not found');

      if (data.amount !== undefined && parseFloat(data.amount) <= 0) {
        throw ApiError.badRequest('Expense amount must be greater than zero');
      }

      await expense.update(sanitizeObject(data), { transaction: t });
      await t.commit();
      return this.getById(id);
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  async delete(id) {
    const t = await sequelize.transaction({ isolationLevel: 'REPEATABLE READ' });
    try {
      const expense = await Expense.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
      if (!expense) throw ApiError.notFound('Expense not found');
      await expense.destroy({ transaction: t });
      await t.commit();
      return { message: 'Expense deleted successfully' };
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  async getReport(startDate, endDate) {
    const where = {};

    if (startDate && endDate) {
      where.expenseDate = { [Op.between]: [startDate, endDate] };
    } else if (startDate) {
      where.expenseDate = { [Op.gte]: startDate };
    } else if (endDate) {
      where.expenseDate = { [Op.lte]: endDate };
    }

    const expenses = await Expense.findAll({
      where,
      include: [{ association: 'category', attributes: ['id', 'name'] }],
    });

    const totalExpenses = expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
    const byCategory = {};

    expenses.forEach((e) => {
      const catName = e.category ? e.category.name : 'Uncategorized';
      if (!byCategory[catName]) {
        byCategory[catName] = { total: 0, count: 0, items: [] };
      }
      byCategory[catName].total += parseFloat(e.amount);
      byCategory[catName].count += 1;
      byCategory[catName].items.push({
        id: e.id,
        amount: e.amount,
        description: e.description,
        date: e.expenseDate,
      });
    });

    Object.keys(byCategory).forEach((k => {
      byCategory[k].total = parseFloat(byCategory[k].total.toFixed(2));
    }));

    return {
      totalExpenses: parseFloat(totalExpenses.toFixed(2)),
      totalCount: expenses.length,
      byCategory,
      period: { startDate, endDate },
    };
  }
}

module.exports = new ExpenseService();
