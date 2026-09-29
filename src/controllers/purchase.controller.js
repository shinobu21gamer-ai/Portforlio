const purchaseService = require('../services/purchase.service');
const { sendSuccess } = require('../utils/response');

class PurchaseController {
  async getAll(req, res, next) {
    try {
      const result = await purchaseService.getAll(req.query);
      return sendSuccess(res, result, 'Purchases retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const purchase = await purchaseService.getById(req.params.id);
      return sendSuccess(res, purchase, 'Purchase retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const purchase = await purchaseService.create(req.body, req.user.id);
      return sendSuccess(res, purchase, 'Purchase order created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async receive(req, res, next) {
    try {
      const purchase = await purchaseService.receive(req.params.id, req.body, req.user.id);
      return sendSuccess(res, purchase, 'Purchase received successfully');
    } catch (error) {
      next(error);
    }
  }

  async cancel(req, res, next) {
    try {
      const result = await purchaseService.cancel(req.params.id);
      return sendSuccess(res, result, 'Purchase cancelled successfully');
    } catch (error) {
      next(error);
    }
  }

  async pay(req, res, next) {
    try {
      const purchase = await purchaseService.pay(req.params.id, req.body, req.user.id);
      return sendSuccess(res, purchase, 'Payment recorded successfully');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new PurchaseController();
