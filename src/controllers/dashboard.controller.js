const dashboardService = require('../services/dashboard.service');
const { sendSuccess } = require('../utils/response');

class DashboardController {
  async getDashboard(req, res, next) {
    try {
      const data = await dashboardService.getDashboard();
      return sendSuccess(res, data, 'Dashboard data retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new DashboardController();
