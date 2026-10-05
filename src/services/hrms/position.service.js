const { Position, Department, Employee } = require('../../models');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta, escapeLike, sanitizeObject } = require('../../utils/helpers');
const { Op, fn, col, where: sequelizeWhere } = require('sequelize');
const { logActivity } = require('../../utils/audit');

class PositionService {
  async getAll(query) {
    const { page, limit, offset } = getPagination(query.page, query.limit);
    const where = {};
    if (query.search) where.title = { [Op.like]: `%${escapeLike(query.search)}%` };
    if (query.departmentId) where.departmentId = query.departmentId;

    const allowedSort = ["createdAt","title","minSalary"];
    const sortBy = allowedSort.includes(query.sortBy) ? query.sortBy : 'createdAt';
    const sortOrder = query.sortOrder === 'ASC' ? 'ASC' : 'DESC';
    const { rows, count } = await Position.findAndCountAll({
      where,
      include: [{ association: 'department', attributes: ['id', 'name'] }],
      offset, limit, order: [[sortBy, sortOrder]],
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

  async create(data, actorId = null) {
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
    const pos = await Position.create(sanitized);
    await logActivity(actorId, 'position-created', 'HRMS', {
      referenceType: 'Position',
      referenceId: pos.id,
      description: `Created position "${pos.title}" in ${dept.name}`,
      newData: { title: pos.title, departmentId: pos.departmentId, minSalary: pos.minSalary, maxSalary: pos.maxSalary },
    });
    return pos;
  }

  async update(id, data, actorId = null) {
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
    const oldData = { title: pos.title, departmentId: pos.departmentId, minSalary: pos.minSalary, maxSalary: pos.maxSalary, roleSlug: pos.roleSlug };
    await pos.update(sanitizeObject(data));
    await logActivity(actorId, 'position-updated', 'HRMS', {
      referenceType: 'Position',
      referenceId: id,
      description: `Updated position "${pos.title}"`,
      oldData,
      newData: { title: pos.title, departmentId: pos.departmentId, minSalary: pos.minSalary, maxSalary: pos.maxSalary, roleSlug: pos.roleSlug },
    });
    return pos;
  }

  async delete(id, actorId = null) {
    const pos = await Position.findByPk(id);
    if (!pos) throw ApiError.notFound('Position not found');
    const empCount = await Employee.count({ where: { positionId: id } });
    if (empCount > 0) throw ApiError.badRequest('Cannot delete position with employees');
    const oldData = { title: pos.title, departmentId: pos.departmentId, minSalary: pos.minSalary, maxSalary: pos.maxSalary, roleSlug: pos.roleSlug };
    await pos.destroy();
    await logActivity(actorId, 'position-deleted', 'HRMS', {
      referenceType: 'Position',
      referenceId: id,
      description: `Deleted position "${pos.title}"`,
      oldData,
    });
    return { message: 'Position deleted' };
  }
}

module.exports = new PositionService();
