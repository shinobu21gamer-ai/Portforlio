const expenseService = require('../services/expense.service');
const { sendSuccess } = require('../utils/response');

class ExpenseController {
  async getAll(req, res, next) {
    try {
      const result = await expenseService.getAll(req.query);
      return sendSuccess(res, result, 'Expenses retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const expense = await expenseService.getById(req.params.id);
      return sendSuccess(res, expense, 'Expense retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const expense = await expenseService.create(req.body, req.user.id);
      return sendSuccess(res, expense, 'Expense created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const expense = await expenseService.update(req.params.id, req.body);
      return sendSuccess(res, expense, 'Expense updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      const result = await expenseService.delete(req.params.id);
      return sendSuccess(res, result, 'Expense deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  async getReport(req, res, next) {
    try {
      const { startDate, endDate } = req.query;
      const report = await expenseService.getReport(startDate, endDate);
      return sendSuccess(res, report, 'Expense report generated successfully');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ExpenseController();
