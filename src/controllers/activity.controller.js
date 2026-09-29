const activityService = require('../services/activity.service');
const { sendSuccess } = require('../utils/response');

class ActivityController {
  async getAll(req, res, next) {
    try {
      const result = await activityService.getAll(req.query);
      return sendSuccess(res, result, 'Activity logs retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getByUser(req, res, next) {
    try {
      const result = await activityService.getByUser(req.params.userId, req.query);
      return sendSuccess(res, result, 'User activity logs retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ActivityController();
