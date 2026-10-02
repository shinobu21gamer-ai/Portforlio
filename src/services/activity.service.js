const { Op } = require('sequelize');
const { ActivityLog } = require('../models');
const { getPagination, getPaginationMeta } = require('../utils/helpers');

class ActivityService {
  async getAll(query) {
    const { page, limit, offset } = getPagination(query.page, query.limit);
    const where = {};

    if (query.userId) where.userId = query.userId;
    if (query.action) where.action = query.action;
    if (query.module) where.module = query.module;
    if (query.startDate && query.endDate) {
      where.createdAt = { [Op.between]: [new Date(query.startDate), new Date(query.endDate)] };
    }

    const { rows, count } = await ActivityLog.findAndCountAll({
      where,
      include: [{ association: 'user', attributes: ['id', 'firstName', 'lastName', 'email'] }],
      offset,
      limit,
      order: [['createdAt', 'DESC']],
    });

    return { logs: rows, pagination: getPaginationMeta(count, page, limit) };
  }

  async getByUser(userId, query) {
    return this.getAll({ ...query, userId });
  }
}

module.exports = new ActivityService();
