const notificationService = require('../services/notification.service');
const { sendSuccess } = require('../utils/response');

class NotificationController {
  async getAll(req, res, next) {
    try {
      const result = await notificationService.getAll(req.query, req.user?.id);
      return sendSuccess(res, result, 'Notifications retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async markAsRead(req, res, next) {
    try {
      const result = await notificationService.markAsRead(req.body.ids, req.user?.id);
      return sendSuccess(res, result, 'Notifications marked as read');
    } catch (error) {
      next(error);
    }
  }

  async markAllAsRead(req, res, next) {
    try {
      const result = await notificationService.markAllAsRead(req.user?.id);
      return sendSuccess(res, result, 'All notifications marked as read');
    } catch (error) {
      next(error);
    }
  }

  async getUnreadCount(req, res, next) {
    try {
      const result = await notificationService.getUnreadCount(req.user?.id);
      return sendSuccess(res, result, 'Unread count retrieved');
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      const result = await notificationService.delete(req.params.id, req.user?.id);
      return sendSuccess(res, result, 'Notification deleted');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new NotificationController();
