const roleService = require('../services/role.service');

class RoleController {
  async getAll(req, res, next) {
    try {
      const roles = await roleService.getAll();
      res.json({ data: { roles } });
    } catch (err) { next(err); }
  }
}

module.exports = new RoleController();
