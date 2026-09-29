const { Op } = require('sequelize');
const { Notification, NotificationRead } = require('../models');
const { getPagination, getPaginationMeta } = require('../utils/helpers');
const ApiError = require('../utils/ApiError');

class NotificationService {
  // Notifications are broadcast rows (user_id NULL) or targeted to one user.
  // Read state is tracked per user in notification_reads so a broadcast can be
  // dismissed by one user without hiding it from everyone else.
  visibleWhere(userId) {
    return userId ? { userId: { [Op.or]: [userId, null] } } : {};
  }

  async readMap(userId, notificationIds) {
    if (!userId || !notificationIds.length) return new Map();
    const rows = await NotificationRead.findAll({
      where: { userId, notificationId: { [Op.in]: notificationIds } },
      attributes: ['notificationId', 'readAt'],
    });
    return new Map(rows.map((r) => [r.notificationId, r.readAt]));
  }

  applyReadState(notification, reads) {
    const receiptReadAt = reads.get(notification.id) || null;
    const isRead = receiptReadAt ? true : (notification.userId === null ? false : notification.isRead);
    notification.setDataValue('isRead', isRead);
    notification.setDataValue('readAt', receiptReadAt || notification.readAt || null);
    return notification;
  }

  async getAll(query, userId) {
    const { page, limit, offset } = getPagination(query.page, query.limit);
    const where = { ...this.visibleWhere(userId) };
    if (query.type) where.type = query.type;

    // Read state for broadcast rows lives in notification_reads, so an isRead
    // filter has to be resolved in JS to stay correct.
    if (query.isRead !== undefined) {
      const all = await Notification.findAll({
        where,
        order: [['createdAt', 'DESC']],
        attributes: ['id', 'userId', 'isRead', 'readAt', 'type', 'title', 'message', 'data', 'createdAt'],
      });
      const reads = await this.readMap(userId, all.map((r) => r.id));
      const wantRead = query.isRead === 'true';
      const matched = all
        .map((n) => this.applyReadState(n, reads))
        .filter((n) => n.isRead === wantRead);
      return {
        notifications: matched.slice(offset, offset + limit),
        pagination: getPaginationMeta(matched.length, page, limit),
      };
    }

    const { rows, count } = await Notification.findAndCountAll({
      where,
      offset,
      limit,
      order: [['createdAt', 'DESC']],
    });

    const reads = await this.readMap(userId, rows.map((r) => r.id));
    const notifications = rows.map((n) => this.applyReadState(n, reads));

    return { notifications, pagination: getPaginationMeta(count, page, limit) };
  }

  async markAsRead(ids, userId) {
    if (!userId) throw ApiError.badRequest('Cannot mark notifications as read');
    const list = Array.isArray(ids) ? ids : [ids];
    if (!list.length) return { message: '0 notification(s) marked as read' };

    const visible = await Notification.findAll({
      where: { id: { [Op.in]: list }, ...this.visibleWhere(userId) },
      attributes: ['id'],
    });

    const visibleIds = visible.map((n) => n.id);
    if (!visibleIds.length) return { message: '0 notification(s) marked as read' };

    // Targeted rows also flip their own flag so legacy clients stay in sync.
    await Notification.update(
      { isRead: true, readAt: new Date() },
      { where: { id: { [Op.in]: visibleIds }, userId } }
    );

    await NotificationRead.bulkCreate(
      visibleIds.map((notificationId) => ({ userId, notificationId, readAt: new Date() })),
      { ignoreDuplicates: true }
    );

    return { message: `${visibleIds.length} notification(s) marked as read` };
  }

  async markAllAsRead(userId) {
    if (!userId) throw ApiError.badRequest('Cannot mark notifications as read');

    const visible = await Notification.findAll({
      where: this.visibleWhere(userId),
      attributes: ['id', 'userId', 'isRead'],
    });

    const reads = await this.readMap(userId, visible.map((n) => n.id));
    const unread = visible.filter((n) => !reads.get(n.id) && (n.userId === null ? true : !n.isRead));
    if (!unread.length) return { message: '0 notification(s) marked as read' };

    const now = new Date();
    const targetedIds = unread.filter((n) => n.userId === userId).map((n) => n.id);
    if (targetedIds.length) {
      await Notification.update({ isRead: true, readAt: now }, { where: { id: { [Op.in]: targetedIds } } });
    }

    await NotificationRead.bulkCreate(
      unread.map((n) => ({ userId, notificationId: n.id, readAt: now })),
      { ignoreDuplicates: true }
    );

    return { message: `${unread.length} notification(s) marked as read` };
  }

  async getUnreadCount(userId) {
    const visible = await Notification.findAll({
      where: this.visibleWhere(userId),
      attributes: ['id', 'userId', 'isRead'],
    });

    const reads = await this.readMap(userId, visible.map((n) => n.id));
    const unreadCount = visible.filter(
      (n) => !reads.get(n.id) && (n.userId === null ? true : !n.isRead)
    ).length;

    return { unreadCount };
  }

  async delete(id, userId) {
    const where = { id };
    if (userId) where.userId = userId;
    const notification = await Notification.findOne({ where });
    if (!notification) throw ApiError.notFound('Notification not found');
    await notification.destroy();
    return { message: 'Notification deleted' };
  }
}

module.exports = new NotificationService();
