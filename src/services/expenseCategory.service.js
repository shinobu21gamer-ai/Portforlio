const { ExpenseCategory, Expense } = require('../models');
const ApiError = require('../utils/ApiError');
const { slugify, sanitizeObject } = require('../utils/helpers');

class ExpenseCategoryService {
  async getAll() {
    return ExpenseCategory.findAll({ where: { isActive: true }, order: [['name', 'ASC']] });
  }

  async getById(id) {
    const category = await ExpenseCategory.findByPk(id);
    if (!category) throw ApiError.notFound('Expense category not found');
    return category;
  }

  async create(data) {
    const slug = slugify(data.name);
    return ExpenseCategory.create({ ...sanitizeObject(data), slug });
  }

  async update(id, data) {
    const category = await ExpenseCategory.findByPk(id);
    if (!category) throw ApiError.notFound('Expense category not found');
    if (data.name) {
      data.slug = slugify(data.name);
    }
    await category.update(sanitizeObject(data));
    return category;
  }

  async delete(id) {
    const category = await ExpenseCategory.findByPk(id);
    if (!category) throw ApiError.notFound('Expense category not found');

    const hasExpenses = await Expense.findOne({ where: { expenseCategoryId: id } });
    if (hasExpenses) throw ApiError.badRequest('Cannot delete expense category that has expenses assigned');

    await category.destroy();
    return { message: 'Expense category deleted' };
  }
}

module.exports = new ExpenseCategoryService();
