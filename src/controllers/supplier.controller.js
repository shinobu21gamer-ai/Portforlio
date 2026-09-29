const supplierService = require('../services/supplier.service');
const { sendSuccess } = require('../utils/response');
const ApiError = require('../utils/ApiError');

class SupplierController {
  async getAll(req, res, next) {
    try {
      const result = await supplierService.getAll(req.query);
      return sendSuccess(res, result, 'Suppliers retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const supplier = await supplierService.getById(req.params.id);
      return sendSuccess(res, supplier, 'Supplier retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const supplier = await supplierService.create(req.body);
      return sendSuccess(res, supplier, 'Supplier created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const supplier = await supplierService.update(req.params.id, req.body);
      return sendSuccess(res, supplier, 'Supplier updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      const result = await supplierService.delete(req.params.id);
      return sendSuccess(res, result, 'Supplier deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  async getOutstandingBalances(req, res, next) {
    try {
      const result = await supplierService.getOutstandingBalances(req.query);
      return sendSuccess(res, result, 'Outstanding balances retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getSupplierSummary(req, res, next) {
    try {
      const result = await supplierService.getSupplierSummary(req.params.id);
      return sendSuccess(res, result, 'Supplier summary retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getSupplierPurchases(req, res, next) {
    try {
      const result = await supplierService.getSupplierPurchases(req.params.id, req.query);
      return sendSuccess(res, result, 'Supplier purchases retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async exportAll(req, res, next) {
    try {
      const suppliers = await supplierService.exportAll();
      return sendSuccess(res, { suppliers }, 'Suppliers exported successfully');
    } catch (error) {
      next(error);
    }
  }

  async importCsv(req, res, next) {
    try {
      const { rows } = req.body;
      if (!Array.isArray(rows) || rows.length === 0) {
        return next(ApiError.badRequest('No data rows provided'));
      }
      const result = await supplierService.importFromCsv(rows);
      return sendSuccess(res, result, `Import completed: ${result.created} created, ${result.errors.length} errors`);
    } catch (error) {
      next(error);
    }
  }

  async getAnalytics(req, res, next) {
    try {
      const result = await supplierService.getAnalytics();
      return sendSuccess(res, result, 'Supplier analytics retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new SupplierController();
