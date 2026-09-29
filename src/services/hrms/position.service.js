const { Position, Department, Employee } = require('../../models');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta, escapeLike, sanitizeObject } = require('../../utils/helpers');
const { Op, fn, col, where: sequelizeWhere } = require('sequelize');

class PositionService {
  async getAll(query) {
    const { page, limit, offset } = getPagination(query.page, query.limit);
    const where = {};
    if (query.search) where.title = { [Op.like]: `%${escapeLike(query.search)}%` };
    if (query.departmentId) where.departmentId = query.departmentId;

    const { rows, count } = await Position.findAndCountAll({
      where,
      include: [{ association: 'department', attributes: ['id', 'name'] }],
      offset, limit, order: [['createdAt', 'DESC']],
    });

    return { positions: rows, pagination: getPaginationMeta(count, page, limit) };
  }

  async getById(id) {
    const pos = await Position.findByPk(id, {
      include: [
        { association: 'department' },
        { association: 'employees', attributes: ['id', 'employeeNo', 'firstName', 'lastName'] },
      ],
    });
    if (!pos) throw ApiError.notFound('Position not found');
    return pos;
  }

  async create(data) {
    const sanitized = sanitizeObject(data);
    const dept = await Department.findByPk(sanitized.departmentId);
    if (!dept) throw ApiError.notFound('Department not found');
    const existing = await Position.findOne({
      where: {
        departmentId: sanitized.departmentId,
        title: sequelizeWhere(fn('LOWER', col('title')), sanitized.title.toLowerCase()),
      },
    });
    if (existing) throw ApiError.badRequest('Position with this title already exists in this department');
    return Position.create(sanitized);
  }

  async update(id, data) {
    const pos = await Position.findByPk(id);
    if (!pos) throw ApiError.notFound('Position not found');
    if (data.departmentId) {
      const dept = await Department.findByPk(data.departmentId);
      if (!dept) throw ApiError.notFound('Department not found');
    }
    const checkTitle = data.title || pos.title;
    const checkDept = data.departmentId || pos.departmentId;
    if ((data.title && data.title !== pos.title) || (data.departmentId && data.departmentId !== pos.departmentId)) {
      const existing = await Position.findOne({
        where: {
          id: { [Op.ne]: id },
          departmentId: checkDept,
          title: sequelizeWhere(fn('LOWER', col('title')), checkTitle.toLowerCase()),
        },
      });
      if (existing) throw ApiError.badRequest('Position with this title already exists in this department');
    }
    await pos.update(sanitizeObject(data));
    return pos;
  }

  async delete(id) {
    const pos = await Position.findByPk(id);
    if (!pos) throw ApiError.notFound('Position not found');
    const empCount = await Employee.count({ where: { positionId: id } });
    if (empCount > 0) throw ApiError.badRequest('Cannot delete position with employees');
    await pos.destroy();
    return { message: 'Position deleted' };
  }
}

module.exports = new PositionService();
