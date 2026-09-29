const bcrypt = require('bcryptjs');
const { User, Role } = require('../models');
const config = require('../config');
const ApiError = require('../utils/ApiError');
const { getPagination, getPaginationMeta, sanitizeObject, escapeLike } = require('../utils/helpers');

class UserService {
  async getAll(query) {
    const { page, limit, offset } = getPagination(query.page, query.limit);
    const where = {};

    if (query.search) {
      const esc = escapeLike(query.search);
      where[require('sequelize').Op.or] = [
        { firstName: { [require('sequelize').Op.like]: `%${esc}%` } },
        { lastName: { [require('sequelize').Op.like]: `%${esc}%` } },
        { email: { [require('sequelize').Op.like]: `%${esc}%` } },
      ];
    }
    if (query.roleId) where.roleId = query.roleId;
    if (query.isActive !== undefined) where.isActive = query.isActive === 'true';

    const sortBy = ['created_at', 'firstName', 'email', 'lastLogin'].includes(query.sortBy) ? query.sortBy : 'created_at';
    const sortOrder = query.sortOrder === 'ASC' ? 'ASC' : 'DESC';

    const { rows, count } = await User.findAndCountAll({
      where,
      include: [
        { association: 'role', attributes: ['id', 'name', 'slug'] },
        { association: 'reportsTo', attributes: ['id', 'firstName', 'lastName'], required: false },
      ],
      offset,
      limit,
      order: [[sortBy, sortOrder]],
    });

    return { users: rows, pagination: getPaginationMeta(count, page, limit) };
  }

  async getById(id) {
    const user = await User.findByPk(id, {
      include: [
        { association: 'role', attributes: ['id', 'name', 'slug'] },
        { association: 'reportsTo', attributes: ['id', 'firstName', 'lastName'], required: false },
      ],
    });
    if (!user) throw ApiError.notFound('User not found');
    return user;
  }

  async create(data) {
    const existing = await User.findOne({ where: { email: data.email } });
    if (existing) throw ApiError.conflict('Email already registered');

    const user = await User.create(sanitizeObject(data));

    return this.getById(user.id);
  }

  async update(id, data) {
    const user = await User.findByPk(id);
    if (!user) throw ApiError.notFound('User not found');

    if (data.email && data.email !== user.email) {
      const existing = await User.findOne({ where: { email: data.email } });
      if (existing) throw ApiError.conflict('Email already in use');
    }

    const safeData = sanitizeObject(data);
    await user.update(safeData);
    return this.getById(id);
  }

  async delete(id) {
    const user = await User.findByPk(id);
    if (!user) throw ApiError.notFound('User not found');

    const { Employee } = require('../models');
    const linkedEmployee = await Employee.findOne({ where: { userId: id } });
    if (linkedEmployee) throw ApiError.badRequest('Cannot delete user linked to an employee. Delete the employee first.');

    await user.destroy();
    return { message: 'User deleted successfully' };
  }
}

module.exports = new UserService();
