const { Department, Position, Employee } = require('../../models');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta, sanitizeObject, escapeLike } = require('../../utils/helpers');
const { fn, col, where: sequelizeWhere } = require('sequelize');

class DepartmentService {
  async getAll(query) {
    const { page, limit, offset } = getPagination(query.page, query.limit);
    const where = {};
    if (query.search) where.name = { [require('sequelize').Op.like]: `%${escapeLike(query.search)}%` };

    const { rows, count } = await Department.findAndCountAll({
      where,
      include: [{ association: 'positions', attributes: ['id'] }],
      offset, limit, order: [['createdAt', 'DESC']],
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

  async create(data) {
    const sanitized = sanitizeObject(data);
    const existing = await Department.findOne({
      where: sequelizeWhere(fn('LOWER', col('name')), sanitized.name.toLowerCase()),
    });
    if (existing) throw ApiError.badRequest('Department name already exists');
    return Department.create(sanitized);
  }

  async update(id, data) {
    const dept = await Department.findByPk(id);
    if (!dept) throw ApiError.notFound('Department not found');
    const sanitized = sanitizeObject(data);
    if (sanitized.name && sanitized.name.toLowerCase() !== dept.name.toLowerCase()) {
      const existing = await Department.findOne({
        where: sequelizeWhere(fn('LOWER', col('name')), sanitized.name.toLowerCase()),
      });
      if (existing) throw ApiError.badRequest('Department name already exists');
    }
    await dept.update(sanitized);
    return dept;
  }

  async delete(id) {
    const dept = await Department.findByPk(id);
    if (!dept) throw ApiError.notFound('Department not found');
    const empCount = await Employee.count({ where: { departmentId: id } });
    if (empCount > 0) throw ApiError.badRequest('Cannot delete department with employees');
    const posCount = await Position.count({ where: { departmentId: id } });
    if (posCount > 0) throw ApiError.badRequest('Cannot delete department with positions');
    await dept.destroy();
    return { message: 'Department deleted' };
  }
}

module.exports = new DepartmentService();
