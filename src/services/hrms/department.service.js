const { Department, Position, Employee } = require('../../models');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta, sanitizeObject, escapeLike } = require('../../utils/helpers');
const { fn, col, where: sequelizeWhere } = require('sequelize');
const { logActivity } = require('../../utils/audit');

class DepartmentService {
  async getAll(query) {
    const { page, limit, offset } = getPagination(query.page, query.limit);
    const where = {};
    if (query.search) where.name = { [require('sequelize').Op.like]: `%${escapeLike(query.search)}%` };

    const allowedSort = ["createdAt","name"];
    const sortBy = allowedSort.includes(query.sortBy) ? query.sortBy : 'createdAt';
    const sortOrder = query.sortOrder === 'ASC' ? 'ASC' : 'DESC';
    const { rows, count } = await Department.findAndCountAll({
      where,
      include: [{ association: 'positions', attributes: ['id'] }],
      offset, limit, order: [[sortBy, sortOrder]],
    });

    const depts = rows.map(d => ({ ...d.toJSON(), positionCount: d.positions?.length || 0, positions: undefined }));
    return { departments: depts, pagination: getPaginationMeta(count, page, limit) };
  }

  async getById(id) {
    const dept = await Department.findByPk(id, {
      include: [
        { association: 'positions' },
        { association: 'employees', attributes: ['id', 'employeeNo', 'firstName', 'lastName'] },
      ],
    });
    if (!dept) throw ApiError.notFound('Department not found');
    return dept;
  }

  async create(data, actorId = null) {
    const sanitized = sanitizeObject(data);
    const existing = await Department.findOne({
      where: sequelizeWhere(fn('LOWER', col('name')), sanitized.name.toLowerCase()),
    });
    if (existing) throw ApiError.badRequest('Department name already exists');
    const dept = await Department.create(sanitized);
    await logActivity(actorId, 'department-created', 'HRMS', {
      referenceType: 'Department',
      referenceId: dept.id,
      description: `Created department "${dept.name}"`,
      newData: { name: dept.name, description: dept.description },
    });
    return dept;
  }

  async update(id, data, actorId = null) {
    const dept = await Department.findByPk(id);
    if (!dept) throw ApiError.notFound('Department not found');
    const sanitized = sanitizeObject(data);
    if (sanitized.name && sanitized.name.toLowerCase() !== dept.name.toLowerCase()) {
      const existing = await Department.findOne({
        where: sequelizeWhere(fn('LOWER', col('name')), sanitized.name.toLowerCase()),
      });
      if (existing) throw ApiError.badRequest('Department name already exists');
    }
    const oldData = { name: dept.name, description: dept.description, isActive: dept.isActive };
    await dept.update(sanitized);
    await logActivity(actorId, 'department-updated', 'HRMS', {
      referenceType: 'Department',
      referenceId: id,
      description: `Updated department "${dept.name}"`,
      oldData,
      newData: { name: dept.name, description: dept.description, isActive: dept.isActive },
    });
    return dept;
  }

  async delete(id, actorId = null) {
    const dept = await Department.findByPk(id);
    if (!dept) throw ApiError.notFound('Department not found');
    const empCount = await Employee.count({ where: { departmentId: id } });
    if (empCount > 0) throw ApiError.badRequest('Cannot delete department with employees');
    const posCount = await Position.count({ where: { departmentId: id } });
    if (posCount > 0) throw ApiError.badRequest('Cannot delete department with positions');
    const name = dept.name;
    await dept.destroy();
    await logActivity(actorId, 'department-deleted', 'HRMS', {
      referenceType: 'Department',
      referenceId: id,
      description: `Deleted department "${name}"`,
      oldData: { name, description: dept.description },
    });
    return { message: 'Department deleted' };
  }
}

module.exports = new DepartmentService();
