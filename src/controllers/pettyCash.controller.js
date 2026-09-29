const pettyCashService = require('../services/pettyCash.service');
const { sendSuccess } = require('../utils/response');

class PettyCashController {
  async getAllFunds(req, res, next) {
    try {
      const result = await pettyCashService.getAllFunds();
      return sendSuccess(res, result, 'Petty cash funds retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getFundById(req, res, next) {
    try {
      const fund = await pettyCashService.getFundById(req.params.id);
      return sendSuccess(res, fund, 'Petty cash fund retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async createFund(req, res, next) {
    try {
      const fund = await pettyCashService.createFund(req.body, req.user.id);
      return sendSuccess(res, fund, 'Petty cash fund created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async updateFund(req, res, next) {
    try {
      const fund = await pettyCashService.updateFund(req.params.id, req.body);
      return sendSuccess(res, fund, 'Petty cash fund updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async closeFund(req, res, next) {
    try {
      const fund = await pettyCashService.closeFund(req.params.id);
      return sendSuccess(res, fund, 'Petty cash fund closed successfully');
    } catch (error) {
      next(error);
    }
  }

  async deposit(req, res, next) {
    try {
      const result = await pettyCashService.deposit(req.params.id, req.body, req.user.id);
      return sendSuccess(res, result, 'Deposit successful', 201);
    } catch (error) {
      next(error);
    }
  }

  async withdraw(req, res, next) {
    try {
      const result = await pettyCashService.withdraw(req.params.id, req.body, req.user.id);
      return sendSuccess(res, result, 'Withdrawal successful', 201);
    } catch (error) {
      next(error);
    }
  }

  async getTransactions(req, res, next) {
    try {
      const result = await pettyCashService.getTransactions(req.params.id, req.query);
      return sendSuccess(res, result, 'Transactions retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getSummary(req, res, next) {
    try {
      const result = await pettyCashService.getSummary();
      return sendSuccess(res, result, 'Summary retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new PettyCashController();
