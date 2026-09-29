const expenseCategoryService = require('../services/expenseCategory.service');
const { sendSuccess } = require('../utils/response');

class ExpenseCategoryController {
  async getAll(req, res, next) {
    try {
      const categories = await expenseCategoryService.getAll();
      return sendSuccess(res, categories, 'Expense categories retrieved');
    } catch (error) {
      next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const category = await expenseCategoryService.getById(req.params.id);
      return sendSuccess(res, category, 'Expense category retrieved');
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const category = await expenseCategoryService.create(req.body);
      return sendSuccess(res, category, 'Expense category created', 201);
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const category = await expenseCategoryService.update(req.params.id, req.body);
      return sendSuccess(res, category, 'Expense category updated');
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      const result = await expenseCategoryService.delete(req.params.id);
      return sendSuccess(res, result, 'Expense category deleted');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ExpenseCategoryController();
