const inventoryService = require('../services/inventory.service');
const { sendSuccess } = require('../utils/response');

class InventoryController {
  async stockIn(req, res, next) {
    try {
      const result = await inventoryService.stockIn(req.body, req.user.id);
      return sendSuccess(res, result, 'Stock added successfully');
    } catch (error) {
      next(error);
    }
  }

  async stockOut(req, res, next) {
    try {
      const result = await inventoryService.stockOut(req.body, req.user.id);
      return sendSuccess(res, result, 'Stock removed successfully');
    } catch (error) {
      next(error);
    }
  }

  async adjustStock(req, res, next) {
    try {
      const result = await inventoryService.adjustStock(req.body, req.user.id);
      return sendSuccess(res, result, 'Stock adjusted successfully');
    } catch (error) {
      next(error);
    }
  }

  async getMovements(req, res, next) {
    try {
      const result = await inventoryService.getMovements(req.query);
      return sendSuccess(res, result, 'Stock movements retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getLogs(req, res, next) {
    try {
      const result = await inventoryService.getInventoryLogs(req.query);
      return sendSuccess(res, result, 'Inventory logs retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async checkLowStock(req, res, next) {
    try {
      const result = await inventoryService.checkLowStock();
      return sendSuccess(res, result, 'Low stock check completed');
    } catch (error) {
      next(error);
    }
  }

  async checkExpiring(req, res, next) {
    try {
      const result = await inventoryService.checkExpiringProducts(req.query.days);
      return sendSuccess(res, result, 'Expiring products check completed');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new InventoryController();
