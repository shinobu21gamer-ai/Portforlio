const { Op } = require('sequelize');
const { ActivityLog } = require('../models');
const { getPagination, getPaginationMeta, escapeLike } = require('../utils/helpers');

class ActivityService {
  async getAll(query) {
    const { page, limit, offset } = getPagination(query.page, query.limit);
    const where = {};
    const SORTABLE = ['createdAt', 'action', 'module', 'referenceType'];
    const sortBy = SORTABLE.includes(query.sortBy) ? query.sortBy : 'createdAt';
    const sortOrder = query.sortOrder === 'ASC' ? 'ASC' : 'DESC';

    if (query.userId) where.userId = query.userId;
    if (query.action) where.action = query.action;
    if (query.module) where.module = query.module;
    if (query.startDate && query.endDate) {
      where.createdAt = { [Op.between]: [new Date(query.startDate), new Date(query.endDate)] };
    }
    if (query.search) {
      where[Op.or] = [
        { action: { [Op.like]: `%${escapeLike(query.search)}%` } },
        { description: { [Op.like]: `%${escapeLike(query.search)}%` } },
        { module: { [Op.like]: `%${escapeLike(query.search)}%` } },
        { referenceId: { [Op.like]: `%${escapeLike(query.search)}%` } },
      ];
    }

    const { rows, count } = await ActivityLog.findAndCountAll({
      where,
      include: [{ association: 'user', attributes: ['id', 'firstName', 'lastName', 'email'] }],
      offset,
      limit,
      order: [[sortBy, sortOrder]],
    });

    return { logs: rows, pagination: getPaginationMeta(count, page, limit) };
  }

  async getByUser(userId, query) {
    return this.getAll({ ...query, userId });
  }
}

module.exports = new ActivityService();
