const saleService = require('../services/sale.service');
const { sendSuccess } = require('../utils/response');

class SaleController {
  async getAll(req, res, next) {
    try {
      const result = await saleService.getAll({ ...req.query, user: req.user });
      return sendSuccess(res, result, 'Sales retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getPending(req, res, next) {
    try {
      const result = await saleService.getAll({ ...req.query, status: 'pending', user: req.user });
      return sendSuccess(res, result, 'Pending sales retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const sale = await saleService.getById(req.params.id, req.user);
      return sendSuccess(res, sale, 'Sale retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const sale = await saleService.create(req.body, req.user.id);
      return sendSuccess(res, sale, 'Sale completed successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async createPending(req, res, next) {
    try {
      const sale = await saleService.createPending(req.body, req.user.id);
      return sendSuccess(res, sale, 'Pending sale created', 201);
    } catch (error) {
      next(error);
    }
  }

  async cancel(req, res, next) {
    try {
      const sale = await saleService.cancel(req.params.id, req.user.id);
      return sendSuccess(res, sale, 'Sale cancelled successfully');
    } catch (error) {
      next(error);
    }
  }

  async cancelPending(req, res, next) {
    try {
      const sale = await saleService.cancelPendingOnline(req.params.id, req.user);
      return sendSuccess(res, sale, 'Pending sale cancelled successfully');
    } catch (error) {
      next(error);
    }
  }

  async completePendingAsCash(req, res, next) {
    try {
      const sale = await saleService.completePendingAsCash(req.params.id, req.user);
      return sendSuccess(res, sale, 'Pending sale completed as cash');
    } catch (error) {
      next(error);
    }
  }

  async getByInvoice(req, res, next) {
    try {
      const sale = await saleService.getByInvoice(req.params.invoiceNo, req.user);
      return sendSuccess(res, sale, 'Sale retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getSalesReport(req, res, next) {
    try {
      const { startDate, endDate } = req.query;
      const report = await saleService.getSalesReport(startDate, endDate);
      return sendSuccess(res, report, 'Sales report generated successfully');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new SaleController();
