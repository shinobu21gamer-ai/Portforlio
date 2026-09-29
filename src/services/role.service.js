const { Role } = require('../models');

class RoleService {
  async getAll() {
    return Role.findAll({ where: { isActive: true }, order: [['id', 'ASC']], attributes: ['id', 'name', 'slug', 'description'] });
  }
}

module.exports = new RoleService();
